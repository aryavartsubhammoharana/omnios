# 🎓 NOTE AI — Production Backend Architecture
> **AI-Powered Classroom Knowledge Management & Learning Platform**  
> *Engineered for Smart India Hackathon (SIH)*

---

## 🌟 Overview
**NOTE AI** is a modular, production-ready backend designed to revolutionize classroom knowledge management. It enables teachers to upload lecture notes (PDFs, Word documents, and scanned/handwritten notes via OCR), automatically processes and embeds them into a high-dimensional vector space (**PostgreSQL + `pgvector`**), and empowers students to ask context-grounded questions (**RAG**), generate structured quizzes, summarize lengthy materials, and maintain gamified daily learning streaks.

---

## 🏗️ System Architecture

```
                               ┌──────────────────────────────────────────────┐
                               │            Client (Web / Mobile)             │
                               └──────────────────────┬───────────────────────┘
                                                      │ HTTP / REST / Cookies
                                                      ▼
                               ┌──────────────────────────────────────────────┐
                               │           Express.js API Gateway             │
                               │   (Helmet, CORS, RateLimiter, CookieParser)  │
                               └──────────────────────┬───────────────────────┘
                                                      │
                       ┌──────────────────────────────┼──────────────────────────────┐
                       ▼                              ▼                              ▼
            ┌────────────────────┐         ┌────────────────────┐         ┌────────────────────┐
            │    Auth & RBAC     │         │ Classroom & Notes  │         │    RAG & AI API    │
            │ (JWT, HttpOnly,    │         │  (6-Char Code,     │         │ (Similarity Search,│
            │  Bcrypt, Roles)    │         │   Uploads, Roster) │         │  Summary, Quizzes) │
            └────────────────────┘         └──────────┬─────────┘         └──────────┬─────────┘
                                                      │                              │
                                                      ▼                              │
                                           ┌────────────────────┐                    │
                                           │  BullMQ Queue Job  │                    │
                                           └──────────┬─────────┘                    │
                                                      │                              │
                                                      ▼                              │
                                           ┌────────────────────┐                    │
                                           │ Background Worker  │                    │
                                           │ (PDF/DOCX/OCR +    │                    │
                                           │  Sliding Chunker)  │                    │
                                           └──────────┬─────────┘                    │
                                                      │                              │
                                                      ▼                              ▼
                                      ┌────────────────────────────────────────────────────────┐
                                      │              PostgreSQL 16 + pgvector                  │
                                      │  - 1536-d Vector Index (HNSW / Cosine Ops <=>)         │
                                      │  - Classrooms, Documents, Chunks, Analytics & Streaks  │
                                      └────────────────────────────────────────────────────────┘
```

---

## 🚀 Tech Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Runtime** | Node.js (ES Modules) | High-throughput asynchronous backend |
| **Web Framework** | Express.js | REST API routing and middleware pipeline |
| **Database** | PostgreSQL 16 + `pgvector` | Relational data + 1536-d vector embeddings & cosine search |
| **Task Queue** | Redis 7 + BullMQ | Asynchronous document parsing, OCR & vector batch ingestion |
| **Security & Auth** | JWT + HTTP-only Cookies + Bcrypt | Secure authentication, role-based access control (RBAC) |
| **File Ingestion** | Multer, `pdf-parse`, `mammoth`, `tesseract.js` | Parsing PDF, Word DOCX, TXT, and OCR for handwritten notes |
| **AI & RAG** | OpenAI / Gemini / Modular Fallback | 1536-d Embeddings, RAG Q&A, Summarization, and Quiz generation |
| **Validation** | Zod | Strict schema validation on headers, body, params, and env |

---

## 📁 Directory Structure

