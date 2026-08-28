from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, JSON
from app.database import Base

class DocumentChunk(Base):
    """Stores text chunks and 768-d vector embeddings for RAG semantic search."""
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("document_files.id", ondelete="CASCADE"), nullable=False, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=True, index=True)
    chunk_index = Column(Integer, nullable=False)
    chunk_text = Column(Text, nullable=False)
    char_start = Column(Integer, nullable=True)
    char_end = Column(Integer, nullable=True)
    embedding = Column(JSON, nullable=True)  # 768-d float array stored as JSON
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

