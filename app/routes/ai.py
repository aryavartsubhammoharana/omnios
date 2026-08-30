from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.file import DocumentFile
from app.models.classroom import Classroom, Enrollment
from app.schemas.ai import DocumentChatRequest, DocumentSummaryRequest, AIChatResponse
from app.services.ai import query_gemini_ai, query_sarvam_ai, query_groq_ai, generate_document_summary, is_valid_ai_text
from app.services.vector_store import query_classroom_vector_db, query_global_vector_db
from app.utils.deps import get_current_user

router = APIRouter(prefix="/api/ai", tags=["AI"])


@router.post("/chat", response_model=AIChatResponse)
def document_chat(
    data: DocumentChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    context = ""
    source_names = []

    if data.document_id:
        doc = db.query(DocumentFile).filter(DocumentFile.id == data.document_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        has_access = False
        if doc.uploaded_by_id == current_user.id:
            has_access = True
        elif doc.classroom_id:
            is_teacher = db.query(Classroom).filter(Classroom.id == doc.classroom_id, Classroom.teacher_id == current_user.id).first()
            is_enrolled = db.query(Enrollment).filter(Enrollment.classroom_id == doc.classroom_id, Enrollment.student_id == current_user.id).first()
            if is_teacher or is_enrolled:
                has_access = True

        if not has_access:
            raise HTTPException(status_code=403, detail="You do not have permission to query this document")

        matches = query_vector_store(query_text=data.question, doc_id=doc.id, n_results=6)

        if matches:
            parts = []
            for i, ch in enumerate(matches):
                idx = ch.get("chunk_index", i) + 1
                fname = ch.get("filename", doc.filename)
                parts.append(f"[Source {i+1}: {fname} (Chunk #{idx})]\n{ch['chunk_text']}")
                tag = f"{fname} (Chunk #{idx})"
                if tag not in source_names:
                    source_names.append(tag)
            context = "\n\n---\n\n".join(parts)
        else:
            context = doc.content_text or ""
            source_names.append(doc.filename)

    elif data.classroom_id:
        classroom = db.query(Classroom).filter(Classroom.id == data.classroom_id).first()
        if not classroom:
            raise HTTPException(status_code=404, detail="Classroom not found")

        is_teacher = (classroom.teacher_id == current_user.id)
        is_enrolled = db.query(Enrollment).filter(Enrollment.classroom_id == data.classroom_id, Enrollment.student_id == current_user.id).first()
        if not is_teacher and not is_enrolled:
            raise HTTPException(status_code=403, detail="You are not a member of this classroom")

        class_matches = query_vector_store(query_text=data.question, classroom_id=data.classroom_id, n_results=6)
        if class_matches:
            parts = []
            for i, ch in enumerate(class_matches):
                idx = ch.get("chunk_index", i) + 1
                fname = ch.get("filename", "Classroom Lecture Note")
                parts.append(f"[Source {i+1}: {fname} (Chunk #{idx})]\n{ch['chunk_text']}")
                label = f"{fname} (Chunk #{idx})"
                if label not in source_names:
                    source_names.append(label)
            context = "\n\n---\n\n".join(parts)

        if not context:
            docs = db.query(DocumentFile).filter(DocumentFile.classroom_id == data.classroom_id, DocumentFile.processing_status == "ready").all()
            if docs:
                context = "\n---\n".join(d.content_text for d in docs if d.content_text)
                source_names = [d.filename for d in docs]

    else:
        if current_user.role == "teacher":
            allowed_c_ids = [c.id for c in db.query(Classroom.id).filter(Classroom.teacher_id == current_user.id).all()]
        else:
            allowed_c_ids = [e.classroom_id for e in db.query(Enrollment.classroom_id).filter(Enrollment.student_id == current_user.id).all()]

        all_user_matches = query_vector_store(
            query_text=data.question,
            uploaded_by_id=current_user.id,
            allowed_classroom_ids=allowed_c_ids,
            n_results=6
        )

        if all_user_matches:
            parts = []
            for i, ch in enumerate(all_user_matches):
                fname = ch.get("filename", "Study Note")
                parts.append(f"[Source {i+1}: {fname}]\n{ch['chunk_text']}")
                if fname not in source_names:
                    source_names.append(fname)
            context = "\n\n---\n\n".join(parts)

    answer = query_sarvam_ai(prompt=data.question, context=context)

    if not is_valid_ai_text(answer):
        answer = query_gemini_ai(prompt=data.question, context=context)

    return AIChatResponse(
        answer=answer,
        provider_used="DLM Notebook AI",
        sources=source_names,
    )


@router.post("/summary", response_model=AIChatResponse)
def document_summary(
    data: DocumentSummaryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = db.query(DocumentFile).filter(DocumentFile.id == data.document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    has_access = False
    if doc.uploaded_by_id == current_user.id:
        has_access = True
    elif doc.classroom_id:
        is_teacher = db.query(Classroom).filter(Classroom.id == doc.classroom_id, Classroom.teacher_id == current_user.id).first()
        is_enrolled = db.query(Enrollment).filter(Enrollment.classroom_id == doc.classroom_id, Enrollment.student_id == current_user.id).first()
        if is_teacher or is_enrolled:
            has_access = True

    if not has_access:
        raise HTTPException(status_code=403, detail="You do not have permission to view this document summary")

    if not doc.content_text:
        raise HTTPException(status_code=400, detail="Document has no extracted text content.")

    summary = generate_document_summary(doc.content_text, doc.filename)
    return AIChatResponse(
        answer=summary,
        provider_used="GEMINI/SARVAM/GROQ",
        sources=[doc.filename],
    )
