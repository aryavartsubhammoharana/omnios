import uuid
import requests
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.auth import UserCreate, UserLogin, UserOut, Token, GoogleAuthRequest, UserProfileUpdate
from app.utils.security import get_password_hash, verify_password, create_access_token
from app.utils.deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["Auth"])

@router.post("/signup", response_model=Token)
def signup(user_in: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role.lower(),
        student_class=user_in.student_class,
        auth_provider="local"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=user.id)
    return Token(access_token=token, token_type="bearer", user=UserOut.model_validate(user))

@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
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
            auth_provider="google"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
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

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)
