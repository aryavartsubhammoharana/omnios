import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine, Base
from app.models import *

def refresh_db():
    print("==================================================")
    print("[*] Starting OmniOS Database Refresh & Migration...")
    print("==================================================")
    
    try:
        print("1. Ensuring pgvector extension exists...")
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            conn.commit()
            print("   [+] pgvector ready.")
    except Exception as e:
        print(f"   [i] Note on pgvector extension: {e}")

    try:
        print("2. Syncing 'google_id' column on 'users' table...")
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR UNIQUE;"))
            conn.commit()
            print("   [+] 'google_id' column verified on users table.")
    except Exception as e:
        print(f"   [i] Note on users google_id: {e}")

    try:
        print("3. Syncing document processing columns on 'document_files'...")
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE document_files ADD COLUMN IF NOT EXISTS processing_status VARCHAR DEFAULT 'ready';"))
            conn.execute(text("ALTER TABLE document_files ADD COLUMN IF NOT EXISTS processing_progress INTEGER DEFAULT 100;"))
            conn.commit()
            print("   [+] Document processing columns verified.")
    except Exception as e:
        print(f"   [i] Note on document_files: {e}")

    print("4. Creating any missing tables from SQLAlchemy models...")
    Base.metadata.create_all(bind=engine)
    print("   [+] All SQLAlchemy model tables verified.")
    print("==================================================")
    print("[SUCCESS] Database refresh completed successfully!")
    print("==================================================")

if __name__ == "__main__":
    refresh_db()
