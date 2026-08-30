import os
import shutil
import secrets
from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.file import DocumentFile
from app.models.chunk import DocumentChunk
from app.models.classroom import Classroom, Enrollment
from app.routes.auth import get_current_user
from app.services.extractor import extract_text_from_file
from app.services.vector_store import (
    index_document_in_vector_store,
    delete_document_from_vector_store
)

router = APIRouter(prefix="/api/upload", tags=["Upload"])
UPLOAD_DIR = "uploads"
DOCUMENTS_DIR = os.path.join(UPLOAD_DIR, "documents")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(DOCUMENTS_DIR, exist_ok=True)


class FolderRenameRequest(BaseModel):
    old_folder_name: str
    new_folder_name: str
    classroom_id: Optional[int] = None


def process_file_text_in_background(doc_id: int):
    db = SessionLocal()
    try:
        doc = db.query(DocumentFile).filter(DocumentFile.id == doc_id).first()
        if not doc:
            return

        def on_page_progress(current_page: int, total_pages: int, ocr_used: bool):
            pct = min(95, int((current_page / max(1, total_pages)) * 90))
            try:
                sub_db = SessionLocal()
                sub_doc = sub_db.query(DocumentFile).filter(DocumentFile.id == doc_id).first()
                if sub_doc:
                    sub_doc.processing_status = f"page_{current_page}_{total_pages}"
                    sub_doc.processing_progress = pct
                    sub_db.commit()
                sub_db.close()
            except Exception as ex:
                print(f"Error updating progress: {ex}")

        classroom = None
        if doc.classroom_id:
            classroom = db.query(Classroom).filter(Classroom.id == doc.classroom_id).first()
        class_code = classroom.code if classroom else None

        extracted_text = extract_text_from_file(
            doc.file_path,
            doc_id=doc.id,
            unique_code=doc.unique_code,
            classroom_code=class_code,
            on_page_progress=on_page_progress
        )

        doc = db.query(DocumentFile).filter(DocumentFile.id == doc_id).first()
        if doc:
            doc.content_text = extracted_text or f"Classroom Study Material: '{doc.filename}'"
            doc.processing_status = "ready"
            doc.processing_progress = 100
            db.commit()

            try:
                index_document_in_vector_store(
                    doc_id=doc.id,
                    content_text=doc.content_text,
                    filename=doc.filename,
                    classroom_id=doc.classroom_id,
                    classroom_code=class_code,
                    uploaded_by_id=doc.uploaded_by_id
                )
            except Exception as e:
                print(f"Error during vector DB indexing: {e}")

            if not doc.classroom_id:
                if doc.file_path and os.path.exists(doc.file_path):
                    try:
                        os.remove(doc.file_path)
                        doc.file_path = ""
                        db.commit()
                        print(f"[OK] DLM Notebook Ephemeral File: Cleaned physical file from disk for doc_id={doc.id} after vector indexing.")
                    except Exception as ex:
                        print(f"Note cleaning DLM ephemeral file: {ex}")

    except Exception as e:
        print(f"Fatal error in background file processing: {e}")
    finally:
        db.close()


