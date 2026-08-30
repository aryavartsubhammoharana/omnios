# Database Schema

## Models

### 1. User
- id, email, hashed_password, 
ole (teacher/student), streak_days, last_active_date

### 2. Classroom
- id, code (5-char unique), 
ame, 	eacher_id

### 3. Enrollment
- student_id, classroom_id, joined_at

### 4. DocumentFile
- id, unique_code, ilename, ile_path (Local or GCS URL), classroom_id, uploaded_by_id, processing_status

### 5. DocumentChunk
- id, document_id, chunk_index, chunk_text (For RAG/Vector search correlation)
