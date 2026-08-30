# System Architecture: OmniOS (NoteAI)

## High-Level Overview
OmniOS is an AI-powered EdTech platform designed for high performance, infinite scalability, and seamless user experience. It consists of a decoupled frontend and backend.

### 1. Frontend (Client-Side)
- **Framework:** React.js (Vite)
- **Styling:** Tailwind CSS + Custom Glassmorphism
- **Animations:** Highly optimized HTML5 Canvas with 0-allocation rendering loops (Water Waves, Thread Fabrics) to prevent RAM leaks.
- **Routing:** React Router DOM

### 2. Backend (Server-Side)
- **Framework:** FastAPI (Python)
- **Database (Relational):** SQLite (Default) via SQLAlchemy ORM.
- **Database (Vector/AI):** ChromaDB (Local persistent RAG storage for embeddings).
- **Authentication:** JWT (JSON Web Tokens) with secure HTTP-only cookies/headers.

### 3. File Storage System
- **Primary:** Google Cloud Storage (GCS) - Enterprise-grade scalability.
- **Fallback:** Local File System (uploads/documents/).
- **Logic:** USE_GCS=True routes all PDF uploads directly to Google Cloud.

### 4. Artificial Intelligence (AI) Layer
- **Providers:** Google Gemini API (Primary), Sarvam AI (Fallback).
- **RAG Pipeline:** PyMuPDF extracts text -> Chunking -> ChromaDB vector embeddings -> AI context matching.
- **Optimization (Smart Cache):** Custom Memory-based LRU TTL Cache (pp/routes/ai.py). Identical student queries fetch instant memory responses (0.01s latency) to bypass AI rate limits.
