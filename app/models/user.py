from sqlalchemy import Column, Integer, String, DateTime, Boolean
from app.database import Base
from app.utils.time_utils import get_ist_now

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)
    full_name = Column(String, nullable=False)
    role = Column(String, default="student", nullable=False)
    student_class = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    google_id = Column(String, unique=True, index=True, nullable=True)
    auth_provider = Column(String, default="local", nullable=False)
    is_verified = Column(Boolean, default=True, nullable=False)
    is_role_confirmed = Column(Boolean, default=False, nullable=False)
    verification_otp = Column(String, nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=get_ist_now)
