from sqlalchemy import text
from app.database import engine

def migrate():
    print("Migrating PostgreSQL document_files table...")
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE document_files ADD COLUMN IF NOT EXISTS processing_status VARCHAR DEFAULT 'ready';"))
        conn.execute(text("ALTER TABLE document_files ADD COLUMN IF NOT EXISTS processing_progress INTEGER DEFAULT 100;"))
        conn.commit()
    print("PostgreSQL Migration Completed Successfully!")

if __name__ == "__main__":
    migrate()
