from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, default="student", nullable=False)
    student_class = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    auth_provider = Column(String, default="local", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
