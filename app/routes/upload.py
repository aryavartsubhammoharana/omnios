import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models.user import User
from app.models.file import DocumentFile
from app.models.chunk import DocumentChunk
from app.models.analytics import StudySession
from app.models.classroom import Classroom
from app.services.extractor import extract_text_from_file
from app.services.embedding import generate_embeddings_batch
from app.services.vector_store import (
    index_document_in_dual_vector_store,
    delete_document_from_dual_vector_store
)
from app.utils.text_chunker import chunk_text
from app.utils.deps import get_current_user

router = APIRouter(prefix="/api/upload", tags=["Upload"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# Background: OCR extraction → AI structuring → Dual Vector DB + PG chunk indexing
# ---------------------------------------------------------------------------

def process_file_text_in_background(doc_id: int):
    from app.database import SessionLocal
    from app.services.ai import structure_ocr_text_with_sarvam

    db = SessionLocal()
    try:
        doc = db.query(DocumentFile).filter(DocumentFile.id == doc_id).first()
        if not doc:
            return

        def on_page_progress(current_page: int, total_pages: int, ocr_used: bool):
            pct = 50 + int((current_page / max(1, total_pages)) * 48)
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

        # 1. Page-by-page text & image extraction (with isolated classroom image storage)
        classroom = None
        if doc.classroom_id:
            classroom = db.query(Classroom).filter(Classroom.id == doc.classroom_id).first()
        class_code = classroom.code if classroom else None

        extracted_text = extract_text_from_file(
            doc.file_path,
            doc_id=doc.id,
            classroom_code=class_code,
            on_page_progress=on_page_progress
        )

        doc = db.query(DocumentFile).filter(DocumentFile.id == doc_id).first()
        if doc:
            # 2. Structure raw OCR text with AI → clean Markdown
            structured_text = structure_ocr_text_with_sarvam(extracted_text) if extracted_text else ""
            doc.content_text = structured_text or f"Classroom Study Material: '{doc.filename}'"
            doc.processing_status = "ready"
            doc.processing_progress = 100
            db.commit()
            print(f"[OK] Document {doc_id} ('{doc.filename}') structured and saved!")

            # 3. Dual Vector DB indexing (Classroom Vector DB + Global Anonymous Vector DB)
            classroom = None
            if doc.classroom_id:
                classroom = db.query(Classroom).filter(Classroom.id == doc.classroom_id).first()
            class_code = classroom.code if classroom else None

            try:
                n = index_document_in_dual_vector_store(
                    doc_id=doc.id,
                    classroom_code=class_code,
                    classroom_id=doc.classroom_id,
                    filename=doc.filename,
                    content_text=doc.content_text,
                )
                print(f"[OK] Document {doc_id} dual-indexed into ChromaDB ({n} chunks)!")
            except Exception as e:
                print(f"Note on Dual Vector DB indexing for doc {doc_id}: {e}")

            # 4. PostgreSQL relational chunk backup
            try:
                chunks = chunk_text(doc.content_text, max_tokens=600, overlap_tokens=80)
                if chunks:
                    db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).delete()
                    db.commit()
                    embeddings = generate_embeddings_batch([c["chunk_text"] for c in chunks])
                    for idx, c in enumerate(chunks):
                        db.add(DocumentChunk(
                            document_id=doc.id,
                            classroom_id=doc.classroom_id,
                            chunk_index=c["chunk_index"],
                            chunk_text=c["chunk_text"],
                            char_start=c["char_start"],
                            char_end=c["char_end"],
                            embedding=embeddings[idx] if idx < len(embeddings) else None,
                            metadata_json={"filename": doc.filename, "total_chunks": len(chunks)},
                        ))
                    db.commit()
                    print(f"[OK] Document {doc_id} indexed in PostgreSQL chunks!")
            except Exception as e:
                print(f"Note on PostgreSQL chunk indexing for doc {doc_id}: {e}")

    except Exception as e:
        print(f"Fatal error in background file processing for doc {doc_id}: {e}")
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Upload file endpoint (supports both /api/upload and /api/upload/document)
# ---------------------------------------------------------------------------

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

    # 1. Validate file extension
    ext = os.path.splitext(file.filename)[1].lower()
    allowed_extensions = [".pdf", ".docx", ".doc", ".txt", ".md", ".png", ".jpg", ".jpeg", ".webp"]
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Allowed: {', '.join(allowed_extensions)}",
        )

    # 2. Save file to disk
    file_id_temp = int(os.urandom(4).hex(), 16)
    saved_filename = f"{file_id_temp}_{file.filename}"
    saved_path = os.path.join(UPLOAD_DIR, saved_filename)

    with open(saved_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = os.path.getsize(saved_path)

    # 3. Create DocumentFile DB Record
    doc = DocumentFile(
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

    # 4. Trigger asynchronous OCR + Structuring + Dual Vector Ingestion
    background_tasks.add_task(process_file_text_in_background, doc.id)

    return {
        "id": doc.id,
        "filename": doc.filename,
        "file_size": file_size,
        "classroom_id": doc.classroom_id,
        "processing_status": doc.processing_status,
        "processing_progress": doc.processing_progress,
        "message": "File uploaded! Text extraction and vector indexing initiated in background.",
    }


# Delete document endpoint (supports both /api/upload/{doc_id} and /api/upload/document/{doc_id})
# ---------------------------------------------------------------------------

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
            print(f"Error removing file from disk: {e}")

    # Cascade delete: Dual Vector DB chunks, relational chunks, study sessions
    try:
        class_code = None
        if doc.classroom_id:
            classroom = db.query(Classroom).filter(Classroom.id == doc.classroom_id).first()
            if classroom:
                class_code = classroom.code
        delete_document_from_dual_vector_store(doc_id, classroom_code=class_code)
        db.query(DocumentChunk).filter(DocumentChunk.document_id == doc_id).delete()
        db.query(StudySession).filter(StudySession.document_id == doc_id).delete()
    except Exception as e:
        print(f"Note on cascade delete for doc {doc_id}: {e}")

    db.delete(doc)
    db.commit()
    return {"message": "Document deleted successfully", "document_id": doc_id}


@router.get("/list")
def list_documents(
    classroom_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(DocumentFile)
    if classroom_id:
        query = query.filter(DocumentFile.classroom_id == classroom_id)
    elif current_user.role == "teacher":
        query = query.filter(DocumentFile.uploaded_by_id == current_user.id)
    else:
        from app.models.classroom import Enrollment
        enrolled_ids = [e.classroom_id for e in db.query(Enrollment).filter(Enrollment.student_id == current_user.id).all()]
        query = query.filter(DocumentFile.classroom_id.in_(enrolled_ids)) if enrolled_ids else query.filter(DocumentFile.id == -1)

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
        "content_preview": d.content_text[:200] if d.content_text else "",
    } for d in docs]


@router.get("/document/{doc_id}")
@router.get("/{doc_id}")
def get_document_content(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = db.query(DocumentFile).filter(DocumentFile.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "id": doc.id,
        "filename": doc.filename,
        "file_url": f"/uploads/{os.path.basename(doc.file_path)}",
        "classroom_id": doc.classroom_id,
        "uploaded_by_id": doc.uploaded_by_id,
        "processing_status": doc.processing_status or "ready",
        "processing_progress": doc.processing_progress if doc.processing_progress is not None else 100,
        "content_text": doc.content_text or "",
        "created_at": doc.created_at,
    }


@router.get("/document/{doc_id}/chunks")
def get_document_chunks(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return parsed vector chunks for a document (for inspection/debugging)."""
    chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc_id).order_by(DocumentChunk.chunk_index.asc()).all()
    return [{
        "id": c.id,
        "chunk_index": c.chunk_index,
        "chunk_text": c.chunk_text,
        "char_start": c.char_start,
        "char_end": c.char_end,
        "has_embedding": c.embedding is not None,
        "dimensions": 768 if c.embedding is not None else 0,
        "metadata": c.metadata_json,
    } for c in chunks]
