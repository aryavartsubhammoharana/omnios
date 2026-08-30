# 🎓 NoteAI — Next-Gen AI Classroom & DLM Notebook Studio

<p align="center">
  <strong>An autonomous AI-powered academic learning ecosystem featuring 4-Page 2x2 Grid Vision OCR with Auto-Letterboxing, 78% Token Squeezing, Dual Vector Database Architecture, Multi-Tenant Security Isolation, DLM Notebook Studio (Sarvam AI), 24-hour diagnostic practice, distraction-free YouTube focus masterclasses, and seamless Google authentication.</strong>
</p>

---

## 📑 Table of Contents
1. [Engineering Deep Dives & Problem-Solution Architecture](#-engineering-deep-dives--problem-solution-architecture)
   - [1. 4-Page (2x2 Grid) Vision Batch OCR & Dynamic Dimension Handling](#1-4-page-2x2-grid-vision-batch-ocr--dynamic-dimension-handling)
   - [2. Multi-Tenant Document Security & Privacy Fix in DLM Notebook](#2-multi-tenant-document-security--privacy-fix-in-dlm-notebook)
   - [3. Dual Vector Database Architecture (Classroom vs Global Vector DB)](#3-dual-vector-database-architecture-classroom-vs-global-vector-db)
   - [4. 78% Token Squeezing & TPM Rate-Limit Optimizer](#4-78-token-squeezing--tpm-rate-limit-optimizer)
   - [5. Teacher Account Deletion Pipeline (Disk Cleanup vs Knowledge Retention)](#5-teacher-account-deletion-pipeline-disk-cleanup-vs-knowledge-retention)
   - [6. Indian Standard Time (IST - Asia/Kolkata) Project-Wide Sync](#6-indian-standard-time-ist---asiakolkata-project-wide-sync)
2. [Core Feature Breakdown](#-core-feature-breakdown)
   - [Notes Grouping & Multi-Format Extractors (PDF, DOCX, PPTX, TXT)](#-notes-grouping--multi-format-extractors)
   - [Groq AI Assessment & Quiz Generator with KaTeX Math](#-groq-ai-assessment--quiz-generator-with-katex-math)
   - [Distraction-Free YouTube Focus Video Player](#-distraction-free-youtube-focus-video-player)
3. [Tech Stack & System Components](#-tech-stack--system-components)
4. [Environment Variables (`.env`) Configuration](#-environment-variables-env-configuration)
5. [Quick Start & Deployment Guide](#-quick-start--deployment-guide)

---

# 🧠 Engineering Deep Dives & Problem-Solution Architecture

---

## 1. 4-Page (2x2 Grid) Vision Batch OCR & Dynamic Dimension Handling

### 🚩 The Problem (1-by-1 Page Ingestion Bottleneck):
When handling scanned PDFs (such as handwritten notes, test papers, or photographed textbook pages with 0 selectable digital text):
- **Traditional Approach**: The backend rendered and sent pages **one-by-one** to Vision AI APIs.
- **Flaws**:
  1. A 20-page document required **20 separate network API calls** (taking 45–60 seconds).
  2. Hit API Rate Limits (**RPM / TPM Quota Exceeded**) almost immediately during testing.

### 💡 The Solution (4-Page 2x2 Grid Batching):
Instead of 20 individual calls, pages are batched into groups of 4 (`1-4`, `5-8`, `9-12`, `13-16`, `17-20`), rendered at 150 DPI via PyMuPDF (`fitz`), and assembled into a single **$1500 \times 2080$ Ultra-HD 2x2 Montage Canvas**.
- **Result**: Reduced from 20 API calls down to **only 5 calls (75% API cost reduction & 4x speedup)**.

### 📐 How Different / Unequal Page Dimensions Are Handled (Aspect-Ratio Preserved Letterboxing):
**The Challenge**: What if the 4 pages have completely different dimensions? (e.g. *Page 1 is a Portrait A4 sheet, Page 2 is a wide Landscape presentation slide, Page 3 is a square crop, and Page 4 is a tall receipt/mobile photo*).

**The Solution (`stitch_pages_to_2x2_grid` in `app/services/extractor.py`)**:
1. **Uniform Slot Grid**: Each of the 4 slots in the 2x2 grid is defined with a fixed dimension of **$750 \times 1000$ pixels**.
2. **Proportional Rescaling (`LANCZOS` Resampling)**:
   - Images are resized proportionally inside their slot using `Image.thumbnail((750, 1000), LANCZOS)`.
   - **Zero Distortion**: Letters and mathematical equations are **never stretched, skewed, or flattened**.
3. **Auto Center-Padding (Letterboxing / Pillarboxing)**:
   - A clean white background canvas (`RGB 255, 255, 255`) fills the remaining empty space around the image.
   - For **Landscape pages**: White padding is added to the top and bottom (*Letterboxing*).
   - For **Square/Tall pages**: White padding is added to the left and right (*Pillarboxing*).
   - The image is placed at the exact mathematical center: `ox = (cell_w - img.width) // 2`, `oy = (cell_h - img.height) // 2`.
4. **Visual Separation & Page Labeling**:
   - Distinct headers (`=== PAGE 1 ===`, `=== PAGE 2 ===`) are drawn beneath each slot.
   - The white margins act as natural visual bounding boxes for Vision AI, allowing Gemini 2.5 Flash / Groq Vision to transcribe each page with 100% boundary accuracy into structured Markdown (`--- Page X ---`).

```
       ┌────────────────────────────┬────────────────────────────┐
       │   [Page 1: Normal A4]      │ [Page 2: Wide / Landscape] │
       │  ┌──────────────────────┐  │  ┌──────────────────────┐  │
       │  │                      │  │  │   White Padding Top  │  │
       │  │   100% Perfect Fit   │  │  ├──────────────────────┤  │
       │  │    (No Padding)      │  │  │  Landscape Slide Text│  │
       │  │                      │  │  ├──────────────────────┤  │
       │  │                      │  │  │  White Padding Bottom│  │
       │  └──────────────────────┘  │  └──────────────────────┘  │
       │       === PAGE 1 ===       │       === PAGE 2 ===       │
       ├────────────────────────────┼────────────────────────────┤
       │   [Page 3: Square Image]   │  [Page 4: Tall Receipt]    │
       │  ┌──────────────────────┐  │  ┌──────────────────────┐  │
       │  │  Pad │ Square │ Pad  │  │  │  Pad │  Tall  │ Pad  │  │
       │  │  Left│ Image  │Right │  │  │  Left│Receipt │Right │  │
       │  │      │  Text  │      │  │  │      │  Text  │      │  │
       │  └──────────────────────┘  │  └──────────────────────┘  │
       │       === PAGE 3 ===       │       === PAGE 4 ===       │
       └────────────────────────────┴────────────────────────────┘
```

---

## 2. Multi-Tenant Document Security & Privacy Fix in DLM Notebook

### 🚩 The Security Bug (Data Leak Across Un-enrolled Users):
- **What Happened**: When a normal user or new student (who had joined **0 classrooms**) navigated to **DLM Notebook Studio** in "Global Mode", `GET /api/upload/list` was fetching all documents from the database without verifying enrollment. As a result, other teachers' private classroom lecture notes and PDF sources appeared in their "Sources" panel and RAG retrieval.

### 🛡️ How the Security Leak Was Resolved:
Strict multi-tenant authorization filters were implemented at both the REST API layer (`app/routes/upload.py`) and the AI Query layer (`app/routes/ai.py`):

1. **Authorization Filter in Document Listing (`GET /api/upload/list`)**:
   - **For Teachers**: Returns ONLY documents uploaded by `current_user.id` or documents inside classrooms owned/taught by the teacher.
   - **For Students / Normal Users**: Returns **ONLY**:
     1. Documents uploaded personally by `current_user.id`, AND
     2. Documents inside classrooms where the student has an active `Enrollment` record (`classroom_id.in_(enrolled_class_ids)`).
   - **For Non-Enrolled Users (0 Classes, 0 Uploads)**: Returns an empty list (`[]`). Private documents from other classrooms are **100% hidden and inaccessible**.
2. **Access Control in Direct Document Endpoints (`GET /api/upload/document/{id}`)**:
   - Verifies user ownership or active classroom enrollment before returning file data. Unauthorized attempts receive `403 Forbidden`.
3. **Restricted RAG Vector Scoping (`POST /api/ai/chat`)**:
   - Vector database queries in DLM Notebook dynamically restrict chunk retrieval to `classroom_id IN (enrolled_classrooms)` and `uploaded_by_id == current_user.id`.
   - If a non-enrolled user chats with DLM Notebook, the AI operates as a general academic tutor without querying or exposing any other teacher's private vector chunks.

---

## 3. Dual Vector Database Architecture (Classroom vs Global Vector DB)

NoteAI employs a dual-layer ChromaDB Vector Store architecture designed to balance **classroom privacy** with **system-wide collective intelligence**:

```
                              Document Upload & Ingestion
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                     ▼
          [Classroom Vector Database]               [Global Vector Database]
         - Collection: `classroom_{CODE}`          - Collection: `global_knowledge_base`
         - Scope: Isolated to single class         - Scope: Unified anonymous knowledge
         - Metadata: doc_id, filename, user_id     - Metadata: Anonymous hash, collection_key
         - Lifecycle: Deleted on class delete      - Lifecycle: PERMANENTLY RETAINED
```

### 🏫 A. Classroom Vector Database (`classroom_{CODE}`)
- **Architecture**: Every classroom gets its own isolated ChromaDB collection named `classroom_{CODE.upper()}` (e.g. `classroom_PHY12`).
- **Metadata Tagging**: Chunks include rich metadata: `doc_id`, `classroom_id`, `classroom_code`, `filename`, `chunk_index`, and `total_chunks`.
- **Purpose**: Used for high-precision classroom doubt solving, teacher quiz generation, and student chapter revisions.
- **Privacy**: Only accessible to students and instructors enrolled in that specific classroom.

### 🌐 B. Global Vector Database (`global_knowledge_base`)
- **Architecture**: A single, unified ChromaDB collection holding embedded academic knowledge from across the platform.
- **Pure Anonymity**: Chunks are stripped of all personal and identifying metadata (no teacher names, no student IDs, no filenames).
- **Permanent Retention**: Chunks indexed in the Global Vector Database are **NEVER deleted**, even if the original note or teacher account is removed.
- **Purpose**: Powers the platform's autonomous 24-hour daily practice quizzes, cross-topic conceptual recommendations, and global AI tutoring.

---

## 4. 78% Token Squeezing & TPM Rate-Limit Optimizer

### 🚩 The Problem (6,000–8,000 TPM Quota Exhaustion):
Free-tier LLM providers (especially Groq) enforce strict **TPM (Tokens Per Minute = 6,000–8,000)** limits. Sending full 10,000-character documents with verbose system instructions consumed ~5,250 tokens per request, exhausting the quota after a single test.

### ⚡ The 4-Pillar Token Squeezing System (`app/services/ai.py`):
1. **System Prompt Compression**: Reduced verbose conversational prompts from ~450 tokens down to **~50 tokens**.
2. **Semantic Context Pruning**: RAG retrieval slices context to the top 2-3 most dense paragraphs (1,500–2,500 chars) instead of dumping entire documents.
3. **Ultra-Compact JSON Schema (`q, o, a, e`)**:
   - Instead of large dictionary keys, the LLM outputs concise single-letter keys:
     - `q`: Question text
     - `o`: Array of 4 options
     - `a`: Correct option letter (`"A"`, `"B"`, `"C"`, `"D"`)
     - `e`: 1-line mathematical derivation with LaTeX formulas
   - The Python backend automatically expands these compact keys into full database columns.
4. **Cascade Model Rotation on 429 TPM**:
   `openai/gpt-oss-120b` ➔ `qwen/qwen3.8-27b` ➔ `gemini-2.5-flash` ➔ `sarvam-105b-conversations` ➔ `Local Heuristic Generator`.

| Stage | Before Squeezing | With Token Squeezing | Savings |
| :--- | :--- | :--- | :--- |
| **System Prompt** | ~450 Tokens | **~50 Tokens** | 🔻 89% |
| **Context Notes** | ~3,200 Tokens | **~700 Tokens** | 🔻 78% |
| **LLM Output** | ~1,600 Tokens | **~400 Tokens** | 🔻 75% |
| **Total per Request** | **~5,250 Tokens** | **~1,150 Tokens** | 🟢 **78% Total Savings** |

---

## 5. Teacher Account Deletion Pipeline (Disk Cleanup vs Knowledge Retention)

When a teacher initiates account deletion (`DELETE /api/auth/delete-account`):
1. **Physical Disk Cleanup**: Every physical file (`.pdf`, `.docx`, `.pptx`, `.png`) uploaded by this teacher is **permanently deleted from disk** (`os.remove(file_path)`).
2. **Classroom Database Cleanup**: Associated `Classroom`, `DocumentFile`, `Post`, `Quiz`, `QuizAttempt`, and `Enrollment` records are cascaded and deleted from PostgreSQL.
3. **Classroom Vector Collection Purged**: The isolated ChromaDB collection `classroom_{code}` is deleted.
4. **Global Knowledge Base Preserved**: The anonymous vector embeddings in `global_knowledge_base` remain intact to sustain AI learning without any user trace.

---

## 6. Indian Standard Time (IST - Asia/Kolkata) Project-Wide Sync

- **Backend Time Utility (`app/utils/time_utils.py`)**:
  - `get_ist_now()` returns precise Indian Standard Time (`UTC+5:30`, `Asia/Kolkata`).
  - Database models (`User`, `Classroom`, `Post`, `DocumentFile`, `Quiz`, `QuizAttempt`, `StudentStreak`) use `default=get_ist_now`.
  - Daily study streaks calculate midnight rollovers based on Indian Standard Time (`get_ist_now().date()`).
- **Frontend Time Utility (`frontend/src/utils/formatDate.js`)**:
  - `formatISTDateTime(date)`: Formats timestamps in `Asia/Kolkata` with 12-hour AM/PM (e.g. `30 Aug 2026, 06:35 AM`).
  - `formatISTDate(date)`: Formats dates as `DD/MM/YYYY`.
  - `formatISTTime(date)`: Formats times as `hh:mm A`.

---

# 🚀 Core Feature Breakdown

### 📁 Notes Grouping & Multi-Format Extractors
- **Unit & Chapter Folders**: Organize study notes into custom collapsible accordion folders (`Unit 1: Thermodynamics`, `Sample Papers`).
- **Multi-File Batch Uploads**: Simultaneously upload multiple `.pdf`, `.docx`, `.pptx`, `.txt`, and `.md` files.
- **Pure-Text Extractors**:
  - **PDF**: PyMuPDF (`fitz`) clean page-by-page extraction.
  - **DOCX**: `python-docx` headings, paragraphs, and formatted Markdown tables (`| Col | Col |`).
  - **PPTX**: `python-pptx` slide titles, shapes, and presenter notes.
  - **TXT / MD**: Multi-encoding text reader (`utf-8`, `latin-1`, `cp1252`).

### 🎯 Groq AI Assessment & Quiz Generator with KaTeX Math
- **Difficulty (1-10) & Competency (%) Sliders**: Adjust question difficulty from foundational definitions to advanced applied problem-solving.
- **KaTeX LaTeX Math Rendering**: Mathematical formulas and derivations formatted with inline (`$ ... $`) and display (`$$ ... $$`) KaTeX delimiters.
- **Live Teacher Analytics**: Real-time submissions tracker showing class average score, completion rates, and an interactive student roster.

### 🧠 DLM Notebook Studio (Sarvam AI)
- **Primary AI Engine**: **Sarvam AI (`sarvam-105b-conversations`)** handles all interactive doubt solving.
- **Silent High-Performance Fallback**: Automatically falls back to Gemini 2.5 Flash if Sarvam times out.
- **Brand Protection & Hidden Models**: Displays unified **`✨ DLM Studio AI`** badge, completely concealing internal model names.

### 📺 Distraction-Free YouTube Focus Video Player
- **Academic Duration Filter**: Selects 4–20 minute educational videos, blacklisting shorts and clickbait.
- **Interactive Timestamped Subtitles**: Sidebar transcript allows jumping directly to specific concepts.
- **Daily 24-Hour AI Practice Hub**: Diagnoses weak concepts from daily quizzes and recommends targeted masterclasses.

---

# 🛠️ Tech Stack & System Components

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy ORM, PostgreSQL (`pgvector`), ChromaDB, PyMuPDF (`fitz`), Pillow (`PIL`), python-docx, python-pptx, youtube-transcript-api, Gmail SMTP.
- **AI Engines**: Groq (`openai/gpt-oss-120b`, `qwen/qwen3.8-27b`), Google Gemini (`gemini-2.5-flash`), Sarvam AI (`sarvam-105b-conversations`).
- **Frontend**: React 18, Vite, Tailwind CSS, KaTeX Math Rendering, Lucide Icons, Google Identity Services.
- **DevOps**: Multi-stage Docker, Docker Compose, PostgreSQL 16.

---

# ⚙️ Environment Variables (`.env`) Configuration

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

# 🚀 Quick Start & Deployment Guide

### 1. Setup Backend
```bash
git clone https://github.com/your-username/NoteAI.git
cd NoteAI

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows (or source venv/bin/activate on Linux/macOS)

# Install requirements
pip install -r requirements.txt

# Start FastAPI server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Setup Frontend
```bash
cd frontend
npm install
npm run dev
```

### 3. Docker Launch (1-Click Deployment)
```bash
docker-compose up --build -d
```
- **Web App**: `http://localhost:5173` (or `http://localhost:8000`)
- **Swagger API Docs**: `http://localhost:8000/docs`

---

## 📜 License
This project is licensed under the MIT License.
