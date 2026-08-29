import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.user import User
from app.models.classroom import Classroom, Enrollment, Post
from app.schemas.classroom import ClassroomCreate, ClassroomUpdate, ClassroomOut, JoinClassroom, PostCreate, PostOut
from app.utils.deps import get_current_user

router = APIRouter(prefix="/api/classroom", tags=["Classroom"])

import string

def generate_unique_class_code(db: Session, length: int = 5) -> str:
    """Generate a collision-resistant 5-character alphanumeric classroom code (A-Z, 0-9)."""
    chars = string.ascii_uppercase + string.digits
    # Exclude easily confused characters (O, 0, I, 1) for superior UX if desired, or use standard A-Z, 2-9
    charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    
    for _ in range(100):  # Retry loop to guarantee 100% uniqueness
        code = "".join(secrets.choice(charset) for _ in range(length))
        existing = db.query(Classroom).filter(Classroom.code == code).first()
        if not existing:
            return code
    
    # Fallback to 6 chars if saturation occurs
    return "".join(secrets.choice(charset) for _ in range(6))

@router.post("/create", response_model=ClassroomOut)
def create_classroom(data: ClassroomCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can create classrooms")
    
    code = generate_unique_class_code(db, length=5)
    classroom = Classroom(
        name=data.name,
        description=data.description,
        code=code,
        teacher_id=current_user.id
    )
    db.add(classroom)
    db.commit()
    db.refresh(classroom)

    res = ClassroomOut.model_validate(classroom)
    res.teacher_name = current_user.full_name
    return res

@router.put("/{classroom_id}", response_model=ClassroomOut)
def update_classroom(classroom_id: int, data: ClassroomUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can edit classroom details")

    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    if classroom.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit classrooms that you created")

    if data.name and data.name.strip():
        classroom.name = data.name.strip()
    if data.description is not None:
        classroom.description = data.description.strip()

    db.commit()
    db.refresh(classroom)

    teacher = db.query(User).filter(User.id == classroom.teacher_id).first()
    res = ClassroomOut.model_validate(classroom)
    res.teacher_name = teacher.full_name if teacher else "Teacher"
    return res

@router.post("/join", response_model=ClassroomOut)
def join_classroom(data: JoinClassroom, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    classroom = db.query(Classroom).filter(Classroom.code == data.code.strip().upper()).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Invalid classroom code")
    
    existing = db.query(Enrollment).filter(
        Enrollment.classroom_id == classroom.id,
        Enrollment.student_id == current_user.id
    ).first()
    if not existing:
        enrollment = Enrollment(classroom_id=classroom.id, student_id=current_user.id)
        db.add(enrollment)
        db.commit()
    
    teacher = db.query(User).filter(User.id == classroom.teacher_id).first()
    res = ClassroomOut.model_validate(classroom)
    res.teacher_name = teacher.full_name if teacher else "Teacher"
    return res

@router.delete("/{classroom_id}/leave")
def leave_classroom(classroom_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    enrollment = db.query(Enrollment).filter(
        Enrollment.classroom_id == classroom_id,
        Enrollment.student_id == current_user.id
    ).first()
    
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment record not found")
    
    db.delete(enrollment)
    db.commit()
    return {"message": "Successfully left the classroom", "classroom_id": classroom_id}

@router.get("/{classroom_id}/students")
def get_enrolled_students(classroom_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    enrollments = db.query(Enrollment).filter(Enrollment.classroom_id == classroom_id).all()
    student_ids = [e.student_id for e in enrollments]
    
    students = db.query(User).filter(User.id.in_(student_ids)).all() if student_ids else []
    
    enrollment_map = {e.student_id: e.joined_at for e in enrollments}
    
    return [{
        "id": s.id,
        "full_name": s.full_name,
        "email": s.email,
        "joined_at": enrollment_map.get(s.id)
    } for s in students]

@router.get("/list", response_model=List[ClassroomOut])
def list_classrooms(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "teacher":
        classrooms = db.query(Classroom).filter(Classroom.teacher_id == current_user.id).all()
    else:
        enrollments = db.query(Enrollment).filter(Enrollment.student_id == current_user.id).all()
        class_ids = [e.classroom_id for e in enrollments]
        classrooms = db.query(Classroom).filter(Classroom.id.in_(class_ids)).all() if class_ids else []
    
    result = []
    for c in classrooms:
        teacher = db.query(User).filter(User.id == c.teacher_id).first()
        out = ClassroomOut.model_validate(c)
        out.teacher_name = teacher.full_name if teacher else "Teacher"
        result.append(out)
    return result

@router.get("/{classroom_id}", response_model=ClassroomOut)
def get_classroom_detail(classroom_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    
    teacher = db.query(User).filter(User.id == classroom.teacher_id).first()
    out = ClassroomOut.model_validate(classroom)
    out.teacher_name = teacher.full_name if teacher else "Teacher"
    return out

@router.post("/{classroom_id}/posts", response_model=PostOut)
def create_post(classroom_id: int, data: PostCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = Post(
        classroom_id=classroom_id,
        author_id=current_user.id,
        content=data.content
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    out = PostOut.model_validate(post)
    out.author_name = current_user.full_name
    return out

@router.get("/{classroom_id}/posts", response_model=List[PostOut])
def get_posts(classroom_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    posts = db.query(Post).filter(Post.classroom_id == classroom_id).order_by(Post.created_at.desc()).all()
    result = []
    for p in posts:
        author = db.query(User).filter(User.id == p.author_id).first()
        out = PostOut.model_validate(p)
        out.author_name = author.full_name if author else "User"
        result.append(out)
    return result
