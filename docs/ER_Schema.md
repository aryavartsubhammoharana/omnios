# 🗄️ ER Diagram & Database Schema

OmniOS uses a robust relational database (managed by SQLAlchemy) to handle user accounts, classroom logic, and document metadata.

## 1. Database Transaction Lifecycle (Flowchart)

```mermaid
flowchart TD
    Req([API Request Received]) --> Session[Get DB Session `Depends(get_db)`]
    Session --> Query[Execute SQLAlchemy ORM Query]
    Query --> Validation{Is Data Valid?}
    
    Validation -->|Yes| Commit[db.commit()]
    Validation -->|No| Rollback[db.rollback()]
    
    Commit --> Refresh[db.refresh(model)]
    Refresh --> Close[db.close() via Yield]
    Rollback --> Error[Raise HTTPException]
    Error --> Close
```

## 2. Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    USERS {
        Integer id PK
        String email UK
        String hashed_password
        String name
        String role "teacher | student"
        Integer streak_days
        DateTime last_active_date
        DateTime created_at
    }

    CLASSROOMS {
        Integer id PK
        String code "5-char Unique UK"
        String name
        String description
        Integer teacher_id FK
        DateTime created_at
    }

    ENROLLMENTS {
        Integer student_id FK
        Integer classroom_id FK
        DateTime joined_at
    }

    DOCUMENT_FILES {
        Integer id PK
        String unique_code UK
        String filename
        String file_path
        String folder_name
        Integer uploaded_by_id FK
        Integer classroom_id FK
        String processing_status
        DateTime created_at
    }

    DOCUMENT_CHUNKS {
        Integer id PK
        Integer document_id FK
        Integer chunk_index
        Text chunk_text
    }

    USERS ||--o{ CLASSROOMS : "Manages (If Teacher)"
    USERS ||--o{ ENROLLMENTS : "Joins (If Student)"
    CLASSROOMS ||--o{ ENROLLMENTS : "Has Many"
    CLASSROOMS ||--o{ DOCUMENT_FILES : "Contains Study Material"
    USERS ||--o{ DOCUMENT_FILES : "Uploads Personal Notes"
    DOCUMENT_FILES ||--|{ DOCUMENT_CHUNKS : "Is split into"
```

## 3. Table Definitions

### `users` Table
Handles authentication, profiles, and the zero-load streak system.
*   **`email`**: Unique identifier for login.
*   **`role`**: Enforces permissions. Teachers can create classes; Students can only join.
*   **`streak_days` / `last_active_date`**: Used to calculate daily academic engagement without background chron jobs.

### `classrooms` & `enrollments` Tables
*   **Classrooms** are strictly owned by one teacher (`teacher_id`).
*   **Enrollments** act as a junction/mapping table connecting many students to many classrooms.

### `document_files` Table
Stores metadata for all PDFs.
*   **`file_path`**: The most critical column. Can store a local server path (`uploads/documents/...`) OR a Google Cloud Storage (GCS) Public URL. The backend dynamically serves the file based on this prefix.
*   **`classroom_id`**: If NULL, the document is a "Personal Note". If populated, it is "Classroom Study Material" visible to all enrolled students.
