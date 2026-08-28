from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class ClassroomCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ClassroomUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class JoinClassroom(BaseModel):
    code: str

class PostCreate(BaseModel):
    content: str

class PostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    classroom_id: int
    author_id: int
    author_name: Optional[str] = None
    content: str
    created_at: datetime

class ClassroomOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str]
    code: str
    teacher_id: int
    teacher_name: Optional[str] = None
    created_at: datetime
