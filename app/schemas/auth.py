from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "student"
    student_class: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GoogleAuthRequest(BaseModel):
    credential: Optional[str] = None
    access_token: Optional[str] = None
    role: Optional[str] = "student"
    student_class: Optional[str] = None

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    student_class: Optional[str] = None
    role: Optional[str] = None

class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    student_class: Optional[str] = None
    avatar_url: Optional[str] = None
    auth_provider: Optional[str] = "local"
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
