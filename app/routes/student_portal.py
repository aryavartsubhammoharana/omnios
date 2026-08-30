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
from app.services.ai import query_groq_ai, query_sarvam_ai, query_gemini_ai, is_valid_ai_text
from app.services.curriculum_registry import get_active_term_chapters, build_advanced_diagnostic_prompt
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


def get_daily_subject_schedule(class_name: str, ist_date) -> dict:
    weekday = ist_date.weekday()
    clean_class = (class_name or "").lower()

    if "11" in clean_class or "12" in clean_class:
        schedule = {
            0: {
                "subject": "Physics",
                "focus": "Core Laws, Mechanics, Electromagnetism & Derivations",
                "q_count": 8,
                "lang": "en",
                "keywords": ["physics", "mechanics", "optics", "thermodynamics"],
                "instruction": "Generate 8 rigorous conceptual and derivation-based Physics multiple choice questions."
            },
            1: {
                "subject": "Chemistry",
                "focus": "Organic Reaction Mechanisms, Chemical Bonding & Equilibrium",
                "q_count": 8,
                "lang": "en",
                "keywords": ["chemistry", "organic", "inorganic", "bonding", "equilibrium"],
                "instruction": "Generate 8 conceptual and numerical Chemistry MCQs testing reactions and concepts."
            },
            2: {
                "subject": "Mathematics / Biology",
                "focus": "Calculus, Vectors, Genetics & Cell Physiology",
                "q_count": 8,
                "lang": "en",
                "keywords": ["math", "mathematics", "calculus", "biology", "genetics"],
                "instruction": "Generate 8 problem-solving MCQs with LaTeX equations ($...$) and step-by-step mathematical reasoning."
            },
            3: {
                "subject": "English Core",
                "focus": "Advanced Reading Comprehension, Literary Devices & Applied Grammar",
                "q_count": 10,
                "lang": "en",
                "keywords": ["english", "grammar", "comprehension", "literature"],
                "instruction": "Provide a short 150-word Unseen Passage followed by 5 Reading Comprehension MCQs and 5 English Applied Grammar MCQs."
            },
            4: {
                "subject": "Computer Science / Elective",
                "focus": "Algorithms, Python Data Structures, Networks or Applied Electives",
                "q_count": 8,
                "lang": "en",
                "keywords": ["computer", "python", "code", "cs", "algorithm"],
                "instruction": "Generate 8 algorithmic, coding, and conceptual MCQs."
            },
            5: {
                "subject": "JEE / NEET Mixed Diagnostic",
                "focus": "High-Yield Multi-Concept Practice Problems",
                "q_count": 10,
                "lang": "en",
                "keywords": ["physics", "chemistry", "math", "biology"],
                "instruction": "Generate 10 high-yield multi-disciplinary diagnostic MCQs for entrance revision."
            },
            6: {
                "subject": "Weekly Comprehensive Mock Assessment",
                "focus": "Full Syllabus Cross-Topic Revision",
                "q_count": 10,
                "lang": "en",
                "keywords": [],
                "instruction": "Generate 10 balanced cross-subject diagnostic MCQs covering this week's topics."
            }
        }
    else:
        schedule = {
            0: {
                "subject": "Science",
                "focus": "Physics, Chemistry & Biology (Light, Electricity, Life Processes, Chemical Reactions, Acid-Bases)",
                "q_count": 8,
                "lang": "en",
                "keywords": ["science", "physics", "chemistry", "biology", "life processes", "light", "electricity"],
                "instruction": "Generate 8 high-quality conceptual and experimental Science MCQs with clear explanations."
            },
            1: {
                "subject": "Social Science (SST)",
                "focus": "History (Nationalism), Geography (Resources), Civics (Power Sharing) & Economics (Development)",
                "q_count": 8,
                "lang": "en",
                "keywords": ["sst", "social science", "history", "geography", "civics", "economics"],
                "instruction": "Generate 8 analytical Social Science (SST) MCQs testing conceptual understanding, historical context, and economics."
            },
            2: {
                "subject": "Mathematics (Numerical)",
                "focus": "Step-by-step Numericals, Quadratic Equations, Trigonometry, Geometry, Surface Areas & Arithmetic Progressions",
                "q_count": 8,
                "lang": "en",
                "keywords": ["math", "mathematics", "trigonometry", "algebra", "geometry", "equations"],
                "instruction": "Generate 8 numerical problem-solving Math questions with LaTeX formatting ($...$) and detailed calculation steps in explanations."
            },
            3: {
                "subject": "English",
                "focus": "Unseen Reading Comprehension Passage + Grammar & Vocabulary",
                "q_count": 10,
                "lang": "en",
                "keywords": ["english", "grammar", "comprehension", "literature"],
                "instruction": "Include a short 120-150 word Unseen Passage at the start, followed by 5 Reading Comprehension MCQs and 5 English Grammar MCQs (Tenses, Active/Passive, Modals, Subject-Verb Agreement)."
            },
            4: {
                "subject": "Hindi (हिंदी)",
                "focus": "अपठित गद्यांश (Unseen Passage) + हिंदी व्याकरण (समास, संधि, पद-परिचय, मुहावरे, वाक्य शोधन)",
                "q_count": 10,
                "lang": "hi",
                "keywords": ["hindi", "हिंदी", "व्याकरण", "गद्यांश"],
                "instruction": "CRITICAL: The entire output MUST be strictly in Hindi (Devanagari script हिंदी). Provide a 120-word रोचक अपठित गद्यांश, followed by 5 गद्यांश आधारित MCQs और 5 हिंदी व्याकरण MCQs (समास, संधि, पद परिचय, मुहावरे)."
            },
            5: {
                "subject": "Math & Science Revision",
                "focus": "STEM Conceptual & Numerical Problem Solving",
                "q_count": 8,
                "lang": "en",
                "keywords": ["science", "math"],
                "instruction": "Generate 8 mixed STEM numerical and conceptual questions reviewing this week's key topics."
            },
            6: {
                "subject": "Weekly Comprehensive Mock Assessment",
                "focus": "All-Round Subject Assessment (Science, SST, Math, English, Hindi)",
                "q_count": 10,
                "lang": "en",
                "keywords": [],
                "instruction": "Generate a balanced 10-question comprehensive diagnostic test covering Science, SST, Math, English, and Hindi."
            }
        }

    return schedule.get(weekday, schedule[0])


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

    today = get_ist_now().date()
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
    student_class = current_user.student_class or (class_names[0] if class_names else "Class 10")
    class_context = ", ".join(class_names) if class_names else student_class

    sched = get_daily_subject_schedule(student_class, today)

    docs = []
    if class_ids:
        docs = db.query(DocumentFile).filter(
            DocumentFile.classroom_id.in_(class_ids)
        ).order_by(DocumentFile.created_at.desc()).limit(12).all()

    notes_text = ""
    for d in docs:
        if d.content_text:
            fname_lower = d.filename.lower()
            if any(k in fname_lower for k in sched.get("keywords", [])):
                notes_text += f"\n--- Material from {d.filename} ---\n{d.content_text[:3000]}\n"

    if not notes_text.strip():
        for d in docs[:4]:
            if d.content_text:
                notes_text += f"\n--- Material from {d.filename} ---\n{d.content_text[:2000]}\n"

    if not notes_text.strip():
        notes_text = f"Curriculum and core concepts for {student_class} Subject: {sched['subject']} ({sched['focus']})."

    past_quizzes = db.query(StudentDailyQuiz).filter(
        StudentDailyQuiz.student_id == current_user.id,
        StudentDailyQuiz.is_completed == True
    ).order_by(StudentDailyQuiz.completed_at.desc()).limit(5).all()

    accumulated_weak_topics = []
    for pq in past_quizzes:
        if pq.weak_topics:
            accumulated_weak_topics.extend(pq.weak_topics)

    active_chapters = get_active_term_chapters(
        class_name=student_class,
        subject=sched["subject"],
        current_month=today.month
    )

    prompt = build_advanced_diagnostic_prompt(
        student_name=current_user.full_name or "Student",
        target_class=student_class,
        subject=sched["subject"],
        weekday_name=today.strftime("%A"),
        active_chapters=active_chapters,
        weak_topics=accumulated_weak_topics,
        study_notes_context=notes_text,
        q_count=sched["q_count"],
        lang=sched.get("lang", "en")
    )

    ai_response = ""
    if sched.get("lang") == "hi":
        ai_response = query_sarvam_ai(prompt=prompt)
        if not is_valid_ai_text(ai_response):
            ai_response = query_gemini_ai(prompt=prompt)
    else:
        ai_response = query_groq_ai(prompt=prompt)
        if not is_valid_ai_text(ai_response):
            ai_response = query_gemini_ai(prompt=prompt)

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
        print(f"Error parsing AI daily subject quiz questions: {e}")

    if not questions:
        if sched.get("lang") == "hi":
            questions = [
                {
                    "id": 1,
                    "question": "संधि के मुख्य रूप से कितने भेद होते हैं?",
                    "options": ["तीन (3)", "चार (4)", "दो (2)", "पाँच (5)"],
                    "correct_index": 0,
                    "topic": "हिंदी व्याकरण - संधि",
                    "explanation": "संधि के मुख्य रूप से 3 भेद होते हैं: स्वर संधि, व्यंजन संधि, और विसर्ग संधि।"
                },
                {
                    "id": 2,
                    "question": "'दशानन' शब्द में कौन सा समास है?",
                    "options": ["बहुव्रीहि समास", "द्विगु समास", "तत्पुरुष समास", "कर्मधारय समास"],
                    "correct_index": 0,
                    "topic": "हिंदी व्याकरण - समास",
                    "explanation": "दशानन (दस हैं आनन जिसके अर्थात रावण) में तीसरा पद प्रधान होने से बहुव्रीहि समास है।"
                }
            ]
        else:
            questions = [
                {
                    "id": 1,
                    "question": f"Which core principle is fundamental to {sched['subject']}?",
                    "options": ["Conservation and equilibrium laws", "Random uncontrolled processes", "Arbitrary decay", "None of these"],
                    "correct_index": 0,
                    "topic": f"{sched['subject']} Core Principle",
                    "explanation": "Fundamental laws of conservation and balance underpin core science and mathematics."
                },
                {
                    "id": 2,
                    "question": f"How are problems solved systematically in {sched['subject']}?",
                    "options": ["By rigorous formulation and empirical proof", "By assumption without verification", "By ignoring constraints", "None"],
                    "correct_index": 0,
                    "topic": f"{sched['subject']} Methodology",
                    "explanation": "Systematic verification and deductive reasoning yield reproducible results."
                }
            ]

    quiz_title = f"Daily Practice: {sched['subject']} — {today.strftime('%d %b %Y (%A)')}"
    daily_quiz = StudentDailyQuiz(
        student_id=current_user.id,
        quiz_date=today,
        title=quiz_title,
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
    grade_context = current_user.student_class or (f"Class {' '.join(class_names)}" if class_names else "Class 10 Board")

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

    grade_context = current_user.student_class or "Class 10 Board"
    fallback = get_curated_weak_topic_videos(
        weak_topics=["Science & Mathematics Foundation", "Problem Solving Technique"],
        grade_context=grade_context,
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
    grade_context = current_user.student_class or (f"Class {' '.join(class_names)}" if class_names else "Class 10 Board")

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
    class_level: Optional[str] = "Class 10 Board",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not topic or not topic.strip():
        raise HTTPException(status_code=400, detail="Topic is required.")

    resolved_class = current_user.student_class or class_level or "Class 10 Board"
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
