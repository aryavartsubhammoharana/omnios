# 🎓 NoteAI — Next-Gen Google Classroom & DLM Notebook Studio

<p align="center">
  <strong>An autonomous AI-powered academic learning ecosystem featuring 24-hour diagnostic practice, distraction-free YouTube focus masterclasses, precision document shower, and seamless Google authentication.</strong>
</p>

---

## 🌟 Key Features

### 1. 🔐 Dual Authentication & Security
- **1-Click Google Sign-In (OAuth 2.0)**: Instant login via Google Identity Services. Pre-verified email with automatic Name, Email, and Avatar syncing — **No OTP required**.
- **Server Account Registration (Email OTP)**: Create accounts directly on server with automatic **6-digit HTML OTP Email Verification** powered by Gmail SMTP.
- **Role-Based Access**: Dedicated workflows for **Students** and **Teachers**.

### 2. 👤 Student Profile & Account Management
- **Editable Class / Grade**: Selectable dropdown (*Class 11 Science, Class 12, Class 10 Board, Class 9, JEE / NEET Advanced, College / Engineering*) used by AI to personalize all tests and recommendations.
- **Custom Profile Photo Upload**: Upload custom images (`.png`, `.jpg`, `.webp`) or use Google profile avatars.
- **Password Management**: In-app secure password updates.
- **Permanent Account Deletion (Danger Zone)**: Cascading unenrollment from all classrooms, with deletion of quizzes, streaks, and personal data.

### 3. 🎯 Autonomous 24-Hour Daily AI Practice & Diagnostics
- **Automated Diagnostic Quizzes**: Every 24 hours, NoteAI reads all enrolled classroom lecture notes and generates a personalized conceptual MCQ assessment with KaTeX formulas.
- **Weak Topic Detection**: Isolates specific weak topics and conceptual gaps from incorrect answers.
- **Gamified Streaks & Study Seconds**: Live daily streak counter (🔥) and watch-time focus tracking.

### 4. 📺 Distraction-Free YouTube Focus Video Player
- **Zero Shorts / Zero Clickbait Filter**: Enforces academic duration filters (4–20 minutes) and blacklists entertainment junk, reels, and clickbait.
- **AI Query Expansion**: Groq 120B expands weak topics into targeted queries across trusted educational channels (*Khan Academy, Physics Wallah, Unacademy, Vedantu, MIT OpenCourseWare, NPTEL, Amoeba Sisters*).
- **Interactive Timestamped Subtitles**: Full transcript sidebar synchronized with the video. Clicking timestamps jumps the player directly to that explanation.
- **Live Focus Session Tracker**: Logs every second of active watch time into student analytics.

### 5. 🔎 3-Field Targeted Academic Search
- **Topic / Concept / Chapter**: Free-form search (e.g. *Bernoulli Equation, Fluid Dynamics, Transport in Plants*).
- **Context / Goal (Dropdown)**: *Full Chapter One Shot, Concept & Derivations, Numerical & Problems, Animated Masterclass, Quick Revision*.
- **According to Class (Dropdown)**: *Class 11 / 12, Class 10, Class 9, JEE / NEET, College / Engineering*.

### 6. 📄 Universal PDF & DOCX Smooth Document Shower
- **A4 Multi-Page Paginated Canvas**: Renders DOCX and PDF documents as realistic A4 sheets with page numbers, headers, and footers.
- **Precision Zoom & Font Adjuster**: Zoom In/Out (+/-10%), 100% Reset, and dynamic font resizing (11px to 20px).
- **3 Reading Themes**: 🌙 *Midnight Dark*, 📄 *Classic Paper White*, ☕ *Warm Sepia*.
- **Distraction-Free Fullscreen Mode**: 1-click immersive reading canvas.
- **Split-Screen Ephemeral AI Doubt Solver**: Ask instant questions while reading documents, answered in real-time by Groq 120B, Gemini, or Sarvam AI.

