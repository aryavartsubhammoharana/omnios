from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.file import DocumentFile
from app.schemas.ai import DocumentChatRequest, DocumentSummaryRequest, AIChatResponse
from app.services.ai import query_gemini_ai, query_sarvam_ai, generate_document_summary
from app.utils.deps import get_current_user

router = APIRouter(prefix="/api/ai", tags=["AI"])

@router.post("/chat", response_model=AIChatResponse)
def document_chat(data: DocumentChatRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    context = ""
    source_names = []
    
    if data.document_id:
        doc = db.query(DocumentFile).filter(DocumentFile.id == data.document_id).first()
        if doc:
            if doc.processing_status and doc.processing_status != 'ready':
                return AIChatResponse(
                    answer=f"📄 GPU OCR & Gemini AI Text Extraction is currently in progress (75% for '{doc.filename}'). Please wait a moment until OCR is 100% ready before asking questions.",
                    provider_used="System Notice",
                    sources=[doc.filename]
                )
            context = doc.content_text or ""
            source_names.append(doc.filename)
    elif data.classroom_id:
        docs = db.query(DocumentFile).filter(DocumentFile.classroom_id == data.classroom_id).all()
        # Filter only ready docs
        ready_docs = [d for d in docs if not d.processing_status or d.processing_status == 'ready']
        if not ready_docs and docs:
            return AIChatResponse(
                answer="📄 GPU OCR & Gemini AI Text Extraction is currently in progress for classroom documents. Please wait a moment until OCR is 100% ready before asking questions.",
                provider_used="System Notice",
                sources=[d.filename for d in docs]
            )
        texts = [d.content_text for d in ready_docs if d.content_text]
        context = "\n---\n".join(texts)
        source_names = [d.filename for d in ready_docs]
    
    provider = (data.ai_provider or "gemini").lower()
    if provider == "sarvam":
        answer = query_sarvam_ai(prompt=data.question, context=context)
        used = "Sarvam AI (sarvam-105b-conversations)"
    else:
        answer = query_gemini_ai(prompt=data.question, context=context)
        used = "Gemini AI (gemini-2.5-flash)"
    
    return AIChatResponse(
        answer=answer,
        provider_used=used,
        sources=source_names
    )

@router.post("/summary")
def get_summary(data: DocumentSummaryRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.query(DocumentFile).filter(DocumentFile.id == data.document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if doc.processing_status and doc.processing_status != 'ready':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="📄 Document OCR is currently processing (75%). Please wait until OCR extraction is 100% ready before generating summary."
        )

    summary = generate_document_summary(context=doc.content_text or "", summary_type=data.summary_type)
    return {
        "document_id": doc.id,
        "filename": doc.filename,
        "summary": summary
    }
