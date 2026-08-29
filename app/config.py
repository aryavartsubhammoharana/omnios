import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "NoteAI - Google Classroom & NotebookLM Clone"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:subham2007@localhost:5432/noteai_db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "noteai_super_secret_jwt_key_2026_safe_auth_token_987654")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
    
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    SARVAM_API_KEY: str = os.getenv("SARVAM_API_KEY", "")
    SARVAM_MODEL: str = os.getenv("SARVAM_MODEL", "sarvam-105b-conversations")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
    GROQ_VISION_API_KEY: str = os.getenv("GROQ_VISION_API_KEY", "")
    GROQ_VISION_MODEL: str = os.getenv("GROQ_VISION_MODEL", "qwen/qwen3.6-27b")
    YOUTUBE_API_KEY: str = os.getenv("YOUTUBE_API_KEY", "")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
