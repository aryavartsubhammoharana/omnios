import os
import shutil
import uuid
import fitz
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.file import DocumentFile
from app.models.chunk import DocumentChunk
from app.models.classroom import Classroom
from app.models.analytics import StudySession
from app.models.image import ImageRecord, ImageBatch
from app.routes.auth import get_current_user
from app.services.extractor import extract_text_from_file
from app.services.ai import structure_ocr_text_with_sarvam
from app.services.vector_store import (
    index_document_in_dual_vector_store,
    delete_document_from_dual_vector_store,
    get_classroom_collection,
    get_global_collection
)
from app.services.image_merger import (
    merge_images_into_grid,
    analyze_image_batch_with_groq,
    parse_groq_batch_response
)

router = APIRouter(prefix="/api/upload", tags=["Upload"])
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "images"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "merged"), exist_ok=True)


def extract_and_analyze_document_images(doc_id: int, classroom_id: Optional[int], file_path: str):
    db = SessionLocal()
    try:
        ext = os.path.splitext(file_path)[1].lower()
        extracted_by_page = {}

        if ext == ".pdf":
            try:
                pdf_doc = fitz.open(file_path)
                for page_idx in range(len(pdf_doc)):
                    page_num = page_idx + 1
                    page = pdf_doc[page_idx]
                    img_list = page.get_images()

                    page_img_records = []
                    img_counter = 1

                    for img_info in img_list:
                        xref = img_info[0]
                        base_img = pdf_doc.extract_image(xref)
                        if not base_img or "image" not in base_img:
                            continue

                        w = base_img.get("width", 0)
                        h = base_img.get("height", 0)
                        if w < 70 or h < 70:
                            continue

                        img_bytes = base_img["image"]
                        img_ext = base_img.get("ext", "png")

                        doc_img_dir = os.path.join(UPLOAD_DIR, "images", str(doc_id))
                        os.makedirs(doc_img_dir, exist_ok=True)

                        img_filename = f"page_{page_num}_img_{img_counter}.{img_ext}"
                        save_path = os.path.join(doc_img_dir, img_filename)

                        with open(save_path, "wb") as f_out:
                            f_out.write(img_bytes)

                        img_rec = ImageRecord(
                            file_id=doc_id,
                            classroom_id=classroom_id,
                            page_number=page_num,
                            image_path=save_path
                        )
                        db.add(img_rec)
                        db.commit()
                        db.refresh(img_rec)

                        page_img_records.append(img_rec)
                        img_counter += 1

                    if page_img_records:
                        extracted_by_page[page_num] = page_img_records

                pdf_doc.close()
            except Exception as e:
                print(f"Error during PDF image extraction for doc {doc_id}: {e}")

        elif ext in (".docx", ".doc"):
            try:
                import docx
                d_obj = docx.Document(file_path)
                doc_img_dir = os.path.join(UPLOAD_DIR, "images", str(doc_id))
                os.makedirs(doc_img_dir, exist_ok=True)

                page_num = 1
                img_counter = 1
                page_img_records = []

                for rel_id, rel in d_obj.part.related_parts.items():
                    if "image" in rel.content_type:
                        img_bytes = rel.blob
                        if len(img_bytes) < 1500:
                            continue

                        img_filename = f"page_{page_num}_img_{img_counter}.png"
                        save_path = os.path.join(doc_img_dir, img_filename)

                        with open(save_path, "wb") as f_out:
                            f_out.write(img_bytes)

                        img_rec = ImageRecord(
                            file_id=doc_id,
                            classroom_id=classroom_id,
                            page_number=page_num,
                            image_path=save_path
                        )
                        db.add(img_rec)
                        db.commit()
                        db.refresh(img_rec)

                        page_img_records.append(img_rec)
                        img_counter += 1

                if page_img_records:
                    extracted_by_page[page_num] = page_img_records
            except Exception as e:
                print(f"Error during DOCX image extraction for doc {doc_id}: {e}")

        for page_num, img_records in extracted_by_page.items():
            chunk_size = 12
            for sub_idx in range(0, len(img_records), chunk_size):
                sub_batch = img_records[sub_idx:sub_idx + chunk_size]
                count = len(sub_batch)
                local_map = {}

                for i, img_r in enumerate(sub_batch):
                    local_map[f"Image {i + 1}"] = str(img_r.image_id)

                if count == 1:
                    merged_path = sub_batch[0].image_path
                else:
                    batch_suffix = f"_b{sub_idx // chunk_size + 1}" if len(img_records) > 12 else ""
                    merged_filename = f"{doc_id}_page{page_num}{batch_suffix}_merged.png"
                    merged_path = os.path.join(UPLOAD_DIR, "merged", merged_filename)
                    sub_paths = [r.image_path for r in sub_batch]
                    merge_images_into_grid(sub_paths, merged_path)

                raw_resp = analyze_image_batch_with_groq(merged_path, count, page_num)

                batch_rec = ImageBatch(
                    file_id=doc_id,
                    classroom_id=classroom_id,
                    page_number=page_num,
                    merged_image_path=merged_path,
                    image_count=count,
                    local_image_ids=local_map,
                    raw_response=raw_resp
                )
                db.add(batch_rec)
                db.commit()

                parsed_map = parse_groq_batch_response(raw_resp, local_map)
                new_visual_notes = []
                for img_r in sub_batch:
                    txt = parsed_map.get(str(img_r.image_id))
                    if txt:
                        img_r.analysis_text = txt
                        db.commit()

                        new_visual_notes.append(f"### 🔍 Figure Analysis (Page {page_num}):\n{txt}\n")

                        try:
                            class_code = None
                            if classroom_id:
                                c_obj = db.query(Classroom).filter(Classroom.id == classroom_id).first()
                                if c_obj:
                                    class_code = c_obj.code

                            chunk_content = f"Page {page_num} Visual Diagram Analysis:\n{txt}"

                            if class_code:
                                c_col = get_classroom_collection(class_code)
                                c_col.add(
                                    ids=[f"class_{class_code}_doc_{doc_id}_img_{img_r.image_id}"],
                                    documents=[chunk_content],
                                    metadatas=[{
                                        "doc_id": doc_id,
                                        "classroom_id": classroom_id,
                                        "source_type": "image_analysis",
                                        "page_number": page_num,
                                        "image_id": str(img_r.image_id)
                                    }]
                                )

                            g_col = get_global_collection()
                            g_col.add(
                                ids=[f"global_doc_{doc_id}_img_{img_r.image_id}"],
                                documents=[chunk_content],
                                metadatas=[{
                                    "doc_hash": f"doc_{doc_id}",
                                    "source_type": "image_analysis",
                                    "page_number": page_num
                                }]
                            )
                        except Exception as ex:
                            print(f"Error vector indexing image analysis {img_r.image_id}: {ex}")

                if new_visual_notes:
                    doc_obj = db.query(DocumentFile).filter(DocumentFile.id == doc_id).first()
                    if doc_obj and doc_obj.content_text:
                        doc_obj.content_text += "\n\n" + "\n".join(new_visual_notes)
                        db.commit()

    except Exception as e:
        print(f"Error in extract_and_analyze_document_images for doc {doc_id}: {e}")
    finally:
        db.close()