```
server/
├── docker-compose.yml              # PostgreSQL with pgvector + Redis
├── package.json                    # Dependencies & scripts
├── .env.example                    # Sample environment variables
├── .gitignore
├── README.md                       # Complete documentation
├── src/
│   ├── app.js                      # Express app setup, security, routes
│   ├── server.js                   # Server bootstrap & graceful shutdown
│   ├── config/
│   │   ├── env.js                  # Zod environment variable parsing
│   │   ├── db.js                   # PostgreSQL pool with pgvector type support
│   │   ├── redis.js                # Redis client & BullMQ config
│   │   └── s3.js                   # AWS S3 / Local disk storage driver
│   ├── database/
│   │   ├── schema.sql              # Database DDL with tables, constraints & HNSW index
│   │   ├── seed.sql                # Demo users, classrooms, notes, and streaks
│   │   └── initDb.js               # Database initialization & seed CLI
│   ├── middleware/
│   │   ├── auth.middleware.js      # JWT & HTTP-only cookie authentication
│   │   ├── rbac.middleware.js      # Role authorization (TEACHER, STUDENT, etc.)
│   │   ├── upload.middleware.js    # Multer configuration with format checks
│   │   ├── validate.middleware.js  # Zod schema validation middleware
│   │   └── errorHandler.js         # Centralized error handler
│   ├── utils/
│   │   ├── apiResponse.js          # Standardized JSON response envelope
│   │   ├── apiError.js             # Custom operational API error class
│   │   ├── textChunker.js          # Sliding-window token-aware chunker
│   │   └── codeGenerator.js        # 6-character classroom code generator
│   ├── services/
│   │   ├── ocr.service.js          # Tesseract OCR for images & handwritten notes
│   │   ├── textExtractor.service.js# Unified PDF, DOCX, TXT, OCR parser
│   │   ├── embedding.service.js    # 1536-d vector generator & formatter
│   │   └── llm.service.js          # RAG, Summarizer, and Quiz Generator
│   ├── queues/
│   │   ├── documentQueue.js        # BullMQ document queue setup
│   │   └── workers/
│   │       ├── fileProcessor.worker.js # Ingestion, chunking & vector indexing worker
│   │       └── embedding.worker.js     # Re-indexing helper
│   └── modules/
│       ├── auth/                   # Register, login, logout, refresh, me
│       ├── classroom/              # Classroom creation, 6-char code join, rosters
│       ├── document/               # Upload notes, list, chunks, delete
│       ├── ai/                     # RAG Chat, Document Summary, MCQ Quiz generator
│       └── analytics/              # View tracking, streak calculation, Teacher dashboard
└── tests/
    └── api.test.js                 # Automated component & math test suite
```

---

## ⚡ Quick Start Guide

### Option A: 1-Command Full Containerization (Docker)
Run the entire platform (Node.js Server + PostgreSQL with `pgvector` + Redis) with a single command:

```bash
# 1. Clone & enter directory
cd server

# 2. Build and start all containers
docker compose up --build -d
```

Once started, open **`http://localhost:5000`** in your browser to access the web client!

---

### Option B: Local Node.js Development

#### 1. Prerequisites
- **Node.js**: `>= 18.0.0`
- **Docker & Docker Compose** (for PostgreSQL with `pgvector` and Redis)

#### 2. Start PostgreSQL + Redis via Docker
```bash
docker compose up postgres redis -d
```

#### 3. Install Dependencies
```bash
npm install
```

#### 4. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

#### 5. Initialize Database Schema & Seed Data
```bash
npm run db:init
npm run db:seed
```

#### 6. Run the Test Suite
```bash
npm test
```

#### 7. Start the Development Server
```bash
npm run dev
```
The server & interactive demo client will boot at **`http://localhost:5000`**.

---

## 🔑 Pre-Configured Demo Accounts (from `seed.sql`)

All test accounts use the password: `Password123!`

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **TEACHER** | `dr.sharma@institution.edu` | `Password123!` | Has created classrooms `DSA101` and `AIML20` |
| **STUDENT** | `aarav.patel@student.edu` | `Password123!` | Active 5-day streak, enrolled in DSA & AIML |
| **STUDENT** | `priya.singh@student.edu` | `Password123!` | Active 2-day streak, enrolled in DSA |
| **FREE_USER** | `guest.learner@gmail.com` | `Password123!` | General student / self-learner account |
| **ADMIN** | `admin@noteai.edu` | `Password123!` | Full system administrative privileges |

---

## 📡 REST API Reference

### 🔐 1. Authentication (`/api/v1/auth`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Register new user (`TEACHER`, `STUDENT`, `FREE_USER`) | No |
| `POST` | `/api/v1/auth/login` | Login and receive HTTP-only JWT cookies | No |
| `POST` | `/api/v1/auth/logout` | Logout and clear authentication cookies | No |
| `POST` | `/api/v1/auth/refresh-token` | Issue new access token | No |
| `GET` | `/api/v1/auth/me` | Fetch authenticated user profile & streak info | Yes |

#### Sample Login Request:
```json
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "dr.sharma@institution.edu",
  "password": "Password123!"
}
```

---

### 🏫 2. Classrooms (`/api/v1/classrooms`)

