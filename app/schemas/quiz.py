from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime

class QuestionItem(BaseModel):
    id: int
    question: str
    options: List[str]
    correct_index: int
    explanation: Optional[str] = ""
    sub_topic: Optional[str] = "General"

class QuizManualCreate(BaseModel):
    classroom_id: int
    title: str
    description: Optional[str] = ""
    questions: List[QuestionItem]

class QuizCreateFromDoc(BaseModel):
    classroom_id: int
    document_id: Optional[int] = None
    document_ids: Optional[List[int]] = None
    title: str = "AI Practice Quiz"
    num_questions: int = 5
    difficulty: int = 5

class QuizOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    classroom_id: int
    created_by_id: int
    title: str
    description: Optional[str]
    questions_json: List[Any]
    created_at: datetime

class QuizAttemptSubmit(BaseModel):
    quiz_id: int
    user_answers: Dict[str, Any]

class QuizAttemptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[int] = None
    quiz_id: int
    student_id: int
    score: float
    max_score: float
    answers_json: Dict[str, Any]
    is_first_attempt: bool = True
    official_score: Optional[float] = None
    completed_at: Optional[datetime] = None
    attempted_at: Optional[datetime] = None

class StudentSubmissionItem(BaseModel):
    student_id: int
    student_name: str
    student_email: str
    has_attempted: bool
    first_attempt_score: Optional[float] = None
    max_score: Optional[float] = None
    percentage: Optional[float] = None
    completed_at: Optional[datetime] = None

class QuizAnalyticsOut(BaseModel):
    quiz_id: int
    quiz_title: str
    max_score: float
    total_students: int
    attempted_count: int
    pending_count: int
    average_score: Optional[float] = None
    submissions: List[StudentSubmissionItem]


