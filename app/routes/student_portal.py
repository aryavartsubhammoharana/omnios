import json
import re
from datetime import datetime, date
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.classroom import Classroom, Enrollment
from app.models.file import DocumentFile
from app.models.quiz import StudentDailyQuiz
from app.models.analytics import StudentStreak, VideoFocusSession
from app.routes.auth import get_current_user
from app.services.ai import query_groq_ai
from app.services.youtube_service import get_curated_weak_topic_videos, get_video_transcript
from app.utils.time_utils import get_ist_now

router = APIRouter(prefix="/api/student", tags=["Student AI Portal"])

class DailyQuizSubmitRequest(BaseModel):
    quiz_id: int
    user_answers: Dict[str, int]

class VideoFocusTrackRequest(BaseModel):
    video_id: str
    video_title: str
    weak_topic: Optional[str] = None
    watch_seconds: int = 30


@router.get("/daily-quiz")
def get_or_generate_daily_quiz(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Daily autonomous diagnostic quizzes are exclusive to students."
        )

    today = date.today()
    existing_quiz = db.query(StudentDailyQuiz).filter(
        StudentDailyQuiz.student_id == current_user.id,
        StudentDailyQuiz.quiz_date == today
    ).first()

    if existing_quiz:
        return {
            "id": existing_quiz.id,
            "student_id": existing_quiz.student_id,
            "quiz_date": str(existing_quiz.quiz_date),
            "title": existing_quiz.title,
            "questions": existing_quiz.questions_json,
            "is_completed": existing_quiz.is_completed,
            "score": existing_quiz.score,
            "max_score": existing_quiz.max_score,
            "user_answers": existing_quiz.user_answers_json,
            "weak_topics": existing_quiz.weak_topics or [],
            "recommendations": existing_quiz.recommendations_json or [],
            "completed_at": existing_quiz.completed_at
        }

    enrollments = db.query(Enrollment).filter(Enrollment.student_id == current_user.id).all()
    class_ids = [e.classroom_id for e in enrollments]

    enrolled_classes = db.query(Classroom).filter(Classroom.id.in_(class_ids)).all() if class_ids else []
    class_names = [c.name for c in enrolled_classes]
    class_context = ", ".join(class_names) if class_names else "General Academic Studies"

    docs = db.query(DocumentFile).filter(
        DocumentFile.classroom_id.in_(class_ids)
    ).order_by(DocumentFile.created_at.desc()).limit(8).all() if class_ids else []

    notes_text = ""
    for d in docs:
        if d.content_text:
            notes_text += f"\n--- Material from {d.filename} ---\n{d.content_text[:2000]}\n"

    if not notes_text.strip():
        notes_text = f"Curriculum and core concepts for enrolled subjects: {class_context}."

    prompt = (
        f"You are an AI diagnostic assessment engine for student {current_user.full_name or 'Student'}.\n"
        f"Enrolled Courses: {class_context}\n\n"
        f"Generate exactly 6 diagnostic multiple-choice questions testing core concepts from these study notes:\n"
        f"{notes_text[:4000]}\n\n"
        f"CRITICAL REQUIREMENTS:\n"
        f"1. Each question must test a specific conceptual topic.\n"
        f"2. Return ONLY a valid JSON array of objects with keys:\n"
        f'   - "id": number (1 to 6)\n'
        f'   - "question": string\n'
        f'   - "options": array of 4 distinct string choices\n'
        f'   - "correct_index": integer (0, 1, 2, or 3)\n'
        f'   - "topic": concise 2-4 word topic tag (e.g. "Thermodynamics Carnot Cycle", "Newton Second Law", "Calculus Integration")\n'
        f'   - "explanation": brief explanation of why the correct answer is right.\n'
        f"Output pure JSON only, no markdown ticks, no commentary."
    )

    ai_response = query_groq_ai(prompt=prompt)
    
    questions = []
    try:
        clean_json = re.sub(r"^```json\s*", "", ai_response.strip(), flags=re.MULTILINE)
        clean_json = re.sub(r"^```\s*", "", clean_json, flags=re.MULTILINE)
        clean_json = re.sub(r"```$", "", clean_json.strip(), flags=re.MULTILINE).strip()
        match = re.search(r"\[\s*\{.*\}\s*\]", clean_json, re.DOTALL)
        if match:
            clean_json = match.group(0)
        parsed = json.loads(clean_json)
        if isinstance(parsed, list) and len(parsed) > 0:
            questions = parsed
    except Exception as e:
        print(f"Error parsing AI diagnostic questions: {e}")

    if not questions:
        questions = [
            {
                "id": 1,
                "question": f"Which fundamental principle is central to {class_names[0] if class_names else 'General Science'}?",
                "options": ["Conservation of Energy", "Static Equilibrium Only", "Linear Decay", "Random Fluctuations"],
                "correct_index": 0,
                "topic": "Fundamental Conservation Laws",
                "explanation": "Conservation of Energy applies universally across physical sciences."
            },
            {
                "id": 2,
                "question": "What is the primary method for validating mathematical models?",
                "options": ["Intuition only", "Empirical testing and deductive proof", "Arbitrary consensus", "Ignoring boundary conditions"],
                "correct_index": 1,
                "topic": "Mathematical Verification",
                "explanation": "Deductive proofs and empirical testing validate mathematical formulations."
            },
            {
                "id": 3,
                "question": "In scientific problem solving, why are boundary conditions evaluated?",
                "options": ["To eliminate all variables", "To test model behavior at extremes", "To avoid calculating constants", "They have no effect"],
                "correct_index": 1,
                "topic": "Boundary Condition Analysis",
                "explanation": "Evaluating boundary conditions ensures equations behave realistically at extreme values."
            }
        ]

    daily_quiz = StudentDailyQuiz(
        student_id=current_user.id,
        quiz_date=today,
        title=f"Daily AI Diagnostic Practice — {today.strftime('%d %b %Y')}",
        questions_json=questions,
        is_completed=False,
    )
    db.add(daily_quiz)
    db.commit()
    db.refresh(daily_quiz)

    return {
        "id": daily_quiz.id,
        "student_id": daily_quiz.student_id,
        "quiz_date": str(daily_quiz.quiz_date),
        "title": daily_quiz.title,
        "questions": daily_quiz.questions_json,
        "is_completed": daily_quiz.is_completed,
        "score": None,
        "max_score": float(len(questions)),
        "user_answers": None,
        "weak_topics": [],
        "recommendations": [],
        "completed_at": None
    }


