# 🎓 NoteAI — Next-Gen AI Classroom & DLM Notebook Studio

<p align="center">
  <strong>An autonomous AI-powered academic learning ecosystem featuring 4-Page 2x2 Grid Vision OCR, 78% Token Squeezing, DLM Notebook Studio (Sarvam AI), 24-hour diagnostic practice, distraction-free YouTube focus masterclasses, and seamless Google authentication.</strong>
</p>

---

## 🌟 Core System Architecture & How It Works

### 1. 🖼️ 4-Page (2x2 Grid) Vision Batch OCR (`app/services/extractor.py`)
- **What It Does**: Transcribes scanned image-only PDFs (with 0 selectable digital text) at **4x faster speed** and **75% reduced API cost**.
- **How It Works (Step-by-Step)**:
  1. **Zero-Text Detection**: PyMuPDF (`fitz`) inspects the uploaded PDF. If digital text exists, it extracts instantly in 0.1s. If digital text is 0 (scanned photos/pages), it automatically triggers the **2x2 Grid Pipeline**.
  2. **4-Page Batching & 2x2 Montage**: Pages are grouped into chunks of 4 (`1-4`, `5-8`, `9-12`, etc.).
  3. **Aspect-Ratio Preserved Center-Padding (Letterboxing)**:
     - Each grid slot is standard $750 \times 1000$ pixels.
     - Pages are resized proportionally via `LANCZOS` resampling (no stretching/distortion).
     - Clean white padding is centered around uneven or landscape pages (no cropping/cutting).
     - Distinct labels (`=== PAGE X ===`) are drawn under each cell.
  4. **Single Vision AI Ingestion**: The resulting $1500 \times 2080$ Ultra-HD canvas is sent to Vision AI (Gemini 2.5 Flash / Groq Vision).
  5. **Structured Output**: Vision AI returns page-segregated Markdown (`--- Page 1 ---`, `--- Page 2 ---`, etc.) complete with LaTeX formulas.

```
┌────────────────────────────┬────────────────────────────┐
│       === PAGE 1 ===       │       === PAGE 2 ===       │
│   (Top-Left Page Image)    │   (Top-Right Page Image)   │
├────────────────────────────┼────────────────────────────┤
│       === PAGE 3 ===       │       === PAGE 4 ===       │
│  (Bottom-Left Page Image)  │  (Bottom-Right Page Image) │
└────────────────────────────┴────────────────────────────┘
```

---

### 2. ⚡ 78% Token Squeezing & TPM Rate-Limit Optimizer (`app/services/ai.py`)
- **What It Does**: Solves free LLM rate limits (6,000–8,000 Tokens Per Minute - TPM) by compressing prompts and outputs by **78%**, allowing 5–6 continuous quiz/chat calls per minute without HTTP 429 errors.
- **How It Works**:
  1. **Input Prompt Squeezing**: Strips verbose conversational fluff down to dense instruction tokens (reduced from ~450 to ~50 tokens).
  2. **Semantic Context Pruning**: Feeds only the top 2-3 most dense vector chunks (1,500–2,500 chars) instead of dumping entire 10,000+ character documents.
  3. **Ultra-Compact JSON Schema (`q, o, a, e`)**:
     ```json
     {
       "questions": [
         {
           "q": "What is the First Law of Thermodynamics?",
           "o": ["Energy is conserved", "Energy decays", "Heat is zero", "None"],
           "a": "A",
           "e": "Energy cannot be created or destroyed: $\\Delta U = Q - W$"
         }
       ]
     }
     ```
     *(The Python backend automatically maps these short keys into full database columns).*
  4. **Multi-Model Cascade Rotation**:
     `openai/gpt-oss-120b` ➔ `qwen/qwen3.8-27b` ➔ `gemini-2.5-flash` ➔ `sarvam-105b-conversations` ➔ `Local Heuristic Generator`.

---

### 3. 🇮🇳 Indian Standard Time (IST - Asia/Kolkata / UTC+5:30) Synchronization
- **Backend Time Utility (`app/utils/time_utils.py`)**:
  - Centralized `get_ist_now()` returns precise Indian Standard Time.
  - All SQLAlchemy models (`User`, `Classroom`, `Post`, `DocumentFile`, `Quiz`, `QuizAttempt`, `StudentStreak`) use `default=get_ist_now`.
  - Daily study streaks calculate midnight rollovers based on Indian Standard Time (`get_ist_now().date()`).
- **Frontend Time Utility (`frontend/src/utils/formatDate.js`)**:
  - `formatISTDateTime(date)`: Formats timestamps in `Asia/Kolkata` with 12-hour AM/PM (e.g. `30 Aug 2026, 06:35 AM`).
  - `formatISTDate(date)`: `DD/MM/YYYY`.
  - `formatISTTime(date)`: `hh:mm A`.

---

### 4. 🧠 DLM Notebook AI Studio (`app/routes/ai.py` & `NotebookLMStudio.jsx`)
- **Primary AI Engine**: **Sarvam AI (`sarvam-105b-conversations`)** handles all doubt-solving queries.
- **Silent Gemini Fallback**: In case of Sarvam network timeouts, it seamlessly falls back to Gemini 2.5 Flash without exposing error states.
- **No Groq Fallback**: Excluded from DLM Notebook for strict context fidelity.
- **Brand Protection & Hidden Model Names**: UI and API responses display **`✨ DLM Studio AI`** and **`DLM Notebook AI`**, completely hiding internal model names and provider details from users.
- **Strict Multi-Tenant Isolation**: Students only query documents from classrooms they are enrolled in or their personal uploads. An un-enrolled user cannot see or query private classroom documents.

