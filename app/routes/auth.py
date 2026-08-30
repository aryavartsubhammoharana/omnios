import os
import uuid
import random
import shutil
import logging
from datetime import datetime, timedelta
import requests
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    UserCreate, UserLogin, UserOut, Token, GoogleAuthRequest, 
    UserProfileUpdate, VerifyOtpRequest, ResendOtpRequest, ChangePasswordRequest, ConfirmRoleRequest
)
from app.utils.security import get_password_hash, verify_password, create_access_token
from app.utils.deps import get_current_user
from app.services.email_service import send_verification_otp_email

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["Auth"])

AVATAR_UPLOAD_DIR = os.path.join("uploads", "avatars")
os.makedirs(AVATAR_UPLOAD_DIR, exist_ok=True)


@router.post("/signup")
def signup(user_in: UserCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        if not existing.is_verified:
            otp = f"{random.randint(100000, 999999)}"
            existing.verification_otp = otp
            existing.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
            existing.full_name = user_in.full_name
            existing.hashed_password = get_password_hash(user_in.password)
            existing.role = user_in.role.lower()
            existing.student_class = user_in.student_class
            existing.is_role_confirmed = True
            db.commit()
            background_tasks.add_task(send_verification_otp_email, existing.email, otp, existing.full_name)
            
            res_data = {
                "message": "Account already created but unverified. A new verification OTP has been sent to your email.",
                "email": existing.email,
                "requires_otp": True
            }
            if settings.DEBUG or not settings.SMTP_USER:
                res_data["dev_otp"] = otp
            return res_data

        raise HTTPException(status_code=400, detail="Email already registered. Please sign in.")

    otp = f"{random.randint(100000, 999999)}"
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role.lower(),
        student_class=user_in.student_class,
        auth_provider="local",
        is_verified=False,
        is_role_confirmed=True,
        verification_otp=otp,
        otp_expires_at=expires_at
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    background_tasks.add_task(send_verification_otp_email, user.email, otp, user.full_name)

    res_data = {
        "message": "Registration successful! Please enter the 6-digit OTP sent to your email.",
        "email": user.email,
        "requires_otp": True
    }
    if settings.DEBUG or not settings.SMTP_USER:
        res_data["dev_otp"] = otp
    return res_data


@router.post("/verify-otp", response_model=Token)
def verify_otp(payload: VerifyOtpRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.is_verified:
        token = create_access_token(subject=user.id)
        return Token(access_token=token, token_type="bearer", user=UserOut.model_validate(user))

    if not user.verification_otp or user.verification_otp.strip() != payload.otp.strip():
        raise HTTPException(status_code=400, detail="Invalid OTP code. Please check and try again.")

    if user.otp_expires_at and user.otp_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new code.")

    user.is_verified = True
    user.verification_otp = None
    user.otp_expires_at = None
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=user.id)
    return Token(access_token=token, token_type="bearer", user=UserOut.model_validate(user))


@router.post("/resend-otp")
def resend_otp(payload: ResendOtpRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    otp = f"{random.randint(100000, 999999)}"
    user.verification_otp = otp
    user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
    db.commit()

    background_tasks.add_task(send_verification_otp_email, user.email, otp, user.full_name)

    res_data = {
        "message": "A fresh 6-digit OTP has been sent to your email.",
        "email": user.email
    }
    if settings.DEBUG or not settings.SMTP_USER:
        res_data["dev_otp"] = otp
    return res_data


@router.post("/login", response_model=Token)
def login(credentials: UserLogin, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    if not user.is_verified:
        otp = f"{random.randint(100000, 999999)}"
        user.verification_otp = otp
        user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
        db.commit()
        background_tasks.add_task(send_verification_otp_email, user.email, otp, user.full_name)
        raise HTTPException(
            status_code=403,
            detail="EMAIL_NOT_VERIFIED: Please verify your email with the 6-digit OTP."
        )

    token = create_access_token(subject=user.id)
    return Token(access_token=token, token_type="bearer", user=UserOut.model_validate(user))


@router.post("/google", response_model=Token)
def google_auth(payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    email = None
    name = None
    picture = None
    google_id = None
    email_verified = False

    if payload.credential:
        try:
            res = requests.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={payload.credential}", timeout=10)
            if res.status_code == 200:
                data = res.json()
                token_aud = data.get("aud")
                if settings.GOOGLE_CLIENT_ID and token_aud and token_aud != settings.GOOGLE_CLIENT_ID:
                    logger.warning("Google ID token aud '%s' does not match configured GOOGLE_CLIENT_ID '%s'", token_aud, settings.GOOGLE_CLIENT_ID)
                
                email = data.get("email")
                name = data.get("name")
                picture = data.get("picture")
                google_id = data.get("sub")
                email_verified = data.get("email_verified") in (True, "true", "True")
            else:
                logger.warning("Google tokeninfo returned status %s: %s", res.status_code, res.text)
        except Exception as e:
            logger.error("Error validating Google ID token: %s", e)

    if not email and payload.access_token:
        try:
            res = requests.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {payload.access_token}"},
                timeout=10
            )
            if res.status_code == 200:
                data = res.json()
                email = data.get("email")
                name = data.get("name")
                picture = data.get("picture")
                google_id = data.get("sub")
                email_verified = data.get("email_verified") in (True, "true", "True")
            else:
                logger.warning("Google userinfo returned status %s: %s", res.status_code, res.text)
        except Exception as e:
            logger.error("Error fetching Google userinfo: %s", e)

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to verify Google credentials."
        )

    user = None
    if google_id:
        user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()

    if not user:
        suggested_role = payload.role.lower() if payload.role else "student"
        user = User(
            email=email,
            full_name=name or email.split("@")[0],
            role=suggested_role,
            avatar_url=picture,
            google_id=google_id,
            auth_provider="google",
            is_verified=True,
            is_role_confirmed=False
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if google_id and not user.google_id:
            user.google_id = google_id
        if picture and not user.avatar_url:
            user.avatar_url = picture
        if name and (not user.full_name or user.full_name == user.email.split("@")[0]):
            user.full_name = name
        user.is_verified = True
        if user.auth_provider == "local" and google_id:
            user.auth_provider = "google"
        db.commit()
        db.refresh(user)

    token = create_access_token(subject=user.id)
    return Token(access_token=token, token_type="bearer", user=UserOut.model_validate(user))


@router.api_route("/confirm-role", methods=["POST", "PUT"], response_model=UserOut)
def confirm_role(payload: ConfirmRoleRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.role:
        current_user.role = payload.role.lower()
    if payload.student_class:
        current_user.student_class = payload.student_class
    
    current_user.is_role_confirmed = True
    db.commit()
    db.refresh(current_user)
    return UserOut.model_validate(current_user)


@router.put("/profile", response_model=UserOut)
def update_profile(
    profile_data: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if profile_data.full_name is not None:
        current_user.full_name = profile_data.full_name.strip()
    if profile_data.student_class is not None:
        current_user.student_class = profile_data.student_class.strip()
    if getattr(profile_data, 'avatar_url', None) is not None:
        current_user.avatar_url = profile_data.avatar_url

    db.commit()
    db.refresh(current_user)
    return UserOut.model_validate(current_user)


@router.api_route("/change-password", methods=["POST", "PUT"])
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.auth_provider == "google":
        raise HTTPException(
            status_code=400,
            detail="Accounts registered via Google do not have a local password."
        )

    if not current_user.hashed_password or not verify_password(payload.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    current_user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    return {"message": "Password changed successfully."}


@router.post("/upload-avatar", response_model=UserOut)
def upload_avatar(
    avatar: UploadFile = File(None),
    file: UploadFile = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    upload_item = avatar or file
    if not upload_item or not upload_item.filename:
        raise HTTPException(status_code=400, detail="No avatar image file provided.")

    allowed_exts = [".jpg", ".jpeg", ".png", ".webp"]
    ext = os.path.splitext(upload_item.filename)[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail="Invalid image format. Allowed: JPG, PNG, WEBP.")

    filename = f"avatar_{current_user.id}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(AVATAR_UPLOAD_DIR, filename)

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(upload_item.file, buffer)

    if current_user.avatar_url and current_user.avatar_url.startswith("/uploads/avatars/"):
        old_path = current_user.avatar_url.lstrip("/")
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except Exception:
                pass

    current_user.avatar_url = f"/uploads/avatars/{filename}"
    db.commit()
    db.refresh(current_user)

    return UserOut.model_validate(current_user)


@router.delete("/delete-account")
def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.classroom import Classroom, Enrollment, Post
    from app.models.quiz import Quiz, QuizAttempt, StudentDailyQuiz
    from app.models.analytics import StudentStreak, StudySession, VideoFocusSession
    from app.models.file import DocumentFile
    from app.models.chunk import DocumentChunk
    from app.models.image import ImageRecord, ImageBatch
    from app.services.vector_store import get_chroma_client

    user_id = current_user.id

    db.query(Enrollment).filter(Enrollment.student_id == user_id).delete(synchronize_session=False)
    db.query(QuizAttempt).filter(QuizAttempt.student_id == user_id).delete(synchronize_session=False)
    db.query(StudentDailyQuiz).filter(StudentDailyQuiz.student_id == user_id).delete(synchronize_session=False)
    db.query(StudentStreak).filter(StudentStreak.student_id == user_id).delete(synchronize_session=False)
    db.query(StudySession).filter(StudySession.student_id == user_id).delete(synchronize_session=False)
    db.query(VideoFocusSession).filter(VideoFocusSession.student_id == user_id).delete(synchronize_session=False)
    db.query(Post).filter(Post.author_id == user_id).delete(synchronize_session=False)

    personal_docs = db.query(DocumentFile).filter(DocumentFile.uploaded_by_id == user_id).all()
    for pd in personal_docs:
        if pd.file_path and os.path.exists(pd.file_path):
            try:
                os.remove(pd.file_path)
            except Exception as ex:
                print(f"Error removing file from disk: {ex}")
        db.query(DocumentChunk).filter(DocumentChunk.document_id == pd.id).delete(synchronize_session=False)
        db.query(ImageRecord).filter(ImageRecord.file_id == pd.id).delete(synchronize_session=False)
        db.query(ImageBatch).filter(ImageBatch.file_id == pd.id).delete(synchronize_session=False)
        db.delete(pd)

    teacher_classes = db.query(Classroom).filter(Classroom.teacher_id == user_id).all()
    chroma_client = get_chroma_client()

    for c in teacher_classes:
        c_id = c.id
        doc_files = db.query(DocumentFile).filter(DocumentFile.classroom_id == c_id).all()
        for df in doc_files:
            if df.file_path and os.path.exists(df.file_path):
                try:
                    os.remove(df.file_path)
                except Exception as ex:
                    print(f"Error removing physical file: {ex}")
            db.query(DocumentChunk).filter(DocumentChunk.document_id == df.id).delete(synchronize_session=False)
            db.query(ImageRecord).filter(ImageRecord.file_id == df.id).delete(synchronize_session=False)
            db.query(ImageBatch).filter(ImageBatch.file_id == df.id).delete(synchronize_session=False)
            db.delete(df)

        quizzes = db.query(Quiz).filter(Quiz.classroom_id == c_id).all()
        for qz in quizzes:
            db.query(QuizAttempt).filter(QuizAttempt.quiz_id == qz.id).delete(synchronize_session=False)
            db.delete(qz)

        db.query(Enrollment).filter(Enrollment.classroom_id == c_id).delete(synchronize_session=False)
        db.query(Post).filter(Post.classroom_id == c_id).delete(synchronize_session=False)

        try:
            if c.code:
                chroma_client.delete_collection(f"classroom_{c.code.upper()}")
        except Exception as ex:
            print(f"Note on deleting classroom vector collection: {ex}")

        db.delete(c)

    if current_user.avatar_url and current_user.avatar_url.startswith("/uploads/avatars/"):
        try:
            local_avatar = current_user.avatar_url.lstrip("/")
            if os.path.exists(local_avatar):
                os.remove(local_avatar)
        except Exception:
            pass

    db.delete(current_user)
    db.commit()

    return {"message": "Account, physical files, and classroom spaces deleted. Global intelligence retained permanently."}


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)
