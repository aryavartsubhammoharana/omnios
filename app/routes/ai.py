from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.file import DocumentFile
from app.models.classroom import Classroom
from app.schemas.ai import DocumentChatRequest, DocumentSummaryRequest, AIChatResponse
from app.services.ai import query_gemini_ai, query_sarvam_ai, query_groq_ai, generate_document_summary, is_valid_ai_text
from app.services.vector_store import query_classroom_vector_db, query_global_vector_db
from app.utils.deps import get_current_user

router = APIRouter(prefix="/api/ai", tags=["AI"])


# ---------------------------------------------------------------------------
# Chat endpoint: Dual Vector Database (Classroom Vector DB + Global Vector DB)
# ---------------------------------------------------------------------------

@router.post("/chat", response_model=AIChatResponse)
def document_chat(
    data: DocumentChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    context = ""
    source_names = []

    # 1. Specific Document Scope
    if data.document_id:
        doc = db.query(DocumentFile).filter(DocumentFile.id == data.document_id).first()
        if doc:
            if doc.processing_status and doc.processing_status != "ready":
                return AIChatResponse(
                    answer=f"📄 OCR extraction is in progress for '{doc.filename}'. Please wait until it reaches 100%.",
                    provider_used="System Notice",
                    sources=[doc.filename],
                )
            
            # Fetch from Classroom Vector DB if classroom exists
            classroom = db.query(Classroom).filter(Classroom.id == doc.classroom_id).first() if doc.classroom_id else None
            class_code = classroom.code if classroom else None
            
            if class_code:
                matches = query_classroom_vector_db(class_code, data.question, n_results=5)
                # Filter to this specific doc
                matches = [m for m in matches if m.get("doc_id") == doc.id]
            else:
                matches = []

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

    # 2. Specific Classroom Scope (Classroom Vector DB with Metadata)
    elif data.classroom_id:
        classroom = db.query(Classroom).filter(Classroom.id == data.classroom_id).first()
        class_code = classroom.code if classroom else None

        if class_code:
            class_matches = query_classroom_vector_db(class_code, data.question, n_results=6)
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

        # Fallback to direct DB text if vector DB was empty
        if not context:
            docs = db.query(DocumentFile).filter(DocumentFile.classroom_id == data.classroom_id).all()
            ready_docs = [d for d in docs if not d.processing_status or d.processing_status == "ready"]
            if ready_docs:
                context = "\n---\n".join(d.content_text for d in ready_docs if d.content_text)
                source_names = [d.filename for d in ready_docs]

    # 3. Global Scope ("All Classrooms" - Global Anonymous Vector DB without Metadata)
    else:
        global_matches = query_global_vector_db(data.question, n_results=6)
        if global_matches:
            parts = []
            for i, ch in enumerate(global_matches):
                parts.append(f"[Knowledge Context {i+1}]\n{ch['chunk_text']}")
            context = "\n\n---\n\n".join(parts)
            source_names = ["Global Anonymous Knowledge Base"]
        else:
            # Fallback to all ready notes
            all_docs = db.query(DocumentFile).filter(DocumentFile.processing_status == "ready").limit(10).all()
            if all_docs:
                context = "\n---\n".join(d.content_text for d in all_docs if d.content_text)
                source_names = ["Global Knowledge Base"]

    # 4. Query AI Engine: Exclusively Sarvam AI as Primary
    provider = (data.ai_provider or "sarvam").lower()

    # Prepend strict anonymity instructions for Global scope
    prompt_to_send = data.question
    if not data.classroom_id and not data.document_id:
        prompt_to_send = (
            f"{data.question}\n\n"
            "[Privacy Instruction: Answer the question accurately using ONLY the provided knowledge context. "
            "Never disclose, guess, or mention any classroom codes, teacher names, file origins, or internal metadata.]"
        )

    # Sarvam AI Execution (Primary)
    if provider == "sarvam" or True:  # Sarvam AI is the primary engine
        answer = query_sarvam_ai(prompt=prompt_to_send, context=context)
        used = "Sarvam AI (sarvam-105b-conversations)"
        
        # Safe fallback cascade only if Sarvam is down / quota exhausted
        if not is_valid_ai_text(answer):
            print("[Fallback] Sarvam unavailable, cascading to Groq...")
            answer = query_groq_ai(prompt=prompt_to_send, context=context)
            used = "Groq AI (LLaMA 3.3 70B)"
        if not is_valid_ai_text(answer):
            print("[Fallback] Groq unavailable, cascading to Gemini...")
            answer = query_gemini_ai(prompt=prompt_to_send, context=context)
            used = "Gemini AI (gemini-2.5-flash)"

    # Final safety guard
    if not is_valid_ai_text(answer):
        answer = (
            "All AI engines are temporarily unavailable. "
            "Please try again in a few seconds. 🙏"
        )
        used = "System Notice"

    return AIChatResponse(answer=answer, provider_used=used, sources=source_names)

    return AIChatResponse(answer=answer, provider_used=used, sources=source_names)


# ---------------------------------------------------------------------------
# Summary endpoint
# ---------------------------------------------------------------------------

@router.post("/summary")
def get_summary(
    data: DocumentSummaryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = db.query(DocumentFile).filter(DocumentFile.id == data.document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.processing_status and doc.processing_status != "ready":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document OCR is still processing. Please wait until it reaches 100% before generating a summary.",
        )
    summary = generate_document_summary(context=doc.content_text or "", summary_type=data.summary_type)
    return {"document_id": doc.id, "filename": doc.filename, "summary": summary}
