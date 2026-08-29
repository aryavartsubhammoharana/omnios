import os
import shutil
import secrets
from typing import Optional, List
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.file import DocumentFile
from app.models.chunk import DocumentChunk
from app.models.classroom import Classroom
from app.routes.auth import get_current_user
from app.services.extractor import extract_text_from_file
from app.services.ai import structure_ocr_text_with_sarvam
from app.services.vector_store import (
    index_document_in_dual_vector_store,
    delete_document_from_dual_vector_store
)

router = APIRouter(prefix="/api/upload", tags=["Upload"])
UPLOAD_DIR = "uploads"
DOCUMENTS_DIR = os.path.join(UPLOAD_DIR, "documents")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(DOCUMENTS_DIR, exist_ok=True)


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
                    sub_doc.processing_status = f"ocr_page_{current_page}_{total_pages}"
                    sub_doc.processing_progress = pct
                    sub_db.commit()
                sub_db.close()
            except Exception as ex:
                print(f"Error updating page progress for doc {doc_id}: {ex}")

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
                index_document_in_dual_vector_store(
                    doc_id=doc.id,
                    content_text=doc.content_text,
                    filename=doc.filename,
                    classroom_id=doc.classroom_id,
                    classroom_code=class_code
                )
            except Exception as e:
                print(f"Error during dual vector DB indexing for doc {doc_id}: {e}")

    except Exception as e:
        print(f"Fatal error in background file processing for doc {doc_id}: {e}")
    finally:
        db.close()


@router.post("")
@router.post("/document")
async def upload_file(
    file: UploadFile = File(...),
    classroom_id: Optional[int] = Form(None),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can upload study materials and notes.",
        )

    ext = os.path.splitext(file.filename)[1].lower()
    allowed_extensions = [".pdf", ".docx", ".doc", ".txt", ".md", ".png", ".jpg", ".jpeg", ".webp"]
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Allowed: {', '.join(allowed_extensions)}",
        )

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
        processing_status="processing",
        processing_progress=0,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    background_tasks.add_task(process_file_text_in_background, doc.id)

    return {
        "id": doc.id,
        "unique_code": doc.unique_code,
        "filename": doc.filename,
        "file_size": file_size,
        "classroom_id": doc.classroom_id,
        "processing_status": doc.processing_status,
        "processing_progress": doc.processing_progress,
        "message": "File securely stored. Full text extraction & vector indexing initiated.",
    }


@router.get("/list")
def list_documents(
    classroom_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(DocumentFile)
    if classroom_id:
        query = query.filter(DocumentFile.classroom_id == classroom_id)
    docs = query.order_by(DocumentFile.created_at.desc()).all()
    return [
        {
            "id": doc.id,
            "unique_code": doc.unique_code,
            "filename": doc.filename,
            "classroom_id": doc.classroom_id,
            "file_url": f"/{doc.file_path.replace(chr(92), '/')}",
            "processing_status": doc.processing_status,
            "processing_progress": doc.processing_progress,
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
            print(f"Error removing document file from disk: {e}")

    try:
        class_code = None
        if doc.classroom_id:
            c_obj = db.query(Classroom).filter(Classroom.id == doc.classroom_id).first()
            if c_obj:
                class_code = c_obj.code

        delete_document_from_dual_vector_store(
            doc_id=doc.id,
            classroom_id=doc.classroom_id,
            classroom_code=class_code
        )
    except Exception as e:
        print(f"Error removing document from dual vector store: {e}")

    db.query(DocumentChunk).filter(DocumentChunk.document_id == doc_id).delete(synchronize_session=False)
    db.delete(doc)
    db.commit()

    return {"message": "Document and all associated vector chunks deleted successfully"}


@router.get("/document/{doc_id}")
def get_document_details(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = db.query(DocumentFile).filter(DocumentFile.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    file_url = f"/{doc.file_path.replace(chr(92), '/')}"

    return {
        "id": doc.id,
        "unique_code": doc.unique_code,
        "filename": doc.filename,
        "classroom_id": doc.classroom_id,
        "file_url": file_url,
        "content_text": doc.content_text,
        "processing_status": doc.processing_status,
        "processing_progress": doc.processing_progress,
        "created_at": doc.created_at,
    }