def process_file_text_in_background(doc_id: int):
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
            structured_text = structure_ocr_text_with_sarvam(extracted_text) if extracted_text else ""
            doc.content_text = structured_text or f"Classroom Study Material: '{doc.filename}'"
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

        extract_and_analyze_document_images(doc_id, doc.classroom_id, doc.file_path)

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

    file_id_temp = int(os.urandom(4).hex(), 16)
    saved_filename = f"{file_id_temp}_{file.filename}"
    saved_path = os.path.join(UPLOAD_DIR, saved_filename)

    with open(saved_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = os.path.getsize(saved_path)

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

    background_tasks.add_task(process_file_text_in_background, doc.id)

    return {
        "id": doc.id,
        "filename": doc.filename,
        "file_size": file_size,
        "classroom_id": doc.classroom_id,
        "processing_status": doc.processing_status,
        "processing_progress": doc.processing_progress,
        "message": "File uploaded! Text extraction, image merging, and Groq Vision analysis initiated in background.",
    }


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
        except Exception:
            pass

    try:
        class_code = None
        if doc.classroom_id:
            classroom = db.query(Classroom).filter(Classroom.id == doc.classroom_id).first()
            if classroom:
                class_code = classroom.code
        delete_document_from_dual_vector_store(doc_id, classroom_code=class_code)
        db.query(DocumentChunk).filter(DocumentChunk.document_id == doc_id).delete()
        db.query(StudySession).filter(StudySession.document_id == doc_id).delete()
        db.query(ImageRecord).filter(ImageRecord.file_id == doc_id).delete()
        db.query(ImageBatch).filter(ImageBatch.file_id == doc_id).delete()
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


@router.get("/images/{file_id}")
def list_extracted_images(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    images = db.query(ImageRecord).filter(ImageRecord.file_id == file_id).order_by(ImageRecord.page_number.asc()).all()
    return [{
        "image_id": str(img.image_id),
        "file_id": img.file_id,
        "classroom_id": img.classroom_id,
        "page_number": img.page_number,
        "image_url": f"/{img.image_path.replace(chr(92), '/')}",
        "analysis_text": img.analysis_text,
        "created_at": img.created_at
    } for img in images]


@router.get("/image-batches/{file_id}")
def list_image_batches(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    batches = db.query(ImageBatch).filter(ImageBatch.file_id == file_id).order_by(ImageBatch.page_number.asc()).all()
    return [{
        "batch_id": str(b.batch_id),
        "file_id": b.file_id,
        "classroom_id": b.classroom_id,
        "page_number": b.page_number,
        "merged_image_url": f"/{b.merged_image_path.replace(chr(92), '/')}",
        "image_count": b.image_count,
        "local_image_ids": b.local_image_ids,
        "raw_response": b.raw_response,
        "created_at": b.created_at
    } for b in batches]


@router.post("/reanalyze-image/{image_id}")
def reanalyze_single_image(
    image_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can re-analyze images.",
        )

    img = db.query(ImageRecord).filter(ImageRecord.image_id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image record not found")

    if not os.path.exists(img.image_path):
        raise HTTPException(status_code=400, detail="Image file missing on disk")

    analysis = analyze_image_batch_with_groq(img.image_path, 1, img.page_number)
    img.analysis_text = analysis
    db.commit()

    return {
        "message": "Image re-analyzed successfully",
        "image_id": str(img.image_id),
        "analysis_text": analysis
    }
