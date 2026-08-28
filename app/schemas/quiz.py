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
    title: str = "AI Practice Quiz"
    num_questions: int = 5

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

    id: int
    quiz_id: int
    student_id: int
    score: float
    max_score: float
    answers_json: Dict[str, Any]
    attempted_at: datetime
