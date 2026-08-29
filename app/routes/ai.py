from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.file import DocumentFile
from app.schemas.ai import DocumentChatRequest, DocumentSummaryRequest, AIChatResponse
from app.services.ai import query_gemini_ai, query_sarvam_ai, generate_document_summary, is_valid_ai_text
from app.services.vector_store import query_chroma_rag
from app.utils.deps import get_current_user

router = APIRouter(prefix="/api/ai", tags=["AI"])


# ---------------------------------------------------------------------------
# Chat endpoint
# ---------------------------------------------------------------------------

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
        if doc:
            if doc.processing_status and doc.processing_status != "ready":
                return AIChatResponse(
                    answer=f"📄 OCR extraction is in progress for '{doc.filename}'. Please wait until it reaches 100%.",
                    provider_used="System Notice",
                    sources=[doc.filename],
                )
            chroma_matches = query_chroma_rag(data.question, doc_id=doc.id, n_results=5)
            if chroma_matches:
                parts = []
                for i, ch in enumerate(chroma_matches):
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
        docs = db.query(DocumentFile).filter(DocumentFile.classroom_id == data.classroom_id).all()
        ready_docs = [d for d in docs if not d.processing_status or d.processing_status == "ready"]
        if not ready_docs and docs:
            return AIChatResponse(
                answer="📄 OCR extraction is in progress for classroom documents. Please wait until all reach 100%.",
                provider_used="System Notice",
                sources=[d.filename for d in docs],
            )
        chroma_matches = query_chroma_rag(data.question, classroom_id=data.classroom_id, n_results=6)
        if chroma_matches:
            parts = []
            for i, ch in enumerate(chroma_matches):
                idx = ch.get("chunk_index", i) + 1
                fname = ch.get("filename", "Classroom Note")
                parts.append(f"[Source {i+1}: {fname} (Chunk #{idx})]\n{ch['chunk_text']}")
                label = f"{fname} (Chunk #{idx})"
                if label not in source_names:
                    source_names.append(label)
            context = "\n\n---\n\n".join(parts)
        else:
            context = "\n---\n".join(d.content_text for d in ready_docs if d.content_text)
            source_names = [d.filename for d in ready_docs]

    # Query the selected provider with cross-provider fallback
    provider = (data.ai_provider or "gemini").lower()
    if provider == "sarvam":
        answer = query_sarvam_ai(prompt=data.question, context=context)
        used = "Sarvam AI (sarvam-105b-conversations)"
        if not is_valid_ai_text(answer):
            answer = query_gemini_ai(prompt=data.question, context=context)
            used = "Gemini AI (gemini-2.5-flash)"
    else:
        answer = query_gemini_ai(prompt=data.question, context=context)
        used = "Gemini AI (gemini-2.5-flash)"
        if not is_valid_ai_text(answer):
            answer = query_sarvam_ai(prompt=data.question, context=context)
            used = "Sarvam AI (sarvam-105b-conversations)"

    # Final safety guard — never expose raw error strings to the user
    if not is_valid_ai_text(answer):
        answer = (
            "Both AI engines are temporarily unavailable (rate limit or timeout). "
            "Please try again in a few seconds, or toggle the **Engine** at the top right. 🙏"
        )
        used = "System Notice"

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
