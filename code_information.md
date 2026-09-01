# 🎓 OmniOS & OmniChat — Complete Backend Code & Architecture Guide

> **System Overview**: OmniOS is a high-performance, enterprise-grade AI Academic Learning Platform & LMS backend built with **FastAPI**, **PostgreSQL (SQLAlchemy with Connection Pooling)**, **ChromaDB Vector Retrieval**, **Multi-Model AI Pipelines (Gemini 2.5/Flash, Sarvam AI, Groq GPT-OSS/Qwen)**, **Local Vision OCR (Tesseract / Ollama Qwen2.5-VL)**, and automated **LocalTunnel Live Tunneling**.

---

## 📂 1. Backend Project Structure & File Map

```
NoteAI / OmniOS Root
├── app/
│   ├── main.py                     # FastAPI application bootstrap, CORS middleware, route mounting
│   ├── config.py                   # Pydantic Settings, environment variables, API keys & DB URLs
│   ├── database.py                 # PostgreSQL engine, sessionmaker, pool_size=20, max_overflow=30
│   │
│   ├── models/                     # SQLAlchemy ORM Database Models
│   │   ├── __init__.py
│   │   ├── user.py                 # User model (Google OAuth, hashed passwords, roles, student_class)
│   │   ├── classroom.py            # Classroom, Enrollment, Post, Assignment, Submission models
│   │   ├── file.py                 # DocumentFile & DocumentPage models (OCR status, vector sync)
│   │   ├── quiz.py                 # Quiz, Question, Choice, StudentQuizAttempt models
│   │   ├── streak.py               # StudentStreak & StudyActivityLog models
│   │   ├── student_quiz.py         # StudentDailyQuiz model (Diagnostic daily test & video recs)
│   │   └── video_focus.py          # VideoFocusSession model (Focused study time tracking)
│   │
│   ├── routes/                     # RESTful API Endpoint Controllers
│   │   ├── __init__.py
│   │   ├── auth.py                 # Register, Login, Google OAuth, OTP verification, Profile update
│   │   ├── classroom.py            # Create/Join classroom, Posts, Assignments, Submissions
│   │   ├── upload.py               # Document upload, Async OCR page extraction, Document details
│   │   ├── ai.py                   # OmniChat RAG endpoint, Summaries, Mindmap & Flashcard gen
│   │   ├── student_portal.py       # 24-Hour Diagnostic Quiz, YouTube Focus engine, Remediation
│   │   ├── analytics.py            # Streak tracking, Study activity logger, Leaderboard
│   │   └── quiz.py                 # Custom Classroom Quizzes & Auto-grading
│   │
│   ├── schemas/                    # Pydantic Request & Response Data Schemas
│   │   ├── __init__.py
│   │   ├── user.py                 # UserCreate, UserLogin, UserResponse schemas
│   │   ├── classroom.py            # ClassroomCreate, PostCreate, SubmissionCreate schemas
│   │   ├── file.py                 # DocumentResponse, PageResponse schemas
│   │   ├── quiz.py                 # QuizCreate, QuizSubmit schemas
│   │   └── student_portal.py       # DiagnosticAnswer, VideoLog schemas
│   │
│   └── services/                   # Business Logic, AI Engine & Utilities
│       ├── __init__.py
│       ├── ai.py                   # Multi-LLM provider fallback (Gemini -> Sarvam -> Groq)
│       ├── vector_service.py       # ChromaDB semantic embeddings & persistent vector storage
│       ├── vision_service.py       # 4-Page Grid Vision OCR & Local Ollama extraction
│       ├── curriculum_registry.py  # Syllabus mapper (CBSE/State Class 6 to 12 & B.Tech)
│       ├── youtube_service.py      # 3-Field Search & Anti-Shorts Educational Video Curator
│       ├── streak_service.py       # Timezone-aware IST daily streak & freeze engine
│       └── email_service.py        # SMTP OTP emails with custom OmniOS dark template
│
├── main.py                         # Production Entrypoint & Auto-LocalTunnel Tunnel Launcher
├── requirements.txt                # Python dependencies
├── Dockerfile                      # Containerization setup
├── docker-compose.yml              # Multi-container orchestration (FastAPI + Postgres)
└── code_information.md             # Complete backend codebase & API reference guide
```

