from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.user import User
from app.models.analytics import StudentStreak, StudySession
from app.models.file import DocumentFile
from app.models.classroom import Enrollment
from app.utils.deps import get_current_user
from app.utils.time_utils import get_ist_now

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.post("/track-view")
def track_document_view(
    document_id: int,
    time_spent_seconds: int = 60,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Log a study session and update daily streak."""
    doc = db.query(DocumentFile).filter(DocumentFile.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Log study session
    session = StudySession(
        student_id=current_user.id,
        document_id=document_id,
        classroom_id=doc.classroom_id or 0,
        time_spent_seconds=time_spent_seconds
    )
    db.add(session)

    # Update or create streak
    streak = db.query(StudentStreak).filter(StudentStreak.student_id == current_user.id).first()
    today = get_ist_now().date()

    if not streak:
        streak = StudentStreak(
            student_id=current_user.id,
            current_streak=1,
            longest_streak=1,
            last_active_date=today,
            total_study_seconds=time_spent_seconds
        )
        db.add(streak)
    else:
        streak.total_study_seconds += time_spent_seconds

        if streak.last_active_date is None:
            streak.current_streak = 1
            streak.last_active_date = today
        else:
            delta = (today - streak.last_active_date).days
            if delta == 1:
                # Consecutive day — increment streak
                streak.current_streak += 1
                if streak.current_streak > streak.longest_streak:
                    streak.longest_streak = streak.current_streak
            elif delta == 0:
                # Same day — keep streak
                pass
            else:
                # Broken streak — reset to 1
                streak.current_streak = 1
            streak.last_active_date = today

    db.commit()
    return {
        "message": "Study session logged & streak updated",
        "current_streak": streak.current_streak,
        "longest_streak": streak.longest_streak,
        "total_study_seconds": streak.total_study_seconds
    }


def record_learning_activity(user_id: int, db: Session) -> int:
    """
    Lightweight, high-efficiency streak recording.
    Updates the student's daily streak strictly when learning activities occur:
    1. Taking or submitting a quiz
    2. Asking AI doubts & chat questions
    3. Reading classroom/library PDF documents
    
    Zero server pressure: If activity was already recorded today (IST), this is an instantaneous no-op.
    """
    try:
        today = get_ist_now().date()
        streak = db.query(StudentStreak).filter(StudentStreak.student_id == user_id).first()
        if not streak:
            streak = StudentStreak(
                student_id=user_id,
                current_streak=1,
                longest_streak=1,
                last_active_date=today,
                total_study_seconds=60
            )
            db.add(streak)
            db.commit()
            return 1

        if streak.last_active_date is None:
            streak.current_streak = 1
            streak.last_active_date = today
            streak.total_study_seconds += 60
            db.commit()
            return 1
        
        delta = (today - streak.last_active_date).days
        if delta == 1:
            # Consecutive day! Increment streak
            streak.current_streak += 1
            if streak.current_streak > streak.longest_streak:
                streak.longest_streak = streak.current_streak
            streak.last_active_date = today
            streak.total_study_seconds += 60
            db.commit()
        elif delta == 0:
            # Already active today - streak already counted for today! Zero overhead.
            pass
        elif delta > 1:
            # Streak was broken (gap of 2+ days) - reset to 1
            streak.current_streak = 1
            streak.last_active_date = today
            streak.total_study_seconds += 60
            db.commit()

        return streak.current_streak
    except Exception as e:
        print(f"Error in record_learning_activity: {e}")
        return 1


@router.get("/streak")
@router.get("/my-streak")
def get_my_streak(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's streak info."""
    streak = db.query(StudentStreak).filter(StudentStreak.student_id == current_user.id).first()
    if not streak:
        return {"current_streak": 0, "longest_streak": 0, "total_study_seconds": 0}
    
    # Check if streak is still active (last active was yesterday or today)
    today = get_ist_now().date()
    if streak.last_active_date:
        delta = (today - streak.last_active_date).days
        if delta > 1:
            streak.current_streak = 0
            db.commit()

    return {
        "current_streak": streak.current_streak,
        "longest_streak": streak.longest_streak,
        "total_study_seconds": streak.total_study_seconds,
        "last_active_date": str(streak.last_active_date) if streak.last_active_date else None
    }


@router.get("/classroom/{classroom_id}")
def get_classroom_analytics(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Teacher analytics dashboard — student engagement, views, study time."""
    # Count enrolled students
    total_students = db.query(func.count(Enrollment.id)).filter(
        Enrollment.classroom_id == classroom_id
    ).scalar() or 0

    # Count documents
    total_docs = db.query(func.count(DocumentFile.id)).filter(
        DocumentFile.classroom_id == classroom_id
    ).scalar() or 0

    # Total views & study time
    total_views = db.query(func.count(StudySession.id)).filter(
        StudySession.classroom_id == classroom_id
    ).scalar() or 0

    total_study_seconds = db.query(func.coalesce(func.sum(StudySession.time_spent_seconds), 0)).filter(
        StudySession.classroom_id == classroom_id
    ).scalar() or 0

    # Student leaderboard — top students by study time
    from app.models.user import User as UserModel
    leaderboard_rows = (
        db.query(
            UserModel.id,
            UserModel.full_name,
            UserModel.email,
            func.coalesce(func.sum(StudySession.time_spent_seconds), 0).label("study_time"),
            func.count(StudySession.id).label("view_count")
        )
        .join(Enrollment, Enrollment.student_id == UserModel.id)
        .outerjoin(StudySession, (StudySession.student_id == UserModel.id) & (StudySession.classroom_id == classroom_id))
        .filter(Enrollment.classroom_id == classroom_id)
        .group_by(UserModel.id, UserModel.full_name, UserModel.email)
        .order_by(func.coalesce(func.sum(StudySession.time_spent_seconds), 0).desc())
        .all()
    )

    leaderboard = []
    for row in leaderboard_rows:
        streak = db.query(StudentStreak).filter(StudentStreak.student_id == row.id).first()
        leaderboard.append({
            "student_id": row.id,
            "full_name": row.full_name,
            "email": row.email,
            "total_study_seconds": int(row.study_time),
            "total_study_minutes": round(int(row.study_time) / 60, 1),
            "view_count": int(row.view_count),
            "current_streak": streak.current_streak if streak else 0,
            "longest_streak": streak.longest_streak if streak else 0
        })

    # Document-level metrics
    doc_metrics_rows = (
        db.query(
            DocumentFile.id,
            DocumentFile.filename,
            func.count(StudySession.id).label("views"),
            func.count(func.distinct(StudySession.student_id)).label("unique_students"),
            func.coalesce(func.sum(StudySession.time_spent_seconds), 0).label("total_time")
        )
        .outerjoin(StudySession, StudySession.document_id == DocumentFile.id)
        .filter(DocumentFile.classroom_id == classroom_id)
        .group_by(DocumentFile.id, DocumentFile.filename)
        .order_by(func.count(StudySession.id).desc())
        .all()
    )

    doc_metrics = [{
        "document_id": row.id,
        "filename": row.filename,
        "views": int(row.views),
        "unique_students": int(row.unique_students),
        "total_study_minutes": round(int(row.total_time) / 60, 1)
    } for row in doc_metrics_rows]

    return {
        "overview": {
            "total_students": total_students,
            "total_documents": total_docs,
            "total_views": total_views,
            "total_study_hours": round(total_study_seconds / 3600, 1)
        },
        "student_leaderboard": leaderboard,
        "document_metrics": doc_metrics
    }
