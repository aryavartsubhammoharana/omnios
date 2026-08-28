from pydantic import BaseModel
from typing import Optional, List

class DocumentChatRequest(BaseModel):
    document_id: Optional[int] = None
    classroom_id: Optional[int] = None
    question: str
    ai_provider: Optional[str] = "gemini"  # 'gemini' or 'sarvam'

class DocumentSummaryRequest(BaseModel):
    document_id: int
    summary_type: Optional[str] = "bullet"  # 'bullet', 'detailed', 'study_guide'

class AIChatResponse(BaseModel):
    answer: str
    provider_used: str
    sources: Optional[List[str]] = []
