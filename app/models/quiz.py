from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, JSON, Float, Boolean, Date
from app.database import Base

class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    questions_json = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    score = Column(Float, nullable=False)
    max_score = Column(Float, nullable=False)
    answers_json = Column(JSON, nullable=False)
    completed_at = Column(DateTime, default=datetime.utcnow)


class StudentDailyQuiz(Base):
    __tablename__ = "daily_quizzes"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    quiz_date = Column(Date, default=date.today, nullable=False, index=True)
    title = Column(String, nullable=False)
    questions_json = Column(JSON, nullable=False)
    user_answers_json = Column(JSON, nullable=True)
    score = Column(Float, nullable=True)
    max_score = Column(Float, nullable=True)
    is_completed = Column(Boolean, default=False, nullable=False)
    weak_topics = Column(JSON, nullable=True)
    recommendations_json = Column(JSON, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
