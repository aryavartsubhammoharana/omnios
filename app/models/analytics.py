from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Date
from app.database import Base


class StudentStreak(Base):
    """Tracks daily consecutive study streaks for gamification."""
    __tablename__ = "student_streaks"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    current_streak = Column(Integer, default=0, nullable=False)
    longest_streak = Column(Integer, default=0, nullable=False)
    last_active_date = Column(Date, nullable=True)
    total_study_seconds = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class StudySession(Base):
    """Logs individual document study/view sessions for analytics."""
    __tablename__ = "study_sessions"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    document_id = Column(Integer, ForeignKey("document_files.id"), nullable=False, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"), nullable=False, index=True)
    time_spent_seconds = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