---

### 5. 📁 Notes Grouping & Multi-Format Extractors (`app/services/extractor.py`)
- **Unit & Chapter Folders**: Teachers can create custom folders (e.g. `Unit 1: Thermodynamics`, `Sample Papers`) and organize notes in collapsible accordions.
- **Multi-File Batch Uploads**: Upload multiple files simultaneously (`.pdf`, `.docx`, `.doc`, `.pptx`, `.ppt`, `.txt`, `.md`).
- **Dedicated Clean Extractors**:
  - **PDF**: PyMuPDF (`fitz`) page-by-page extraction.
  - **DOCX**: `python-docx` headings, paragraphs, and formatted Markdown tables (`| Col | Col |`).
  - **PPTX**: `python-pptx` slide titles, text boxes, and presenter notes.
  - **TXT / MD**: Multi-encoding text reader (`utf-8`, `latin-1`, `cp1252`).

---

### 6. 🎯 AI Practice Quiz Generator & Live Submissions Tracker (`app/routes/quiz.py`)
- **Custom Difficulty & Competency Sliders**:
  - Difficulty Scale: `1/10` (Foundational) to `10/10` (Advanced problem solving).
  - Competency Target: `0%` to `100%` real-world scenario questions.
- **KaTeX LaTeX Math Rendering**: Mathematical formulas are wrapped in `$ ... $` (inline) and `$$ ... $$` (display).
- **Live Teacher Analytics**:
  - Enrolled Student Count, Completed Attempts, Pending Submissions, and Class Average Score.
  - Instant searchable student roster with timestamps and individual attempt scores.

---

### 7. 🔒 Dual Vector Database & Teacher Account Deletion Pipeline
- **Classroom Isolated Collections (`classroom_{code}`)**: Per-classroom isolated ChromaDB collections with full document metadata.
- **Permanent Global Vector Database (`global_knowledge_base`)**: All anonymous knowledge chunks are permanently retained to continuously train and enrich the system's collective intelligence.
- **Teacher Account Deletion (`DELETE /api/auth/delete-account`)**:
  - Deletes physical files from disk (`uploads/documents/`).
  - Purges classroom records and isolated classroom vector collections.
  - **Preserves Global Vector DB**: The global knowledge base remains intact without any user linking.

---

### 8. 📺 Distraction-Free YouTube Focus Video Masterclasses
- **Academic Filter**: Automatically filters for 4–20 minute educational videos, blacklisting shorts and clickbait.
- **Timestamped Transcripts**: Sidebar displays synchronized transcript cues. Clicking timestamps jumps the video directly to that concept.
- **Daily 24-Hour AI Practice Hub**: Automatically diagnoses weak topics from quiz attempts and recommends targeted video masterclasses.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy ORM, PostgreSQL (`pgvector`), ChromaDB, PyMuPDF (`fitz`), Pillow (`PIL`), python-docx, python-pptx, youtube-transcript-api, Gmail SMTP.
- **AI Engines**: Groq (`openai/gpt-oss-120b`, `qwen/qwen3.8-27b`), Google Gemini (`gemini-2.5-flash`), Sarvam AI (`sarvam-105b-conversations`).
- **Frontend**: React 18, Vite, Tailwind CSS, KaTeX Math Rendering, Lucide Icons, Google Identity Services.
- **DevOps & Containerization**: Multi-stage Docker, Docker Compose, PostgreSQL 16.

---

## ⚙️ Environment Variables Configuration (`.env`)

```env
# PostgreSQL Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/noteai_db
SECRET_KEY=your_super_secret_jwt_key_2026
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# AI Engine API Keys
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b

GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

SARVAM_API_KEY=your_sarvam_api_key_here
SARVAM_MODEL=sarvam-105b-conversations

# YouTube Data API
YOUTUBE_API_KEY=your_youtube_data_api_key_here

# Google OAuth 2.0
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=

# Email OTP Service (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_16_char_app_password
EMAIL_FROM=NoteAI Support <noreply@noteai.com>
```

---

## 🚀 Quick Start Guide

### 1. Setup Backend
```bash
# Clone repository
git clone https://github.com/your-username/NoteAI.git
cd NoteAI

# Setup Python virtual environment
python -m venv venv
venv\Scripts\activate  # Windows (or source venv/bin/activate on Linux/macOS)

# Install Python packages
pip install -r requirements.txt

# Launch FastAPI Backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Setup Frontend
```bash
cd frontend

# Install Node dependencies
npm install

# Launch Vite Dev Server
npm run dev
```

### 3. Docker Compose (1-Click Production Deployment)
```bash
docker-compose up --build -d
```

- **Web Application**: `http://localhost:5173` (or `http://localhost:8000` via Docker)
- **Interactive Swagger API Docs**: `http://localhost:8000/docs`

---

## 📜 License
This project is licensed under the MIT License.
