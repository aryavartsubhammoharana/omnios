import os
import shutil
import fitz # PyMuPDF
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.user import User
from app.models.file import DocumentFile
from app.services.extractor import extract_text_from_file
from app.utils.deps import get_current_user

router = APIRouter(prefix="/api/upload", tags=["Upload"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def process_file_text_in_background(doc_id: int):
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        doc = db.query(DocumentFile).filter(DocumentFile.id == doc_id).first()
        if doc:
            # Stage 2: 75% GPU OCR & Gemini AI Processing
            doc.processing_status = "ocr_processing"
            doc.processing_progress = 75
            db.commit()

            # Run GPU EasyOCR + Zero-Data-Loss Gemini AI Structuring safely
            extracted_text = ""
            try:
                extracted_text = extract_text_from_file(doc.file_path)
            except Exception as ex_ext:
                print(f"Extractor exception for doc {doc_id}: {ex_ext}")

            # Re-fetch doc in case DB session stale during long OCR/Gemini call
            doc = db.query(DocumentFile).filter(DocumentFile.id == doc_id).first()
            if doc:
                doc.content_text = extracted_text if (extracted_text and extracted_text.strip()) else f"Classroom Study Material File '{doc.filename}' uploaded by teacher."
                doc.processing_status = "ready"
                doc.processing_progress = 100
                db.commit()
                print(f"Document {doc_id} OCR + Gemini AI processing completed 100%!")
    except Exception as e:
        print(f"Error extracting text in background for doc {doc_id}: {e}")
        try:
            doc = db.query(DocumentFile).filter(DocumentFile.id == doc_id).first()
            if doc:
                doc.processing_status = "ready"
                doc.processing_progress = 100
                db.commit()
        except Exception:
            pass
    finally:
        db.close()

@router.post("/document")
def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    classroom_id: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can upload study notes and documents"
        )

    filename_clean = f"{current_user.id}_{file.filename}"
    save_path = os.path.join(UPLOAD_DIR, filename_clean)
    
    # 0% to 50% Upload Stage
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    doc = DocumentFile(
        classroom_id=classroom_id,
        uploaded_by_id=current_user.id,
        filename=file.filename,
        file_path=save_path,
        content_text="",
        processing_status="processing",
        processing_progress=50
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # 50% to 75% to 100% Background GPU OCR + Gemini AI Structuring
    background_tasks.add_task(process_file_text_in_background, doc.id)

    return {
        "id": doc.id,
        "filename": doc.filename,
        "file_url": f"/uploads/{filename_clean}",
        "processing_status": doc.processing_status,
        "processing_progress": doc.processing_progress,
        "created_at": doc.created_at
    }

@router.delete("/document/{doc_id}")
def delete_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can delete study notes and documents")

    doc = db.query(DocumentFile).filter(DocumentFile.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.uploaded_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete documents that you uploaded")

    # 1. Delete physical file from disk
    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception as e:
            print(f"Error removing physical file from disk: {e}")

    # 2. Delete database record & extracted text content
    db.delete(doc)
    db.commit()

    return {"message": "Document note deleted successfully", "document_id": doc_id}

@router.get("/list")
def list_documents(classroom_id: Optional[int] = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(DocumentFile)
    if classroom_id:
        query = query.filter(DocumentFile.classroom_id == classroom_id)
    else:
        if current_user.role == "teacher":
            query = query.filter(DocumentFile.uploaded_by_id == current_user.id)
        else:
            from app.models.classroom import Enrollment
            enrollments = db.query(Enrollment).filter(Enrollment.student_id == current_user.id).all()
            c_ids = [e.classroom_id for e in enrollments]
            query = query.filter(DocumentFile.classroom_id.in_(c_ids)) if c_ids else query.filter(DocumentFile.id == -1)

    docs = query.order_by(DocumentFile.created_at.desc()).all()
    return [{
        "id": d.id,
        "filename": d.filename,
        "file_url": f"/uploads/{os.path.basename(d.file_path)}",
        "classroom_id": d.classroom_id,
        "uploaded_by_id": d.uploaded_by_id,
        "processing_status": d.processing_status or "ready",
        "processing_progress": d.processing_progress if d.processing_progress is not None else 100,
        "created_at": d.created_at,
        "content_preview": d.content_text[:200] if d.content_text else ""
    } for d in docs]

@router.get("/document/{doc_id}")
def get_document_content(doc_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.query(DocumentFile).filter(DocumentFile.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    filename_clean = os.path.basename(doc.file_path)
    return {
        "id": doc.id,
        "filename": doc.filename,
        "file_url": f"/uploads/{filename_clean}",
        "classroom_id": doc.classroom_id,
        "uploaded_by_id": doc.uploaded_by_id,
        "processing_status": doc.processing_status or "ready",
        "processing_progress": doc.processing_progress if doc.processing_progress is not None else 100,
        "content_text": doc.content_text or "",
        "created_at": doc.created_at
    }
