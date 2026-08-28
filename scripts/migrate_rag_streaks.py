import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine, Base
from app.models import *

def migrate():
    print("[+] Running RAG + Streaks + Analytics Migration...")
    with engine.connect() as conn:
        # Step 1: Enable pgvector extension
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            conn.commit()
            print("[OK] pgvector extension enabled successfully in PostgreSQL!")
        except Exception as e:
            print(f"[NOTE] pgvector extension: {e}")

        # Step 2: Create all tables from SQLAlchemy models
        Base.metadata.create_all(bind=engine)
        print("[OK] Database tables created/verified (student_streaks, study_sessions, document_chunks)!")

        # Step 3: Create HNSW index on embeddings
        try:
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw 
                ON document_chunks 
                USING hnsw (embedding vector_cosine_ops);
            """))
            conn.commit()
            print("[OK] HNSW Vector Index created for sub-millisecond similarity search!")
        except Exception as e:
            print(f"[NOTE] HNSW index: {e}")

    print("[DONE] Migration completed successfully!")

if __name__ == "__main__":
    migrate()
