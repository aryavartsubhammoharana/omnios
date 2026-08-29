import os
import shutil
import fitz # PyMuPDF
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.user import User
from app.models.file import DocumentFile
from app.models.chunk import DocumentChunk
from app.services.extractor import extract_text_from_file
from app.services.embedding import generate_embeddings_batch
from app.utils.text_chunker import chunk_text
from app.utils.deps import get_current_user

router = APIRouter(prefix="/api/upload", tags=["Upload"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def process_file_text_in_background(doc_id: int):
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        doc = db.query(DocumentFile).filter(DocumentFile.id == doc_id).first()
        if not doc:
            return

        def on_page_progress_update(current_page: int, total_pages: int, ocr_used: bool):
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

        # 1. Page-by-page extraction (text layer -> GPU OCR per page)
        extracted_text = extract_text_from_file(doc.file_path, on_page_progress=on_page_progress_update)

        doc = db.query(DocumentFile).filter(DocumentFile.id == doc_id).first()
        if doc:
            # 2. Structure raw OCR text with Sarvam AI into beautiful Markdown tables & headings
            from app.services.ai import structure_ocr_text_with_sarvam
            structured_text = structure_ocr_text_with_sarvam(extracted_text) if extracted_text else ""

            doc.content_text = structured_text if (structured_text and structured_text.strip()) else f"Classroom Study Material File '{doc.filename}' uploaded by teacher."
            doc.processing_status = "ready"
            doc.processing_progress = 100
            db.commit()
            print(f"[OK] Document {doc_id} ('{doc.filename}') text structured and saved 100%!")

            # 2. Semantic Text Chunking & ChromaDB Vector Indexing
            try:
                from app.services.vector_store import index_document_in_chroma
                n_indexed = index_document_in_chroma(
                    doc_id=doc.id,
                    classroom_id=doc.classroom_id,
                    filename=doc.filename,
                    content_text=doc.content_text
                )
                print(f"[OK] Document {doc_id} ('{doc.filename}') indexed in ChromaDB ({n_indexed} vector chunks)!")
            except Exception as chroma_err:
                print(f"Note on ChromaDB indexing for doc {doc_id}: {chroma_err}")

            # 3. Also store in PostgreSQL document_chunks table as relational backup
            try:
                chunks = chunk_text(doc.content_text, max_tokens=600, overlap_tokens=80)
                if chunks:
                    db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).delete()
                    db.commit()

                    texts_to_embed = [c["chunk_text"] for c in chunks]
                    embeddings = generate_embeddings_batch(texts_to_embed)

                    for idx, c in enumerate(chunks):
                        emb = embeddings[idx] if idx < len(embeddings) else None
                        chunk_obj = DocumentChunk(
                            document_id=doc.id,
                            classroom_id=doc.classroom_id,
                            chunk_index=c["chunk_index"],
                            chunk_text=c["chunk_text"],
                            char_start=c["char_start"],
                            char_end=c["char_end"],
                            embedding=emb,
                            metadata_json={"filename": doc.filename, "total_chunks": len(chunks)}
                        )
                        db.add(chunk_obj)
                    db.commit()
            except Exception as ch_err:
                print(f"Note on relational chunking for doc {doc_id}: {ch_err}")

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

    # 50% to 100% Page-by-Page GPU OCR & Extraction in Background
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

    # 2. Delete child records (vector chunks, ChromaDB vectors, & study sessions)
    from app.models.analytics import StudySession
    from app.models.chunk import DocumentChunk
    from app.services.vector_store import delete_document_from_chroma
    try:
        delete_document_from_chroma(doc_id)
        db.query(DocumentChunk).filter(DocumentChunk.document_id == doc_id).delete()
        db.query(StudySession).filter(StudySession.document_id == doc_id).delete()
    except Exception as cascade_err:
        print(f"Note on cascading delete for doc {doc_id}: {cascade_err}")

    # 3. Delete database record & extracted text content
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

@router.get("/document/{doc_id}/chunks")
def get_document_chunks(doc_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Fetch parsed vector chunks and embedding status for inspection."""
    chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc_id).order_by(DocumentChunk.chunk_index.asc()).all()
    return [{
        "id": c.id,
        "chunk_index": c.chunk_index,
        "chunk_text": c.chunk_text,
        "char_start": c.char_start,
        "char_end": c.char_end,
        "has_embedding": c.embedding is not None,
        "dimensions": 768 if c.embedding is not None else 0,
        "metadata": c.metadata_json
    } for c in chunks]

