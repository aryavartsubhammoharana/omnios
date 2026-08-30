from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from app.database import Base
from app.utils.time_utils import get_ist_now

class DocumentFile(Base):
    __tablename__ = "document_files"

    id = Column(Integer, primary_key=True, index=True)
    unique_code = Column(String(10), unique=True, index=True, nullable=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"), nullable=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    folder_name = Column(String, default="General Notes", nullable=True)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    content_text = Column(Text, nullable=True)
    processing_status = Column(String, default="ready")
    processing_progress = Column(Integer, default=100)
    created_at = Column(DateTime, default=get_ist_now)
