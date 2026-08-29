import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base

class ImageRecord(Base):
    __tablename__ = "images"

    image_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file_id = Column(Integer, ForeignKey("document_files.id", ondelete="CASCADE"), nullable=False)
    classroom_id = Column(Integer, ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=True)
    page_number = Column(Integer, nullable=False)
    image_path = Column(String, nullable=False)
    analysis_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ImageBatch(Base):
    __tablename__ = "image_batches"

    batch_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file_id = Column(Integer, ForeignKey("document_files.id", ondelete="CASCADE"), nullable=False)
    classroom_id = Column(Integer, ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=True)
    page_number = Column(Integer, nullable=False)
    merged_image_path = Column(String, nullable=False)
    image_count = Column(Integer, nullable=False)
    local_image_ids = Column(JSONB().with_variant(JSON, "sqlite"), nullable=False)
    raw_response = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