| Method | Endpoint | Description | Roles |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/classrooms` | Create classroom (auto-generates unique 6-char code) | `TEACHER`, `ADMIN` |
| `POST` | `/api/v1/classrooms/join` | Join a classroom using 6-character code | `STUDENT`, `FREE_USER` |
| `GET` | `/api/v1/classrooms` | List classrooms for current user | All Authenticated |
| `GET` | `/api/v1/classrooms/:id` | Get classroom details and stats | Enrolled / Teacher |
| `GET` | `/api/v1/classrooms/:id/members` | Get classroom student roster | Teacher / Enrolled |
| `DELETE` | `/api/v1/classrooms/:id` | Delete classroom | Teacher Owner / Admin |

#### Sample Create Classroom Request:
```json
POST /api/v1/classrooms
Content-Type: application/json

{
  "name": "Operating Systems & Concurrency",
  "subject": "Computer Science",
  "description": "Processes, Threads, Virtual Memory, and File Systems"
}
```
**Response**:
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Classroom created successfully",
  "data": {
    "id": "c4b1d6e2-...",
    "name": "Operating Systems & Concurrency",
    "subject": "Computer Science",
    "classroom_code": "OS892K",
    "teacher_id": "22222222-...",
    "created_at": "2026-08-28T11:00:00.000Z"
  }
}
```

---

### 📄 3. Documents & Notes (`/api/v1`)

| Method | Endpoint | Description | Roles |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/classrooms/:classroomId/notes` | Upload note (PDF, DOCX, Image OCR) -> queues job | `TEACHER`, `ADMIN` |
| `GET` | `/api/v1/classrooms/:classroomId/notes` | List all notes in classroom with status | Enrolled / Teacher |
| `GET` | `/api/v1/notes/:id` | Get single note metadata and processing status | Enrolled / Teacher |
| `GET` | `/api/v1/notes/:id/chunks` | Inspect parsed text chunks | Enrolled / Teacher |
| `DELETE` | `/api/v1/notes/:id` | Delete note and vector chunks | Uploader / Teacher |

---

### 🤖 4. AI, Semantic Search & RAG (`/api/v1/ai`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/ai/chat` | Contextual RAG search & cited question answering |
| `POST` | `/api/v1/ai/summarize` | Generate document executive summary & key takeaways |
| `POST` | `/api/v1/ai/generate-quiz` | Generate interactive MCQs and short questions with answer key |

#### Sample RAG Query:
```json
POST /api/v1/ai/chat
Content-Type: application/json

{
  "classroomId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "query": "How does insertion in a Binary Search Tree work and what is its average time complexity?",
  "topK": 4
}
```

**Response**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "RAG response generated successfully",
  "data": {
    "query": "How does insertion in a Binary Search Tree work and what is its average time complexity?",
    "classroom": {
      "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "name": "Data Structures & Algorithms",
      "subject": "Computer Science"
    },
    "answer": "### Answer from Classroom Notes:\n\nBased on your course materials:\n- **Insertion Mechanism [Source 1]**: When inserting a new key into a BST, the algorithm starts at the root and compares the key with each node. If smaller, it traverses left; if larger, it traverses right until reaching an empty leaf.\n- **Time Complexity [Source 1]**: The average time complexity for insertion is **O(log N)** for balanced trees, while worst-case degenerates to **O(N)** for skewed trees.",
    "sources": [
      {
        "sourceId": 1,
        "fileName": "BST_Lecture_04.pdf",
        "similarity": 0.9312,
        "excerpt": "A Binary Search Tree is a node-based binary tree... Insertion: O(log N) average..."
      }
    ],
    "retrievedChunksCount": 3
  }
}
```

---

### 📊 5. Analytics & Daily Streaks (`/api/v1`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/notes/:id/track-view` | Log document study time & update daily streak |
| `GET` | `/api/v1/classrooms/:id/analytics` | Teacher classroom analytics dashboard |
| `GET` | `/api/v1/analytics/streak` | Get current student streak status |

---

## 🛡️ Key Architectural Features for SIH Hackathon

1. **pgvector Integration**:
   - Stores 1536-dimensional embeddings directly in PostgreSQL using `vector(1536)` columns.
   - High-speed Approximate Nearest Neighbor (ANN) search via HNSW index with `<=>` cosine distance.
2. **Asynchronous File Ingestion**:
   - Offloads heavy PDF parsing, OCR (Tesseract.js), and embedding generation to background BullMQ workers.
   - Real-time status progression: `PENDING` -> `PROCESSING` -> `READY` / `FAILED`.
3. **Smart Overlapping Chunker**:
   - Token-aware sliding window (500–1000 tokens) preserving paragraph and sentence boundaries so context isn't lost at chunk edges.
4. **Gamified Student Streaks**:
   - Automatic consecutive-day detection calculating daily engagement and motivating consistent study habits.
5. **Teacher Insights**:
   - Aggregate statistics on document read rates, total study hours, and individual student progress.
