from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Date
from app.database import Base
from app.utils.time_utils import get_ist_now

class StudentStreak(Base):
    __tablename__ = "student_streaks"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    current_streak = Column(Integer, default=0, nullable=False)
    longest_streak = Column(Integer, default=0, nullable=False)
    last_active_date = Column(Date, nullable=True)
    total_study_seconds = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=get_ist_now)

class StudySession(Base):
    __tablename__ = "study_sessions"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(Integer, ForeignKey("document_files.id", ondelete="CASCADE"), nullable=False, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False, index=True)
    time_spent_seconds = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=get_ist_now)

class VideoFocusSession(Base):
    __tablename__ = "video_focus_sessions"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    video_id = Column(String, nullable=False, index=True)
    video_title = Column(String, nullable=False)
    weak_topic = Column(String, nullable=True)
    watch_seconds = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=get_ist_now)
