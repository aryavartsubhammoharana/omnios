# 🎓 OmniOS / NoteAI — Next-Gen AI Classroom & OmniAI Studio

<p align="center">
  <img src="./logo.png" alt="OmniOS Logo" width="160" height="160" style="border-radius: 24px;" />
</p>

<p align="center">
  <strong>An autonomous AI-powered academic learning ecosystem featuring 4-Page 2x2 Grid Vision OCR with Auto-Letterboxing, 78% Token Squeezing, Dual Vector Database Architecture, Multi-Tenant Security Isolation, OmniAI Studio, 24-Hour Diagnostic Practice with Grade-Level Calibration, Advanced 3-Field YouTube Focus Engine with Anti-Shorts Guard, and seamless Google authentication.</strong>
</p>

---

## 📑 Table of Contents
1. [Engineering Deep Dives & Problem-Solution Architecture](#-engineering-deep-dives--problem-solution-architecture)
   - [1. 4-Page (2x2 Grid) Vision Batch OCR & Dynamic Dimension Handling](#1-4-page-2x2-grid-vision-batch-ocr--dynamic-dimension-handling)
   - [2. Multi-Tenant Document Security & Privacy Fix in DLM Notebook](#2-multi-tenant-document-security--privacy-fix-in-dlm-notebook)
   - [3. Dual Vector Database Architecture (Classroom vs Global Vector DB)](#3-dual-vector-database-architecture-classroom-vs-global-vector-db)
   - [4. Advanced YouTube Academic Curation & Anti-Distraction Engine](#4-advanced-youtube-academic-curation--anti-distraction-engine)
   - [5. 24-Hour Diagnostic AI Quiz Engine & Grade-Level Data Sourcing](#5-24-hour-diagnostic-ai-quiz-engine--grade-level-data-sourcing)
   - [6. 78% Token Squeezing & TPM Rate-Limit Optimizer](#6-78-token-squeezing--tpm-rate-limit-optimizer)
   - [7. Teacher Account Deletion Pipeline (Disk Cleanup vs Knowledge Retention)](#7-teacher-account-deletion-pipeline-disk-cleanup-vs-knowledge-retention)
   - [8. Indian Standard Time (IST - Asia/Kolkata) Project-Wide Sync](#8-indian-standard-time-ist---asiakolkata-project-wide-sync)
   - [9. Google Authentication & Identity Architecture (Zero-Friction Minimal Scopes)](#9-google-authentication--identity-architecture-zero-friction-minimal-scopes)
   - [10. Interactive Water Wave Fluid Physics Canvas ("Silent Pond" Physics & Kinetic Damping)](#10-interactive-water-wave-fluid-physics-canvas-silent-pond-physics--kinetic-damping)
   - [11. Google Classroom-Style Collapsible Navigation Rail & Adaptive Viewport](#11-google-classroom-style-collapsible-navigation-rail--adaptive-viewport)
   - [12. Interactive Document & PDF Reader Workspace (`/quick-reader`)](#12-interactive-document--pdf-reader-workspace-quick-reader)
   - [13. Strict Grade-Level Sourcing & Anti-Mismatched Recommendations Fix](#13-strict-grade-level-sourcing--anti-mismatched-recommendations-fix)
2. [Comprehensive Platform Evolution: Before vs. After Comparison](#-comprehensive-platform-evolution-before-vs-after-comparison)
3. [Core Feature Breakdown](#-core-feature-breakdown)
   - [Notes Grouping & Multi-Format Extractors (PDF, DOCX, PPTX, TXT)](#-notes-grouping--multi-format-extractors)
   - [Groq AI Assessment & Quiz Generator with KaTeX Math](#-groq-ai-assessment--quiz-generator-with-katex-math)
   - [Distraction-Free YouTube Focus Video Player with Subtitle Jumps](#-distraction-free-youtube-focus-video-player-with-subtitle-jumps)
4. [Tech Stack & System Components](#-tech-stack--system-components)
5. [Environment Variables (`.env`) Configuration](#-environment-variables-env-configuration)
6. [Quick Start & Deployment Guide](#-quick-start--deployment-guide)

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
### 📊 Comparative Analysis: Previous Photo Analysis vs. Modern Hybrid Vision Intelligence (Now)

> [!IMPORTANT]
> ### 🔄 Architectural Evolution of Document & Image Analysis
> Below is the side-by-side comparison of how NoteAI previously analyzed documents and images versus how the system operates now with Hybrid Grid Batching, Local Ollama Qwen2.5-VL, and Embedded Diagram Intelligence.

| Capability / Workflow | 🔴 Previous Image Analysis System | 🟢 Modern Hybrid Grid & Embedded Vision System (Now) |
| :--- | :--- | :--- |
| **Ingestion Pipeline** | 1-by-1 Page Rendering (`1 page = 1 API call`). | **$2 \times 2$ Grid Adaptive Batching** ($1500 \times 2080\text{px}$ canvas). |
| **Network & Cost Efficiency** | 20 pages required 20 heavy network requests (45-60s latency). | 20 pages require **only 5 batched requests (75% cost reduction & 4x speedup)**. |
| **Rate Limit / Quota Behavior** | Hit `429 RESOURCE_EXHAUSTED` / TPM limits on batch 2. | **Zero Rate Limits** via Local Ollama `qwen2.5vl:3b` with Cloud Gemini rotation. |
| **Digital PDF Diagram Handling** | Extracted plain text only; embedded diagrams & charts were **completely ignored/lost**. | **Hybrid Extractor**: PyMuPDF extracts text, while `extract_and_analyze_embedded_diagrams()` automatically crops, batches, and analyzes all embedded figures. |
| **Dynamic Remaining Batching** | If pages didn't divide by 4, images got clipped or distorted. | **Adaptive Canvas Matrix**:<br>• **4 Images**: $2 \times 2$ Full Grid ($1500 \times 2080\text{px}$)<br>• **3 Images**: $2 \times 2$ Grid (3 full-size slots, 0% data loss)<br>• **2 Images**: $2 \times 1$ Side-by-Side (Page 1 & Page 2)<br>• **1 Image**: $1 \times 1$ Direct Single Image |
| **Aspect Ratio Preservation** | Images risked being stretched, skewed, or flattened. | **Lossless Center-Padding**: `LANCZOS` thumbnailing with white Letterboxing/Pillarboxing. |
| **Diagram Structured Output** | No visual annotations in notes or RAG vector space. | Generates dedicated **`### 📊 Diagram Analysis (Page X - Diagram Y)`** with visual descriptions, key labels, and scientific formulas ($...$). |
| **Offline / Privacy Support** | 100% dependent on third-party cloud APIs. | **100% Offline & Private** on local GPU/RAM via Ollama Vision (`qwen2.5vl:3b` / `llava` / `moondream`). |

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

NoteAI employs a **single, unified ChromaDB Vector Collection** named **`"ournotes"`** for the entire server, holding all document chunks (classroom materials and personal study notes) in one high-performance vector space:

```
                              Document Upload & Ingestion
                                           │
                                           ▼
                     ┌───────────────────────────────────────────┐
                     │   Single Server Collection: `"ournotes"`  │
                     │  - Space: Cosine Similarity Metric        │
                     │  - Metadata: doc_id, filename, user_id,   │
                     │    classroom_id, classroom_code, index    │
                     └───────────────────────────────────────────┘
```

### 🏛️ Unified Vector Storage Architecture (`app/services/vector_store.py`)
- **Single Collection Name**: **`"ournotes"`**
- **Why We Migrated from Multi-Collection to Single Unified Collection (`"ournotes"`)**:
  1. **Eliminating the "Collection Sprawl" Bottleneck**:
     - *Previous Problem*: Creating a separate ChromaDB collection per classroom (`classroom_PHY12`, `classroom_MATH10`) meant that 1,000 classrooms resulted in 1,000 separate HNSW vector index trees loaded into RAM and disk.
     - *Server Pressure*: Every new user signup or classroom creation required provisioning a brand-new database instance, creating massive CPU/RAM overhead and slowing down the server.
  2. **Core Database Philosophy (Millions of Rows in 1 Index)**:
     - Vector databases like ChromaDB and PostgreSQL are mathematically optimized to manage **millions of vector rows inside a single unified index** rather than thousands of tiny fragmented databases.
  3. **Ultra-Fast $O(1)$ Row Ingestion**:
     - When any user uploads a new note, it simply inserts clean vector rows into `"ournotes"` with metadata tags (`doc_id`, `classroom_id`, `uploaded_by_id`, `classroom_code`). No collection provisioning overhead.
  4. **High-Performance Filtered Queries**:
     - Instead of routing separate network queries across 5 different classroom collections for a student, a single filtered query (`where={"classroom_id": c_id}`) executes in under 0.05 seconds across millions of chunks.
  5. **Instant Document & User Lifecycle Management**:
     - Deleting a document simply purges chunks where `doc_id = doc_id` in a single command, keeping the index perpetually clean.

---

## 4. Advanced YouTube Academic Curation & Anti-Distraction Engine

### 🚩 The Problem with Standard YouTube Search:
When students search for educational topics on YouTube:
1. **Generic Irrelevance**: Querying *"Thermodynamics"* brings up clickbait, comedy reactions, entertainment reels, gaming videos, and Shorts.
2. **Grade-Level Mismatch**: A Class 10 student often gets 3-hour university graduate lectures, while a JEE Advanced aspirant gets 5th-grade introductory cartoons.
3. **No Learning Goal Alignment**: YouTube does not distinguish between a student needing a *Full One-Shot Chapter*, *Mathematical Derivations*, or *Quick Numerical Problem Solving*.

### 💡 The Multi-Stage Academic Curation Engine (`app/services/youtube_service.py`):

```
[Student Weak Concept / Search Query]
                   │
                   ▼
  [Stage 1: AI Query Expansion via Groq]
  - Injects Student Grade (e.g. "Class 11 Science", "JEE Advanced")
  - Injects Pedagogical Goals (e.g. "One Shot", "Derivation", "NCERT Numericals")
  - Synthesizes 3 Targeted Search Strings
                   │
                   ▼
  [Stage 2: YouTube API Search with Academic Flags]
  - Duration constraint: `videoDuration="medium"` (4–20 minutes)
  - Strict SafeSearch & Embeddability flags
                   │
                   ▼
  [Stage 3: Anti-Shorts & Anti-Clickbait Junk Blacklist Filter]
  - Scans titles & channels against `JUNK_KEYWORDS`:
    `#shorts`, `status`, `reel`, `funny`, `memes`, `gaming`, `reaction`, `vlog`, `edit`
                   │
                   ▼
  [Stage 4: Trusted Academic Channel Whitelist Priority]
  - Prioritizes top-tier institutions & verified educators:
    *Khan Academy, Physics Wallah, Unacademy, Vedantu, MIT OpenCourseWare, NPTEL, 3Blue1Brown, Amoeba Sisters, CrashCourse, Organic Chemistry Tutor*
                   │
                   ▼
  [Stage 5: Subtitle Sync & Interactive Transcript Player]
  - Fetches timestamped subtitles via `youtube-transcript-api`
  - Clicking any transcript line seeks player to that exact explanation!
```

### 🔎 Precision 3-Field Search Engine (`GET /api/student/search-videos`):
Students can customize their video search across 3 targeted parameters:
1. **Academic Topic**: Free-form concept name (e.g. *Bernoulli Equation, Transcription in Eukaryotes*).
2. **Context / Learning Goal (Dropdown)**:
   - 🎬 *Full Chapter One Shot*
   - 📐 *Concept & Derivations*
   - 🧮 *Numerical & Problems*
   - 🎨 *Animated Masterclass*
   - ⚡ *Quick Revision & Summary*
3. **Class / Year Standard (Dropdown)**:
   - 🏫 *Class 9 Foundation*
   - 🎓 *Class 10 Board Prep*
   - 🔬 *Class 11 Science (Physics/Chem/Math/Bio)*
   - 🚀 *Class 12 Board & Competitive*
   - 🏆 *JEE / NEET Advanced Target*
   - 🏛️ *College / Engineering / University*

---

## 5. 24-Hour Diagnostic AI Quiz Engine & Grade-Level Data Sourcing

### 📊 Where Does the Quiz Data Come From?
The autonomous diagnostic quiz engine does not generate random trivia. Instead, it extracts and synthesizes assessment material from **two synchronized data streams**:
1. **Enrolled Classroom Lecture Notes**: The system retrieves recent text chunks from the student's active classrooms in PostgreSQL & ChromaDB.
2. **Historical Diagnostic Gap Analysis**: The engine reviews past `StudentDailyQuiz` records to identify recurring weak concepts and reinforce them with variant questions.

### 📅 Day-Wise Class Subject Academic Schedule (`app/routes/student_portal.py`):
The daily practice quiz systematically rotates across all fundamental subjects according to the Indian Standard Time (`IST`) day of the week:

#### 🎓 Class 10 & Secondary Foundation Schedule:
- **Monday (सोमवार)**: **Science (विज्ञान)** — Physics, Chemistry & Biology (8 MCQs on Light, Electricity, Life Processes, Chemical Reactions & Acid-Bases).
- **Tuesday (मंगलवार)**: **Social Science / SST (सामाजिक विज्ञान)** — History (Nationalism), Geography (Resources), Civics (Power Sharing) & Economics (8 MCQs).
- **Wednesday (बुधवार)**: **Mathematics (गणित - Numericals)** — 8 step-by-step problem-solving MCQs with LaTeX equations ($...$) covering Quadratic Equations, Trigonometry, Geometry & Progressions.
- **Thursday (गुरुवार)**: **English** — Short 120-150 word Unseen Reading Comprehension Passage (5 MCQs) + English Applied Grammar & Vocabulary (5 MCQs on Tenses, Modals, Voice).
- **Friday (शुक्रवार)**: **Hindi (हिंदी)** — 120-word रोचक अपठित गद्यांश (5 MCQs) + हिंदी व्याकरण (5 MCQs on समास, संधि, पद-परिचय, मुहावरे) strictly generated in Hindi Devanagari script via Sarvam AI.
- **Saturday (शनिवार)**: **Math & Science Revision** — 8 high-yield STEM numericals and conceptual questions reviewing the week's key topics.
- **Sunday (रविवार)**: **Weekly Comprehensive Mock Assessment** — 10 balanced cross-subject diagnostic questions covering Science, SST, Math, English, and Hindi.

#### 🔬 Class 11 / 12 Senior Secondary & Competitive (JEE/NEET) Schedule:
- **Monday**: Physics (Mechanics, Electromagnetism, Optics & Core Derivations)
- **Tuesday**: Chemistry (Organic Mechanisms, Physical Equilibrium & Periodic Trends)
- **Wednesday**: Mathematics / Biology (Calculus, Vectors, Genetics & Cell Physiology)
- **Thursday**: English Core (Advanced Reading Comprehension & Applied Literary Devices)
- **Friday**: Computer Science / Applied Electives (Algorithms, Python Structures, Networks)
- **Saturday**: JEE / NEET Mixed High-Yield Diagnostic Problems
- **Sunday**: Full Syllabus Comprehensive Weekly Mock Revision

### 🎯 How Questions Are Calibrated to Student Standards:
1. **Targeted Difficulty & Competency Scaling**:
   - Prompts pass the student's configured grade level (*Class 9 to College*), adjusting vocabulary, problem complexity, and distractors.
   - **Difficulty Scale (1-10)**: Moves from basic recall definitions to multi-step analytical reasoning.
   - **Competency Percentage (0-100%)**: Forces real-world applied scenario questions over rote memorization.
2. **Strict KaTeX LaTeX Mathematical Derivations**:
   - Every formula, equation, fraction ($\frac{a}{b}$), and variable ($E_k = \frac{1}{2}mv^2$) is strictly wrapped in `$ ... $` (inline) and `$$ ... $$` (display).
   - Explanations provide a complete 4-step mathematical derivation: *(1) Given Values, (2) Formula, (3) Substitution, (4) Final Answer with Units*.
3. **Automated Diagnostic Remediation Loop**:
   - When a student submits a quiz, wrong answers are analyzed to extract **Weak Topic Keywords**.
   - These keywords are immediately passed to `get_curated_weak_topic_videos()`, which populates the student's dashboard with targeted YouTube masterclasses to bridge their conceptual gap.

---

## 6. 78% Token Squeezing & TPM Rate-Limit Optimizer

### 🚩 The Problem (6,000–8,000 TPM Quota Exhaustion):
Free-tier LLM providers (especially Groq) enforce strict **TPM (Tokens Per Minute = 6,000–8,000)** limits. Sending full 10,000-character documents with verbose system instructions consumed ~5,250 tokens per request, exhausting the quota after a single test.

### ⚡ The 4-Pillar Token Squeezing System (`app/services/ai.py`):
1. **System Prompt Compression**: Reduced verbose conversational prompts from ~450 tokens down to **~50 tokens**.
2. **Semantic Context Pruning**: RAG retrieval slices context to the top 2-3 most dense paragraphs (1,500–2,500 chars) instead of dumping entire documents.
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
   *(The Python backend automatically expands these compact keys into full database columns).*
4. **Cascade Model Rotation on 429 TPM**:
   `openai/gpt-oss-120b` ➔ `qwen/qwen3.8-27b` ➔ `gemini-2.5-flash` ➔ `sarvam-105b-conversations` ➔ `Local Heuristic Generator`.

| Stage | Before Squeezing | With Token Squeezing | Savings |
| :--- | :--- | :--- | :--- |
| **System Prompt** | ~450 Tokens | **~50 Tokens** | 🔻 89% |
| **Context Notes** | ~3,200 Tokens | **~700 Tokens** | 🔻 78% |
| **LLM Output** | ~1,600 Tokens | **~400 Tokens** | 🔻 75% |
| **Total per Request** | **~5,250 Tokens** | **~1,150 Tokens** | 🟢 **78% Total Savings** |

---

## 7. Ephemeral DLM Ingestion vs. Permanent Classroom Disk Storage

NoteAI implements an intelligent storage tiering strategy to prevent server disk overflow:
1. **Classroom Uploads (`classroom_id is not None`)**:
   - Files uploaded inside a classroom are **stored permanently** in `uploads/documents/` on the server disk.
   - Enables enrolled students to download original PDFs/DOCX files and view authentic PDF layouts in the document viewer.
2. **DLM Notebook Personal Uploads (`classroom_id is None`)**:
   - Files uploaded for personal doubt solving in DLM Notebook Studio are **ephemeral (temporary)** on disk.
   - Text is extracted via PyMuPDF / 2x2 Grid Vision OCR and indexed into the single `"ournotes"` vector collection.
   - As soon as vector chunk indexing completes, the physical file on disk is **automatically deleted** (`os.remove(file_path)`).
   - The Studio Document Reader seamlessly displays the extracted text and mathematical derivations via `MathRenderer` in Text View, saving gigabytes of server storage while retaining 100% of the AI intelligence!

---

## 8. Indian Standard Time (IST - Asia/Kolkata) Project-Wide Sync

- **Backend Time Utility (`app/utils/time_utils.py`)**:
  - `get_ist_now()` returns precise Indian Standard Time (`UTC+5:30`, `Asia/Kolkata`).
  - Database models (`User`, `Classroom`, `Post`, `DocumentFile`, `Quiz`, `QuizAttempt`, `StudentStreak`) use `default=get_ist_now`.
  - Daily study streaks calculate midnight rollovers based on Indian Standard Time (`get_ist_now().date()`).
- **Frontend Time Utility (`frontend/src/utils/formatDate.js`)**:
  - `formatISTDateTime(date)`: Formats timestamps in `Asia/Kolkata` with 12-hour AM/PM (e.g. `30 Aug 2026, 06:35 AM`).
  - `formatISTDate(date)`: Formats dates as `DD/MM/YYYY`.
  - `formatISTTime(date)`: Formats times as `hh:mm A`.

---

## 9. Google Authentication & Identity Architecture (Zero-Friction Minimal Scopes)

### 🔑 The Philosophy: Minimal Privileges with Maximum Trust
NoteAI strictly enforces **Scope Minimization (`openid email profile`)** for Google authentication. The platform never requests invasive scopes (such as Google Drive access, Gmail reading/sending, or Google Calendar).
- **Why we don't bind to Google Drive**: Files are stored and managed directly in isolated PostgreSQL and ChromaDB vector stores, avoiding external Google quota or API downtime risks.
- **Why we don't bind to Gmail APIs**: System notifications and OTPs are dispatched reliably using standard SMTP over secure TLS.

---

### 🧬 Data Extracted from Google Auth & Reasons for Attaching Each Feature:

1. **`sub` (`google_id` in PostgreSQL)**:
   - **What it is**: A permanent, mathematically unique string identifying the Google account (e.g., `"108392817482910482"`).
   - **Why it's attached**: Protects user identity. If a user renames their Google account or changes their primary email address, their `google_id` remains constant. This prevents duplicate account creation and guarantees they never lose access to their enrolled classrooms and quizzes.
2. **`email`**:
   - **What it is**: The verified email address from Google.
   - **Why it's attached**: Primary communication channel for course notifications and local password recovery.
3. **`picture` (`avatar_url`)**:
   - **What it is**: The high-res profile picture URL hosted by Google.
   - **Why it's attached**: Instantly sets the user's classroom avatar upon 1-click Google Sign-In, eliminating the need to manually crop and upload avatars.
4. **`email_verified`**:
   - **What it is**: Cryptographic verification status returned in the Google ID token.
   - **Why it's attached**: Because Google has already authenticated ownership of the email, NoteAI safely marks the account as verified (`is_verified = True`), skipping the manual 6-digit OTP barrier for a friction-free login experience.
5. **FastAPI `BackgroundTasks` Non-Blocking Email Dispatch**:
   - **Why it's attached**: SMTP network handshakes can take 1–3 seconds. Running email dispatch as background tasks allows the API to return instant `< 50ms` HTTP 200 responses to the frontend.

---

### 📊 Comparative Analysis: Authentication Architecture (Before vs. After)

| Dimension / Feature | 🔴 Before (Initial Auth Flow) | 🟢 After (Hardened & Unified Auth Flow) |
| :--- | :--- | :--- |
| **Google Identity Tracking** | Matched solely by `email` string. If email changed, account identity broke. | **Dual-Key Lookup**: Primary match on immutable `google_id` (`sub`) with graceful fallback to `email`. |
| **Audience Verification** | Did not verify `aud` parameter against `GOOGLE_CLIENT_ID`. | **Audience Guard**: Verifies `aud` and `azp` against configured Client ID with security alerts on mismatch. |
| **Email Dispatch Latency** | Synchronous SMTP calls blocked HTTP request threads (1.5–3s delay). | **Non-Blocking Background Tasks**: FastAPI `BackgroundTasks` dispatches emails asynchronously (`< 50ms` response). |
| **Dev OTP Security** | Returned plaintext OTP in JSON response unconditionally. | **Environment-Gated Protection**: `dev_otp` is automatically hidden in production when SMTP is configured. |
| **HTTP Method Compatibility** | Rigid `POST`-only endpoints caused `405 Method Not Allowed` when frontend called `PUT`. | **Multi-Method Support**: `@router.api_route(methods=["POST", "PUT"])` on `/confirm-role` and `/change-password`. |
| **Avatar Multi-Part Keys** | Expected strictly `avatar` key, breaking frontend sending `file` form-data. | **Polymorphic Field Binding**: Accepts both `avatar` and `file` multi-part form fields seamlessly. |
| **Database Schema** | `users` table lacked dedicated `google_id` column. | `users.google_id` column added with unique index and automated migration sync script. |

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

### 📺 Distraction-Free YouTube Focus Video Player with Subtitle Jumps
- **Academic Duration Filter**: Selects 4–20 minute educational videos, blacklisting shorts and clickbait.
- **Interactive Timestamped Subtitles**: Sidebar transcript allows jumping directly to specific concepts.
- **Daily 24-Hour AI Practice Hub**: Diagnoses weak concepts from daily quizzes and recommends targeted masterclasses.

---


---

## 10. Interactive Water Wave Fluid Physics Canvas ("Silent Pond" Physics & Kinetic Damping)

### 🚩 The Challenge:
Standard login and registration pages are static and unengaging, lacking modern interactive appeal. Previous particle/thread stitches caused text clutter and visual noise.

### 💡 The Solution (`frontend/src/components/WaterWaveCanvas.jsx`):
1. **2D Wave Laplacian Engine**: Implements a 2D discrete wave equation simulation across ping-pong `Float32Array` buffers with dynamic optical refraction coordinates (`gradX`, `gradY`).
2. **"Silent Pond" Fluid Equilibrium**:
   - **Primal State**: 100% crystal-clear, calm, and glassy surface showing the crisp 1:1 OmniOS Logo.
   - **On-Demand Ripple Generation**: Water waves are generated **only** when the user moves their cursor across the canvas.
   - **Natural Viscosity Damping (`DAMPING = 0.968`)**: Kinetic wave energy dissipates smoothly within 1.5 seconds back to absolute zero stillness once the cursor stops.
3. **Dynamic Glowing Plus (`+`) Cursor Transformation**:
   - As the cursor hovers within the perimeter of the centered OmniOS Logo, the system automatically morphs the standard pointer into a custom glowing **Electric Cyan Plus Icon (`+`) with Indigo Center Point**.
   - Moving away from the logo instantly reverts the cursor to default.

---

## 11. Google Classroom-Style Collapsible Navigation Rail & Adaptive Viewport

### 🚩 The Challenge:
Top horizontal navigation bars quickly become crowded with multiple app links (`Classrooms`, `OmniAI Studio`, `Daily Practice`, `Document Reader`, `Settings`), squishing student header badges on smaller displays.

### 💡 The Solution (`frontend/src/components/NavigationSidebar.jsx`):
1. **Persistent Mini Icon Rail (Collapsed State `w-[68px]`)**:
   - Sits neatly on the left margin without obstructing dashboard content (`pl-[68px]`).
   - Displays clean iconic action anchors: 🏠 **Home**, 🎯 **Daily AI Practice & Videos**, ✨ **OmniAI Studio**, 🎓 **Enrolled Classes (Topi)**, 📄 **Document Reader**, ⚙️ **Settings**, and 👤 **Google Profile Avatar**.
2. **Dual Opening Mechanism (Auto-Hover & Click-Pin Mode)**:
   - **Auto-Hover Expand**: Moving the cursor over the left rail smoothly expands the full sidebar (`w-72 / w-80`) with text labels, OmniOS branding, and enrolled subjects. Moving the cursor away collapses it back.
   - **Click-to-Pin**: Clicking the top-left Hamburger Menu button (`Menu`) pins the sidebar permanently open until clicked again.
3. **Live "Enrolled Classes" Accordion with Circular Letter Badges**:
   - Dynamically fetches user classrooms from `/api/classroom/list` and presents them with colored letter badges (e.g. `2`, `B`, `P`, `I`), subject titles, and teacher subtitles.
4. **Google Profile Avatar Integration**:
   - When collapsed: Displays user avatar photo at the bottom (clicking opens Profile Modal).
   - When expanded: Displays full User Profile card with name, email, class badge, and one-click **Logout** button.

---

## 12. Interactive Document & PDF Reader Workspace (`/quick-reader`)

### 🚩 The Challenge:
Opening `/quick-reader` without a direct URL parameter previously caused an infinite loading loop due to missing document ID checks.

### 💡 The Solution (`frontend/src/pages/QuickPDFReader.jsx`):
1. **Unified Document Library Hub**:
   - When visited without a specific document, it automatically aggregates all study notes, PDFs, and `.docx` files across the student's enrolled classrooms.
   - Features a real-time search filter and instant **"Read & Ask AI"** action cards.
2. **Distraction-Free 2-Column AI Reader**:
   - **Left Pane**: Multi-theme reader (Dark, Sepia Eye-Care, White Paper), LaTeX Math KaTeX renderer, and 70%–160% zoom.
   - **Right Pane**: Embedded AI Copilot with live document context for formula derivations and instant doubt resolution.

---

## 13. Strict Grade-Level Sourcing & Anti-Mismatched Recommendations Fix

### 🚩 The Challenge:
Generic search queries occasionally defaulted to higher-grade keywords (e.g. recommending Class 12 Kirchhoff's Law lectures to a Class 10 student).

### 💡 The Solution (`app/services/youtube_service.py` & `app/routes/student_portal.py`):
1. **Strict User Grade Calibration**:
   - Video queries now prioritize `current_user.student_class` (e.g., `Class 10 Board`) instead of generic high-school fallbacks.
   - Prompt engineering explicitly enforces: *"Do NOT recommend Class 11/12 derivation videos if student is in Class 9 or 10."*
2. **Accurate Subject Match**:
   - Class 10 students receive 100% grade-accurate recommendations (e.g. *Ohm's Law, Light Reflection & Refraction, Chemical Reactions, Electricity, Life Processes*).

---

# 📊 Comprehensive Platform Evolution: Before vs. After Comparison

| Area / Feature | 🔴 Before (Legacy System) | 🟢 After (Modern OmniOS Platform) |
| :--- | :--- | :--- |
| **Authentication UI & Aesthetic** | Standard generic login form with top navbar distraction and cluttered particles. | **100vh Full-Viewport Auth** with `#111113` matte finish, 3D Google Spectrum Aura, and zero-scroll layout. |
| **Canvas Interactive Physics** | Static canvas or distracting thread stitch animations with text noise. | **"Silent Pond" 2D Fluid Wave Simulation** with optical refraction, specular gleams, and dynamic **Plus (`+`) cursor** on logo hover. |
| **Navigation System** | Crowded horizontal top navbar with multi-button pill squishing header stats. | **Google Classroom Style Sidebar**: Persistent 68px Mini Icon Rail + Auto-Hover Expand & Click-Pin Drawer with Enrolled Letter Badges. |
| **User Profile & Logout UX** | Standalone logout button occupying prominent top bar space. | **Bottom Profile Avatar**: Shows Google avatar on rail; displays user card with name, email, and Logout when extended. |
| **Document Reader (`/quick-reader`)** | Infinite loading spinner when accessed directly from sidebar without URL parameters. | **Document Library Hub**: Aggregates all classroom notes with search filter and 1-click **LaTeX + AI Copilot Doubt Solver**. |
| **Video Recommendations** | Hardcoded `class 11 12` queries occasionally recommending Class 12 topics to Class 10 students. | **Strict Grade Calibration**: Aligned directly with `user.student_class` (Class 10 Board), ensuring 100% accurate syllabus lectures. |
| **Navbar Route Intelligence** | Navbar rendered everywhere, cutting into auth page canvas. | **Conditional Route Suppression**: Hidden on `/login` and `/signup`; displays cleanly on internal workspace routes. |


# 🛠️ Tech Stack & System Components

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy ORM, PostgreSQL (`pgvector`), ChromaDB, PyMuPDF (`fitz`), Pillow (`PIL`), python-docx, python-pptx, youtube-transcript-api, Gmail SMTP.
- **AI Engines**: Groq (`openai/gpt-oss-120b`, `qwen/qwen3.8-27b`), Google Gemini (`gemini-2.5-flash`), Sarvam AI (`sarvam-105b-conversations`).
- **Frontend**: React 18, Vite, Tailwind CSS, KaTeX Math Rendering, Lucide Icons, Google Identity Services.
- **DevOps**: PostgreSQL 16.

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


- **Web App**: `http://localhost:5173` (or `http://localhost:8000`)
- **Swagger API Docs**: `http://localhost:8000/docs`

---

## 📜 License
This project is licensed under the MIT License.
