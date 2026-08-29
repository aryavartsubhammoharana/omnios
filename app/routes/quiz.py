from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.user import User
from app.models.file import DocumentFile
from app.models.quiz import Quiz, QuizAttempt
from app.models.classroom import Classroom, Enrollment
from app.schemas.quiz import (
    QuizCreateFromDoc, QuizManualCreate, QuizOut,
    QuizAttemptSubmit, QuizAttemptOut, QuizAnalyticsOut, StudentSubmissionItem
)
from app.services.ai import generate_quiz_questions
from app.services.extractor import extract_text_from_file
from app.utils.deps import get_current_user

router = APIRouter(prefix="/api/quiz", tags=["Quiz"])


# ---------------------------------------------------------------------------
# 1. AI Quiz Generation (with Difficulty 1-10 & Custom Note Selection)
# ---------------------------------------------------------------------------

@router.post("/generate", response_model=QuizOut)
def generate_quiz(
    data: QuizCreateFromDoc,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can generate quizzes")

    # Filter documents based on teacher's selection (specific document_ids or single document_id or all)
    query = db.query(DocumentFile).filter(DocumentFile.classroom_id == data.classroom_id)
    if data.document_ids and len(data.document_ids) > 0:
        query = query.filter(DocumentFile.id.in_(data.document_ids))
    elif data.document_id:
        query = query.filter(DocumentFile.id == data.document_id)

    docs = query.all()
    if not docs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No matching study notes or PDF documents found. Please select at least one uploaded document.",
        )

    # Extract list of texts from all selected notes
    notes_list = []
    for d in docs:
        if not d.content_text or not d.content_text.strip():
            extracted = extract_text_from_file(d.file_path)
            d.content_text = extracted
            db.commit()
        if d.content_text and d.content_text.strip():
            notes_list.append(f"Document File ({d.filename}):\n{d.content_text}")

    # Fetch previously created quizzes in this classroom to avoid question repetition
    prev_quizzes = db.query(Quiz).filter(Quiz.classroom_id == data.classroom_id).all()
    previous_questions = []
    for pz in prev_quizzes:
        if pz.questions_json and isinstance(pz.questions_json, list):
            previous_questions.extend(pz.questions_json)

    # Generate questions via Groq with calibrated difficulty & competency
    questions = generate_quiz_questions(
        notes_list=notes_list,
        num_questions=data.num_questions,
        difficulty=data.difficulty or 5,
        competency_percentage=data.competency_percentage or 50,
        previous_quizzes_json=previous_questions if len(previous_questions) > 0 else None
    )

    diff_label = f"Difficulty: {data.difficulty or 5}/10"
    comp_label = f"Competency: {data.competency_percentage or 50}%"
    quiz = Quiz(
        classroom_id=data.classroom_id,
        created_by_id=current_user.id,
        title=data.title,
        description=f"AI Generated practice paper ({len(questions)} Questions | {diff_label} | {comp_label})",
        questions_json=questions,
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz


# ---------------------------------------------------------------------------
# 2. Manual Quiz Creation
# ---------------------------------------------------------------------------

@router.post("/manual", response_model=QuizOut)
def create_manual_quiz(
    data: QuizManualCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can create quizzes")

    questions_list = [q.model_dump() for q in data.questions]

    quiz = Quiz(
        classroom_id=data.classroom_id,
        created_by_id=current_user.id,
        title=data.title,
        description=data.description or f"Teacher created practice quiz ({len(questions_list)} Questions)",
        questions_json=questions_list,
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz


# ---------------------------------------------------------------------------
# 3. Delete Quiz
# ---------------------------------------------------------------------------

@router.delete("/{quiz_id}")
def delete_quiz(
    quiz_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can delete quizzes")

    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    db.query(QuizAttempt).filter(QuizAttempt.quiz_id == quiz_id).delete()
    db.delete(quiz)
    db.commit()
    return {"message": "Quiz deleted successfully", "quiz_id": quiz_id}


# ---------------------------------------------------------------------------
# 4. List & Get Quizzes
# ---------------------------------------------------------------------------

@router.get("/list/{classroom_id}", response_model=List[QuizOut])
def list_quizzes(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(Quiz).filter(Quiz.classroom_id == classroom_id).order_by(Quiz.created_at.desc()).all()


@router.get("/{quiz_id}", response_model=QuizOut)
def get_quiz(
    quiz_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz


# ---------------------------------------------------------------------------
# 5. Quiz Submission (Strict First-Attempt DB Lock & Practice Retake Sandbox)
# ---------------------------------------------------------------------------

@router.post("/submit", response_model=QuizAttemptOut)
def submit_quiz_attempt(
    data: QuizAttemptSubmit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    quiz = db.query(Quiz).filter(Quiz.id == data.quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    questions = quiz.questions_json or []
    max_score = float(len(questions))
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
            "explanation": q.get("explanation", ""),
        }

    # Check if this student has ALREADY submitted their official first attempt
    existing_first = db.query(QuizAttempt).filter(
        QuizAttempt.quiz_id == data.quiz_id,
        QuizAttempt.student_id == current_user.id
    ).order_by(QuizAttempt.id.asc()).first()

    if existing_first:
        # RETAKE / PRACTICE MODE:
        # Return immediate feedback to the student without modifying the DB!
        # The database preserves ONLY the first attempt for teacher grading.
        return QuizAttemptOut(
            id=existing_first.id,
            quiz_id=quiz.id,
            student_id=current_user.id,
            score=score,
            max_score=max_score,
            answers_json=detailed_answers,
            is_first_attempt=False,
            official_score=existing_first.score,
            completed_at=existing_first.completed_at,
            attempted_at=existing_first.completed_at,
        )

    # OFFICIAL FIRST ATTEMPT:
    # Permanently write to PostgreSQL database!
    attempt = QuizAttempt(
        quiz_id=quiz.id,
        student_id=current_user.id,
        score=score,
        max_score=max_score,
        answers_json=detailed_answers,
        completed_at=datetime.utcnow()
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    return QuizAttemptOut(
        id=attempt.id,
        quiz_id=quiz.id,
        student_id=current_user.id,
        score=score,
        max_score=max_score,
        answers_json=detailed_answers,
        is_first_attempt=True,
        official_score=score,
        completed_at=attempt.completed_at,
        attempted_at=attempt.completed_at,
    )


# ---------------------------------------------------------------------------
# 6. Student Attempts History
# ---------------------------------------------------------------------------

@router.get("/attempts/{quiz_id}", response_model=List[QuizAttemptOut])
def get_user_attempts(
    quiz_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    attempts = db.query(QuizAttempt).filter(
        QuizAttempt.quiz_id == quiz_id,
        QuizAttempt.student_id == current_user.id,
    ).order_by(QuizAttempt.id.asc()).all()

    return [
        QuizAttemptOut(
            id=a.id,
            quiz_id=a.quiz_id,
            student_id=a.student_id,
            score=a.score,
            max_score=a.max_score,
            answers_json=a.answers_json,
            is_first_attempt=True,
            official_score=a.score,
            completed_at=a.completed_at,
            attempted_at=a.completed_at,
        )
        for a in attempts
    ]


# ---------------------------------------------------------------------------
# 7. Teacher Analytics: Submissions Roster (Attempted vs Pending & Scores)
# ---------------------------------------------------------------------------

@router.get("/{quiz_id}/analytics", response_model=QuizAnalyticsOut)
def get_quiz_analytics(
    quiz_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can view quiz submission analytics")

    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Fetch all enrolled students in this classroom
    enrollments = db.query(Enrollment).filter(Enrollment.classroom_id == quiz.classroom_id).all()
    student_ids = [e.student_id for e in enrollments]

    students = db.query(User).filter(User.id.in_(student_ids)).all() if student_ids else []

    # Fetch all attempts for this quiz
    attempts = db.query(QuizAttempt).filter(QuizAttempt.quiz_id == quiz_id).order_by(QuizAttempt.id.asc()).all()
    
    # Map each student to their FIRST attempt
    first_attempts_map = {}
    for att in attempts:
        if att.student_id not in first_attempts_map:
            first_attempts_map[att.student_id] = att

    submissions = []
    attempted_count = 0
    total_scores = 0.0
    max_q_score = float(len(quiz.questions_json or [])) or 1.0

    for s in students:
        att = first_attempts_map.get(s.id)
        if att:
            attempted_count += 1
            total_scores += att.score
            pct = round((att.score / max(1.0, att.max_score)) * 100, 1)
            submissions.append(StudentSubmissionItem(
                student_id=s.id,
                student_name=s.full_name or s.email.split("@")[0],
                student_email=s.email,
                has_attempted=True,
                first_attempt_score=att.score,
                max_score=att.max_score,
                percentage=pct,
                completed_at=att.completed_at,
            ))
        else:
            submissions.append(StudentSubmissionItem(
                student_id=s.id,
                student_name=s.full_name or s.email.split("@")[0],
                student_email=s.email,
                has_attempted=False,
                first_attempt_score=None,
                max_score=max_q_score,
                percentage=None,
                completed_at=None,
            ))

    # Sort: Attempted students first (highest score descending), then Pending students
    submissions.sort(key=lambda x: (not x.has_attempted, -(x.first_attempt_score or 0.0), x.student_name))

    total_students = len(students)
    pending_count = total_students - attempted_count
    avg_score = round(total_scores / attempted_count, 1) if attempted_count > 0 else None

    return QuizAnalyticsOut(
        quiz_id=quiz.id,
        quiz_title=quiz.title,
        max_score=max_q_score,
        total_students=total_students,
        attempted_count=attempted_count,
        pending_count=pending_count,
        average_score=avg_score,
        submissions=submissions,
    )