### 7. 🖼️ Same-Page Groq Vision OCR & Deep Diagram Analysis
- Extracts embedded diagrams and mathematical formulas from lecture notes page-by-page without cross-page mixing.
- Labels figures (`Image 1`, `Image 2`) and runs deep visual analysis using Groq Vision AI (`qwen/qwen3.6-27b`).

---

## 🛠️ Tech Stack

- **Backend**: Python 3.11 / 3.14, FastAPI, SQLAlchemy ORM, PostgreSQL (`pgvector`), PyMuPDF (`fitz`), EasyOCR, python-docx, python-pptx, youtube-transcript-api, Gmail SMTP.
- **AI & LLM Engines**: Groq (`openai/gpt-oss-120b`, `qwen/qwen3.6-27b`), Google Gemini (`gemini-2.5-flash`), Sarvam AI (`sarvam-105b-conversations`).
- **Frontend**: React 18, Vite, Tailwind CSS, KaTeX Math Rendering, Lucide Icons, Google Identity Services.
- **DevOps & Containerization**: Multi-stage Docker, Docker Compose, PostgreSQL 16 with pgvector.

---

## ⚙️ Environment Variables Configuration (`.env`)

Create a `.env` file in the root directory:

```env
# PostgreSQL Database
DATABASE_URL=postgresql://postgres:subham2007@localhost:5432/noteai_db
SECRET_KEY=noteai_super_secret_jwt_key_2026_safe_auth_token_987654
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# AI Engine API Keys
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b

GROQ_VISION_API_KEY=your_groq_vision_api_key_here
GROQ_VISION_MODEL=qwen/qwen3.6-27b

GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

SARVAM_API_KEY=your_sarvam_api_key_here
SARVAM_MODEL=sarvam-105b-conversations

# YouTube Data API
YOUTUBE_API_KEY=your_youtube_data_api_key_here

# 1. Google OAuth 2.0 (Google Login / Sign-In)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=

# 2. Email OTP Service (Gmail SMTP & App Password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_16_character_app_password
EMAIL_FROM=NoteAI Support <noreply@noteai.com>
```

---

## 🚀 Quick Start Guide

### 1. Clone & Setup Backend
```bash
git clone https://github.com/your-username/NoteAI.git
cd NoteAI

# Create Python Virtual Environment
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install Dependencies
pip install -r requirements.txt

# Start Backend Server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Setup Frontend
```bash
cd frontend

# Install Node modules
npm install

# Start Vite Development Server
npm run dev
```

### 3. Docker Compose (One-Click Launch)
```bash
docker-compose up --build -d
```
Access the application at:
- **Web UI**: `http://localhost:8000` (or `http://localhost:5173` in dev mode)
- **Interactive API Docs (Swagger)**: `http://localhost:8000/docs`

---

## 📡 Key API Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/google` | 1-Click Google Login / Signup (No OTP) |
| `POST` | `/api/auth/signup` | Server Registration (Sends 6-digit Email OTP) |
| `POST` | `/api/auth/verify-otp` | Verifies Email OTP code and issues JWT token |
| `POST` | `/api/auth/resend-otp` | Resends a fresh 6-digit verification code |
| `PUT` | `/api/auth/profile` | Updates full name and student class/grade |
| `PUT` | `/api/auth/change-password` | Updates account password |
| `POST` | `/api/auth/upload-avatar` | Uploads custom user profile photo |
| `DELETE`| `/api/auth/delete-account` | Permanently deletes account & unenrolls |
| `GET` | `/api/student/daily-quiz` | Retrieves or generates 24h diagnostic quiz |
| `POST` | `/api/student/daily-quiz/submit` | Evaluates quiz, isolates weak topics & fetches videos |
| `GET` | `/api/student/recommendations` | Returns top 10 curated lecture videos |
| `POST` | `/api/student/refresh-recommendations` | Refreshes video recommendations with new queries |
| `GET` | `/api/student/search-videos` | 3-Field search (`topic`, `context`, `class_level`) |
| `GET` | `/api/student/video-transcript/{id}` | Fetches timestamped subtitles for focus player |
| `POST` | `/api/student/track-video-focus` | Logs active focus study time to streaks |

---

## 📜 License
This project is licensed under the MIT License.