@router.post("/daily-quiz/submit")
def submit_daily_quiz(
    data: DailyQuizSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    quiz = db.query(StudentDailyQuiz).filter(
        StudentDailyQuiz.id == data.quiz_id,
        StudentDailyQuiz.student_id == current_user.id
    ).first()

    if not quiz:
        raise HTTPException(status_code=404, detail="Daily quiz not found.")

    questions = quiz.questions_json or []
    max_score = float(len(questions))
    score = 0.0

    weak_topics_set = set()
    detailed_answers = {}

    for idx, q in enumerate(questions):
        q_id = q.get("id", idx + 1)
        correct_idx = q.get("correct_index", 0)
        topic = q.get("topic", "General Topic")
        user_chosen = data.user_answers.get(str(q_id), data.user_answers.get(int(q_id) if str(q_id).isdigit() else q_id))

        is_correct = (user_chosen is not None and int(user_chosen) == int(correct_idx))
        if is_correct:
            score += 1.0
        else:
            weak_topics_set.add(topic)

        detailed_answers[str(q_id)] = {
            "chosen": user_chosen,
            "correct": correct_idx,
            "is_correct": is_correct,
            "topic": topic,
            "explanation": q.get("explanation", "")
        }

    weak_topics_list = list(weak_topics_set)
    if not weak_topics_list:
        weak_topics_list = [q.get("topic", "Advanced Concept") for q in questions[:2]]

    enrollments = db.query(Enrollment).filter(Enrollment.student_id == current_user.id).all()
    class_ids = [e.classroom_id for e in enrollments]
    enrolled_classes = db.query(Classroom).filter(Classroom.id.in_(class_ids)).all() if class_ids else []
    class_names = [c.name for c in enrolled_classes]
    grade_context = f"Class {' '.join(class_names)}" if class_names else "High School / College"

    recommendations = get_curated_weak_topic_videos(
        weak_topics=weak_topics_list,
        grade_context=grade_context,
        target_count=10
    )

    quiz.user_answers_json = detailed_answers
    quiz.score = score
    quiz.max_score = max_score
    quiz.is_completed = True
    quiz.weak_topics = weak_topics_list
    quiz.recommendations_json = recommendations
    quiz.completed_at = get_ist_now()
    db.commit()

    ist_today = get_ist_now().date()
    streak = db.query(StudentStreak).filter(StudentStreak.student_id == current_user.id).first()
    if not streak:
        streak = StudentStreak(
            student_id=current_user.id,
            current_streak=1,
            longest_streak=1,
            last_active_date=ist_today,
            total_study_seconds=300
        )
        db.add(streak)
    else:
        if streak.last_active_date != ist_today:
            streak.current_streak += 1
            if streak.current_streak > streak.longest_streak:
                streak.longest_streak = streak.current_streak
            streak.last_active_date = ist_today
        streak.total_study_seconds += 300
    db.commit()

    return {
        "id": quiz.id,
        "score": score,
        "max_score": max_score,
        "percentage": round((score / max(1.0, max_score)) * 100, 1),
        "detailed_answers": detailed_answers,
        "weak_topics": weak_topics_list,
        "recommendations": recommendations,
        "streak": streak.current_streak if streak else 1,
        "completed_at": quiz.completed_at
    }


@router.get("/recommendations")
def get_active_recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    latest_quiz = db.query(StudentDailyQuiz).filter(
        StudentDailyQuiz.student_id == current_user.id,
        StudentDailyQuiz.is_completed == True
    ).order_by(StudentDailyQuiz.completed_at.desc()).first()

    if latest_quiz and latest_quiz.recommendations_json:
        return {
            "weak_topics": latest_quiz.weak_topics or [],
            "last_quiz_date": str(latest_quiz.quiz_date),
            "recommendations": latest_quiz.recommendations_json
        }

    fallback = get_curated_weak_topic_videos(
        weak_topics=["Problem Solving Technique", "Conceptual Physics & Mathematics"],
        target_count=10
    )
    return {
        "weak_topics": ["General Foundation"],
        "last_quiz_date": None,
        "recommendations": fallback
    }


@router.post("/refresh-recommendations")
def refresh_student_recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    latest_quiz = db.query(StudentDailyQuiz).filter(
        StudentDailyQuiz.student_id == current_user.id,
        StudentDailyQuiz.is_completed == True
    ).order_by(StudentDailyQuiz.completed_at.desc()).first()

    weak_topics_list = latest_quiz.weak_topics if (latest_quiz and latest_quiz.weak_topics) else ["Concept Revision", "Core Problem Solving"]

    enrollments = db.query(Enrollment).filter(Enrollment.student_id == current_user.id).all()
    class_ids = [e.classroom_id for e in enrollments]
    enrolled_classes = db.query(Classroom).filter(Classroom.id.in_(class_ids)).all() if class_ids else []
    class_names = [c.name for c in enrolled_classes]
    grade_context = f"Class {' '.join(class_names)}" if class_names else "High School / College"

    import random
    new_offset = random.randint(1, 10)

    fresh_recommendations = get_curated_weak_topic_videos(
        weak_topics=weak_topics_list,
        grade_context=grade_context,
        target_count=10,
        seed_offset=new_offset
    )

    if latest_quiz:
        latest_quiz.recommendations_json = fresh_recommendations
        db.commit()

    return {
        "message": "Recommendations refreshed successfully",
        "weak_topics": weak_topics_list,
        "recommendations": fresh_recommendations
    }


@router.get("/search-videos")
def search_educational_videos(
    topic: str,
    context: Optional[str] = "Full Concept & Derivation",
    class_level: Optional[str] = "Class 11 / 12",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not topic or not topic.strip():
        raise HTTPException(status_code=400, detail="Topic is required.")

    enrollments = db.query(Enrollment).filter(Enrollment.student_id == current_user.id).all()
    class_ids = [e.classroom_id for e in enrollments]
    enrolled_classes = db.query(Classroom).filter(Classroom.id.in_(class_ids)).all() if class_ids else []
    class_names = [c.name for c in enrolled_classes]
    
    resolved_class = class_level if class_level else (f"Class {' '.join(class_names)}" if class_names else "Academic")
    combined_context = f"{resolved_class} {context or ''}".strip()

    results = get_curated_weak_topic_videos(
        weak_topics=[topic.strip()],
        grade_context=combined_context,
        target_count=10
    )
    return {
        "topic": topic.strip(),
        "context": context,
        "class_level": resolved_class,
        "count": len(results),
        "results": results
    }


@router.get("/video-transcript/{video_id}")
def fetch_video_transcript(
    video_id: str,
    current_user: User = Depends(get_current_user),
):
    transcript = get_video_transcript(video_id)
    return {
        "video_id": video_id,
        "has_transcript": len(transcript) > 0,
        "transcript": transcript
    }


@router.post("/track-video-focus")
def track_video_focus_time(
    data: VideoFocusTrackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = VideoFocusSession(
        student_id=current_user.id,
        video_id=data.video_id,
        video_title=data.video_title,
        weak_topic=data.weak_topic,
        watch_seconds=data.watch_seconds
    )
    db.add(session)

    streak = db.query(StudentStreak).filter(StudentStreak.student_id == current_user.id).first()
    if streak:
        streak.total_study_seconds += data.watch_seconds
        streak.last_active_date = date.today()
    else:
        streak = StudentStreak(
            student_id=current_user.id,
            current_streak=1,
            longest_streak=1,
            last_active_date=date.today(),
            total_study_seconds=data.watch_seconds
        )
        db.add(streak)
    db.commit()

    return {
        "message": "Focus time tracked successfully",
        "watch_seconds_added": data.watch_seconds,
        "total_study_minutes": round(streak.total_study_seconds / 60, 1),
        "current_streak": streak.current_streak
    }
