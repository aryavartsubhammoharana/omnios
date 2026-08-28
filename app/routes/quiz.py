from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.file import DocumentFile
from app.models.quiz import Quiz, QuizAttempt
from app.schemas.quiz import QuizCreateFromDoc, QuizManualCreate, QuizOut, QuizAttemptSubmit, QuizAttemptOut
from app.services.ai import generate_quiz_questions
from app.services.extractor import extract_text_from_file
from app.utils.deps import get_current_user

router = APIRouter(prefix="/api/quiz", tags=["Quiz"])

@router.post("/generate", response_model=QuizOut)
def generate_quiz(data: QuizCreateFromDoc, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can generate quizzes")

    # Fetch all uploaded documents in this specific classroom
    docs = db.query(DocumentFile).filter(DocumentFile.classroom_id == data.classroom_id).all()
    if not docs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No study notes or PDF documents found in this classroom. Please upload a PDF or study note first before generating an AI quiz."
        )

    # Re-extract text if content_text was empty
    texts = []
    for d in docs:
        if not d.content_text or not d.content_text.strip():
            extracted = extract_text_from_file(d.file_path)
            d.content_text = extracted
            db.commit()
        texts.append(f"Document File ({d.filename}):\n{d.content_text}")

    context = "\n---\n".join(texts)

    questions = generate_quiz_questions(context=context, num_questions=data.num_questions)
    
    quiz = Quiz(
        classroom_id=data.classroom_id,
        created_by_id=current_user.id,
        title=data.title,
        description=f"AI Generated practice paper based exclusively on uploaded classroom study notes ({len(questions)} Questions)",
        questions_json=questions
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz

@router.post("/manual", response_model=QuizOut)
def create_manual_quiz(data: QuizManualCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can create quizzes")

    questions_list = [q.model_dump() for q in data.questions]

    quiz = Quiz(
        classroom_id=data.classroom_id,
        created_by_id=current_user.id,
        title=data.title,
        description=data.description or f"Teacher created practice quiz ({len(questions_list)} Questions)",
        questions_json=questions_list
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz

@router.delete("/{quiz_id}")
def delete_quiz(quiz_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can delete quizzes")

    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Delete attempt records first
    db.query(QuizAttempt).filter(QuizAttempt.quiz_id == quiz_id).delete()
    db.delete(quiz)
    db.commit()
    return {"message": "Quiz deleted successfully", "quiz_id": quiz_id}

@router.get("/list/{classroom_id}", response_model=List[QuizOut])
def list_quizzes(classroom_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    quizzes = db.query(Quiz).filter(Quiz.classroom_id == classroom_id).order_by(Quiz.created_at.desc()).all()
    return quizzes

@router.get("/{quiz_id}", response_model=QuizOut)
def get_quiz(quiz_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz

@router.post("/submit", response_model=QuizAttemptOut)
def submit_quiz_attempt(data: QuizAttemptSubmit, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.id == data.quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    questions = quiz.questions_json
    max_score = len(questions)
    score = 0.0
    detailed_answers = {}

    for idx, q in enumerate(questions):
        q_id = q.get("id", idx + 1)
        correct_idx = q.get("correct_index", 0)
        user_chosen = data.user_answers.get(q_id, data.user_answers.get(str(q_id)))
        
        is_correct = (user_chosen is not None and int(user_chosen) == int(correct_idx))
        if is_correct:
            score += 1.0
        
        detailed_answers[str(q_id)] = {
            "chosen": user_chosen,
            "correct": correct_idx,
            "is_correct": is_correct,
            "explanation": q.get("explanation", "")
        }

    attempt = QuizAttempt(
        quiz_id=quiz.id,
        student_id=current_user.id,
        score=score,
        max_score=max_score,
        answers_json=detailed_answers
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt

@router.get("/attempts/{quiz_id}", response_model=List[QuizAttemptOut])
def get_user_attempts(quiz_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    attempts = db.query(QuizAttempt).filter(
        QuizAttempt.quiz_id == quiz_id,
        QuizAttempt.student_id == current_user.id
    ).all()
    return attempts