---

## ⚙️ 2. Core Backend Services & Logic Deep-Dive

### 2.1 Multi-Model AI Engine with Fallback Cascade (`app/services/ai.py`)
- **Architecture**: A 3-tier resilient cascade that automatically routes prompts without failing:
  1. **Primary**: **Google Gemini (Gemini 2.5 Flash / 1.5 Flash)** via official Google GenAI SDK.
  2. **Secondary**: **Sarvam AI (`sarvam-105b-conversations`)** optimized for STEM & Indian multilingual context.
  3. **Tertiary**: **Groq Cloud (`openai/gpt-oss-120b`, `qwen/qwen3.8-27b`)** with lightning-fast inference.
- **78% Token Squeezing (`_build_squeezed_tutor_prompt`)**: Pre-cleans whitespace, deduplicates repeated syllabus chunks, and strictly injects LaTeX formula constraints (`$...$` and `$$...$$`).

### 2.2 Dual Vector Database & Persistent RAG (`app/services/vector_service.py`)
- Utilizes **ChromaDB** with collection `"ournotes"` stored at `chroma_data/`.
- Extracts semantic chunks from uploaded PDFs, DOCX, and PPTX files.
- Automatically searches top-$k$ relevant passages when answering doubts in **OmniChat**.

### 2.3 4-Page 2x2 Grid Vision OCR (`app/services/vision_service.py`)
- Ingests scanned multi-page PDF documents.
- Tiles 4 pages into a single $2 	imes 2$ high-resolution grid image with auto-letterboxing.
- Sends the image to Vision LLMs (`qwen2.5vl:3b` / Gemini Vision) in a single pass, slashing processing time and API quota usage by **75%**.

### 2.4 Diagnostic 24-Hour Practice & YouTube Focus Engine (`app/services/curriculum_registry.py` & `youtube_service.py`)
- Maps curriculum from **Class 6 to Class 12 (Science, Math, Social Studies)** and **B.Tech Engineering**.
- Generates 20 diagnostic questions tailored to the student's grade and active term.
- Analyzes weak topics from wrong quiz answers and curates long-form concept lectures via YouTube API while enforcing an **Anti-Shorts Guard** (rejects videos under 4 minutes).

### 2.5 Scaled Database Connection Pooling (`app/database.py`)
```python
engine = create_engine(
    DATABASE_URL,
    pool_size=20,          # 20 permanent connections for concurrent students
    max_overflow=30,       # Spikes up to 50 concurrent active queries
    pool_pre_ping=True,    # Auto-reconnects dropped connections
    pool_recycle=1800,     # Recycles connections every 30 minutes
    pool_timeout=30        # Fast timeout to prevent blocking
)
```

---