@router.post("")
@router.post("/document")
async def upload_files(
    files: List[UploadFile] = File(...),
    classroom_id: Optional[int] = Form(None),
    folder_name: Optional[str] = Form("General Notes"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if classroom_id:
        is_teacher = db.query(Classroom).filter(Classroom.id == classroom_id, Classroom.teacher_id == current_user.id).first()
        if not is_teacher:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only classroom teachers can upload notes directly to a classroom stream.",
            )
        default_folder = "General Notes"
    else:
        default_folder = "Personal Notes"

    allowed_extensions = [
        ".pdf", ".docx", ".doc", ".pptx", ".ppt", ".txt", ".md",
        ".png", ".jpg", ".jpeg", ".webp", ".json", ".csv", ".py", ".cpp", ".java"
    ]

    target_folder = (folder_name or default_folder).strip()
    if not target_folder:
        target_folder = default_folder

    saved_documents = []

    for file in files:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in allowed_extensions:
            continue

        unique_code = secrets.token_hex(5)
        saved_filename = f"{unique_code}{ext}"
        saved_path = os.path.join(DOCUMENTS_DIR, saved_filename)

        with open(saved_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_size = os.path.getsize(saved_path)

        doc = DocumentFile(
            unique_code=unique_code,
            filename=file.filename,
            file_path=saved_path,
            uploaded_by_id=current_user.id,
            classroom_id=classroom_id,
            folder_name=target_folder,
            processing_status="processing",
            processing_progress=0,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        background_tasks.add_task(process_file_text_in_background, doc.id)

        saved_documents.append({
            "id": doc.id,
            "unique_code": doc.unique_code,
            "filename": doc.filename,
            "folder_name": doc.folder_name,
            "file_size": file_size,
            "classroom_id": doc.classroom_id,
            "processing_status": doc.processing_status,
            "processing_progress": doc.processing_progress,
        })

    if not saved_documents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid files uploaded. Please upload PDF, DOCX, PPTX, or TXT files.",
        )

    return {
        "uploaded_count": len(saved_documents),
        "folder_name": target_folder,
        "documents": saved_documents,
        "message": f"Successfully uploaded {len(saved_documents)} note(s) to '{target_folder}'.",
    }


@router.get("/list")
def list_documents(
    classroom_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if classroom_id:
        is_teacher = db.query(Classroom).filter(Classroom.id == classroom_id, Classroom.teacher_id == current_user.id).first()
        is_enrolled = db.query(Enrollment).filter(Enrollment.classroom_id == classroom_id, Enrollment.student_id == current_user.id).first()
        if not is_teacher and not is_enrolled:
            return []
        docs = db.query(DocumentFile).filter(DocumentFile.classroom_id == classroom_id).order_by(DocumentFile.created_at.desc()).all()
    else:
        if current_user.role == "teacher":
            taught_class_ids = [c.id for c in db.query(Classroom.id).filter(Classroom.teacher_id == current_user.id).all()]
            docs = db.query(DocumentFile).filter(
                (DocumentFile.uploaded_by_id == current_user.id) | (DocumentFile.classroom_id.in_(taught_class_ids))
            ).order_by(DocumentFile.created_at.desc()).all()
        else:
            enrolled_class_ids = [e.classroom_id for e in db.query(Enrollment.classroom_id).filter(Enrollment.student_id == current_user.id).all()]
            if enrolled_class_ids:
                docs = db.query(DocumentFile).filter(
                    (DocumentFile.uploaded_by_id == current_user.id) | (DocumentFile.classroom_id.in_(enrolled_class_ids))
                ).order_by(DocumentFile.created_at.desc()).all()
            else:
                docs = db.query(DocumentFile).filter(
                    DocumentFile.uploaded_by_id == current_user.id
                ).order_by(DocumentFile.created_at.desc()).all()

    classroom_map = {c.id: c.name for c in db.query(Classroom).all()}

    return [
        {
            "id": doc.id,
            "unique_code": doc.unique_code,
            "filename": doc.filename,
            "folder_name": doc.folder_name or "General Notes",
            "classroom_id": doc.classroom_id,
            "classroom_name": classroom_map.get(doc.classroom_id, "Classroom Notes" if doc.classroom_id else "Personal Notes"),
            "file_url": f"/{doc.file_path.replace(chr(92), '/')}" if doc.file_path else None,
            "processing_status": doc.processing_status,
            "processing_progress": doc.processing_progress,
            "uploaded_by_id": doc.uploaded_by_id,
            "created_at": doc.created_at,
        }
        for doc in docs
    ]


@router.delete("/{doc_id}")
@router.delete("/document/{doc_id}")
def delete_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = db.query(DocumentFile).filter(DocumentFile.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.uploaded_by_id != current_user.id and current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="You do not have permission to delete this document")

    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception as e:
            print(f"Error removing document file: {e}")

    try:
        delete_document_from_vector_store(doc_id=doc.id)
    except Exception as e:
        print(f"Error removing document from vector store: {e}")

    db.query(DocumentChunk).filter(DocumentChunk.document_id == doc_id).delete(synchronize_session=False)
    db.delete(doc)
    db.commit()

    return {"message": "Document and all associated vector chunks deleted successfully"}


@router.put("/folder/rename")
def rename_folder(
    req: FolderRenameRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can manage note folders")

    query = db.query(DocumentFile).filter(DocumentFile.folder_name == req.old_folder_name)
    if req.classroom_id:
        query = query.filter(DocumentFile.classroom_id == req.classroom_id)

    updated_count = query.update({"folder_name": req.new_folder_name.strip()})
    db.commit()

    return {"message": f"Renamed folder from '{req.old_folder_name}' to '{req.new_folder_name}' ({updated_count} notes updated)"}


@router.get("/developer-docs")
def get_developer_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dev_docs = db.query(DocumentFile).filter(
        DocumentFile.folder_name == "Developer Library",
        DocumentFile.processing_status == "ready"
    ).order_by(DocumentFile.created_at.desc()).all()

    return [
        {
            "id": d.id,
            "filename": d.filename,
            "folder_name": d.folder_name or "Developer Library",
            "file_url": f"/{d.file_path.replace(chr(92), '/')}" if d.file_path else None,
            "created_at": d.created_at,
            "processing_status": d.processing_status
        }
        for d in dev_docs
    ]


@router.get("/document/{doc_id}")
def get_document_details(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = db.query(DocumentFile).filter(DocumentFile.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    has_access = False
    if doc.classroom_id is None:
        has_access = True
    elif doc.uploaded_by_id == current_user.id:
        has_access = True
    elif doc.classroom_id:
        is_teacher = db.query(Classroom).filter(Classroom.id == doc.classroom_id, Classroom.teacher_id == current_user.id).first()
        is_enrolled = db.query(Enrollment).filter(Enrollment.classroom_id == doc.classroom_id, Enrollment.student_id == current_user.id).first()
        if is_teacher or is_enrolled:
            has_access = True

    if not has_access:
        raise HTTPException(status_code=403, detail="You do not have permission to access this document")

    file_url = f"/{doc.file_path.replace(chr(92), '/')}" if doc.file_path else None

    return {
        "id": doc.id,
        "unique_code": doc.unique_code,
        "filename": doc.filename,
        "folder_name": doc.folder_name or "General Notes",
        "classroom_id": doc.classroom_id,
        "file_url": file_url,
        "content_text": doc.content_text,
        "processing_status": doc.processing_status,
        "processing_progress": doc.processing_progress,
        "uploaded_by_id": doc.uploaded_by_id,
        "created_at": doc.created_at,
    }
