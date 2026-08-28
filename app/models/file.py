from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from app.database import Base

class DocumentFile(Base):
    __tablename__ = "document_files"

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"), nullable=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    content_text = Column(Text, nullable=True)
    processing_status = Column(String, default="ready")  # 'processing' (50%) or 'ready' (100%)
    processing_progress = Column(Integer, default=100)
    created_at = Column(DateTime, default=datetime.utcnow)