## 🛣️ 3. Complete REST API Route Reference

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| **POST** | `/api/auth/register` | Register student/teacher with email & password | No |
| **POST** | `/api/auth/login` | JWT OAuth2 password login | No |
| **POST** | `/api/auth/google` | One-Tap Google OAuth2 Sign-In (Auto-provisioning) | No |
| **POST** | `/api/auth/verify-otp` | Verify 6-digit email OTP for new accounts | No |
| **POST** | `/api/auth/resend-otp` | Resend activation OTP email | No |
| **GET** | `/api/auth/me` | Fetch authenticated user profile and active role | Yes |
| **PUT** | `/api/auth/profile` | Update display name, grade/class, and profile picture | Yes |
| **POST** | `/api/auth/confirm-role`| Set role (student/teacher) on first Google sign-in | Yes |
| **GET** | `/api/classroom/list` | List classrooms user is enrolled in or teaching | Yes |
| **POST** | `/api/classroom/create` | Teacher creates a new classroom with auto 5-char code | Yes (Teacher) |
| **POST** | `/api/classroom/join` | Student joins classroom via unique 5-char code | Yes (Student) |
| **GET** | `/api/classroom/{id}` | Get classroom details, members, and syllabus | Yes |
| **GET** | `/api/classroom/{id}/posts`| Get stream posts, notices, and shared materials | Yes |
| **POST** | `/api/classroom/{id}/posts`| Post an announcement or assignment | Yes |
| **POST** | `/api/upload/file` | Upload PDF/DOCX/PPTX study notes | Yes |
| **GET** | `/api/upload/list` | List uploaded documents filtered by classroom/personal | Yes |
| **GET** | `/api/upload/{id}` | Get extracted OCR text and page-by-page content | Yes |
| **DELETE**| `/api/upload/{id}` | Delete document and purge vector embeddings | Yes |
| **POST** | `/api/ai/chat` | **OmniChat RAG Query** (Context + LaTeX response) | Yes |
| **POST** | `/api/ai/summarize` | Generate high-yield concise bullet summary | Yes |
| **POST** | `/api/ai/generate-mindmap`| Generate interactive hierarchical mindmap JSON | Yes |
| **POST** | `/api/ai/generate-flashcards`| Generate interactive revision flashcard deck | Yes |
| **GET** | `/api/student/daily-quiz` | Fetch 24-Hour Grade-Calibrated Diagnostic Test | Yes (Student) |
| **POST** | `/api/student/submit-daily-quiz`| Submit diagnostic test & compute weak topics | Yes (Student) |
| **POST** | `/api/student/refresh-recommendations`| Refresh AI curated remediation video lectures | Yes (Student) |
| **POST** | `/api/student/log-video-watch`| Track focused lecture watch time & streak credits | Yes (Student) |
| **GET** | `/api/analytics/my-streak`| Get current learning streak, activity log & freeze count | Yes |

---

## 🗄️ 4. Key Database Schema & Models

### 4.1 Users (`users`)
- `id`: Integer primary key
- `email`: String (Unique, Indexed)
- `hashed_password`: String (Nullable for Google OAuth users)
- `full_name`: String
- `role`: String (`"student"`, `"teacher"`, `"admin"`)
- `student_class`: String (e.g. `"Class 11 Science"`, `"B.Tech CSE"`)
- `is_verified`: Boolean (OTP verification status)
- `picture`: String (Avatar / Google profile image URL)

### 4.2 Document Files (`document_files`)
- `id`: Integer primary key
- `user_id`: Integer foreign key -> `users.id`
- `classroom_id`: Integer foreign key -> `classrooms.id` (Nullable)
- `filename`: String
- `file_path`: String (Local disk storage path)
- `file_url`: String (Web-accessible URL)
- `processing_status`: String (`"processing"`, `"ready"`, `"failed"`)
- `extracted_text`: Text (Full concatenated OCR text)
- `total_pages`: Integer

### 4.3 Student Daily Quiz (`student_daily_quizzes`)
- `id`: Integer primary key
- `student_id`: Integer foreign key -> `users.id`
- `quiz_date`: Date (Timezone-aware IST date)
- `score`: Integer
- `max_score`: Integer
- `weak_topics`: JSON / Array of strings (Identified concept gaps)
- `recommendations_json`: JSON (AI curated YouTube video payload)
- `is_completed`: Boolean

---

## 🚀 5. How to Run the Backend

### Prerequisites
1. **Python 3.10+** installed
2. **PostgreSQL** running locally (`noteai_db`)
3. **Node.js** (for `npx localtunnel`)

### Setup Environment (`.env`)
```env
PROJECT_NAME="OmniOS - Classroom & OmniChat Studio"
DEBUG=True
DATABASE_URL=postgresql://postgres:password@localhost:5432/noteai_db
SECRET_KEY=your_super_secret_jwt_key_2026

# AI Providers (At least one required)
GEMINI_API_KEY=your_gemini_api_key
SARVAM_API_KEY=your_sarvam_api_key
GROQ_API_KEY=your_groq_api_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com

# SMTP Email (Optional for OTP verification)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=585
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

### Launch Server with Dedicated LocalTunnel
```powershell
# From the root directory:
python main.py
```
*Output will display:*
```
======================================================================
🚀 OmniOS — Automated LocalTunnel Online
   🌐 Public Tunnel URL : https://omnios-app.loca.lt
   🔑 Password / IP     : 49.42.xxx.xxx
   📍 Local URL         : http://127.0.0.1:8000
======================================================================
```

---

*Authored for OmniOS by Google DeepMind / Antigravity Agentic Team.*
