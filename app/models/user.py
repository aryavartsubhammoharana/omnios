from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum as SQLEnum
import enum
from app.database import Base

class UserRole(str, enum.Enum):
    TEACHER = "teacher"
    STUDENT = "student"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, default="student", nullable=False)  # 'teacher' or 'student'
    created_at = Column(DateTime, default=datetime.utcnow)
