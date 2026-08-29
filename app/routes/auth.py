import os
import uuid
import random
import shutil
from datetime import datetime, timedelta
import requests
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    UserCreate, UserLogin, UserOut, Token, GoogleAuthRequest, 
    UserProfileUpdate, VerifyOtpRequest, ResendOtpRequest, ChangePasswordRequest
)
from app.utils.security import get_password_hash, verify_password, create_access_token
from app.utils.deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["Auth"])

AVATAR_UPLOAD_DIR = os.path.join("uploads", "avatars")
os.makedirs(AVATAR_UPLOAD_DIR, exist_ok=True)

@router.post("/signup")
def signup(user_in: UserCreate, db: Session = Depends(get_db)):
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
            db.commit()
            print(f"[OTP SERVICE] Resent verification OTP: {otp} to {existing.email}")
            return {
                "message": "Account already created but unverified. A new verification OTP has been sent to your email.",
                "email": existing.email,
                "requires_otp": True,
                "dev_otp": otp
            }
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
        verification_otp=otp,
        otp_expires_at=expires_at
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    print(f"[OTP SERVICE] Verification OTP for {user.email}: {otp}")

    return {
        "message": "Registration successful! Please enter the 6-digit OTP sent to your email.",
        "email": user.email,
        "requires_otp": True,
        "dev_otp": otp
    }


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
def resend_otp(payload: ResendOtpRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    otp = f"{random.randint(100000, 999999)}"
    user.verification_otp = otp
    user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
    db.commit()

    print(f"[OTP SERVICE] New Verification OTP for {user.email}: {otp}")

    return {
        "message": "A fresh 6-digit OTP has been sent to your email.",
        "email": user.email,
        "dev_otp": otp
    }


@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    if not user.is_verified:
        otp = f"{random.randint(100000, 999999)}"
        user.verification_otp = otp
        user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
        db.commit()
        print(f"[OTP SERVICE] Unverified login attempt for {user.email}. OTP: {otp}")
        raise HTTPException(
            status_code=403,
            detail=f"EMAIL_NOT_VERIFIED: Please verify your email with the 6-digit OTP."
        )

    token = create_access_token(subject=user.id)
    return Token(access_token=token, token_type="bearer", user=UserOut.model_validate(user))


@router.post("/google", response_model=Token)
def google_auth(payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    email = None
    name = None
    picture = None

    if payload.credential:
        try:
            res = requests.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={payload.credential}", timeout=10)
            if res.status_code == 200:
                data = res.json()
                email = data.get("email")
                name = data.get("name") or data.get("given_name") or "Student"
                picture = data.get("picture")
        except Exception as e:
            print(f"Error verifying Google ID token: {e}")

    if not email and payload.access_token:
        try:
            res = requests.get("https://www.googleapis.com/oauth2/v3/userinfo", headers={"Authorization": f"Bearer {payload.access_token}"}, timeout=10)
            if res.status_code == 200:
                data = res.json()
                email = data.get("email")
                name = data.get("name") or "Student"
                picture = data.get("picture")
        except Exception as e:
            print(f"Error verifying Google access token: {e}")

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to authenticate with Google. Invalid token or credential."
        )

    user = db.query(User).filter(User.email == email).first()

    if not user:
        random_pwd = str(uuid.uuid4())
        user = User(
            email=email,
            hashed_password=get_password_hash(random_pwd),
            full_name=name or email.split("@")[0],
            role=payload.role.lower() if payload.role else "student",
            student_class=payload.student_class,
            avatar_url=picture,
            auth_provider="google",
            is_verified=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.is_verified = True
        if picture and not user.avatar_url:
            user.avatar_url = picture
        if name and (not user.full_name or user.full_name == user.email):
            user.full_name = name
        if payload.student_class and not user.student_class:
            user.student_class = payload.student_class
        db.commit()
        db.refresh(user)

    token = create_access_token(subject=user.id)
    return Token(access_token=token, token_type="bearer", user=UserOut.model_validate(user))


@router.put("/profile", response_model=UserOut)
def update_profile(
    data: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.full_name is not None and data.full_name.strip():
        current_user.full_name = data.full_name.strip()
    if data.student_class is not None:
        current_user.student_class = data.student_class.strip()
    if data.role is not None and data.role.lower() in ("student", "teacher"):
        current_user.role = data.role.lower()

    db.commit()
    db.refresh(current_user)
    return UserOut.model_validate(current_user)


@router.put("/change-password")
def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.auth_provider == "local" and data.old_password:
        if not verify_password(data.old_password, current_user.hashed_password):
            raise HTTPException(status_code=400, detail="Current password does not match.")

    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")

    current_user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    return {"message": "Password changed successfully."}


@router.post("/upload-avatar", response_model=UserOut)
def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
        raise HTTPException(status_code=400, detail="Only image files (.png, .jpg, .jpeg, .webp) are allowed.")

    clean_filename = f"user_{current_user.id}_{int(datetime.utcnow().timestamp())}{ext}"
    target_path = os.path.join(AVATAR_UPLOAD_DIR, clean_filename)

    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    avatar_url = f"/uploads/avatars/{clean_filename}"
    current_user.avatar_url = avatar_url
    db.commit()
    db.refresh(current_user)

    return UserOut.model_validate(current_user)


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)
