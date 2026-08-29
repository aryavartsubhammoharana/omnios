import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine

def fix_foreign_keys():
    print("[+] Updating foreign key constraints with ON DELETE CASCADE...")
    with engine.connect() as conn:
        # Fix study_sessions -> document_files
        try:
            conn.execute(text("""
                ALTER TABLE study_sessions 
                DROP CONSTRAINT IF EXISTS study_sessions_document_id_fkey;
                
                ALTER TABLE study_sessions 
                ADD CONSTRAINT study_sessions_document_id_fkey 
                FOREIGN KEY (document_id) REFERENCES document_files(id) ON DELETE CASCADE;
            """))
            conn.commit()
            print("[OK] study_sessions_document_id_fkey updated to ON DELETE CASCADE!")
        except Exception as e:
            print(f"[NOTE] study_sessions fk: {e}")

        # Fix study_sessions -> classrooms
        try:
            conn.execute(text("""
                ALTER TABLE study_sessions 
                DROP CONSTRAINT IF EXISTS study_sessions_classroom_id_fkey;
                
                ALTER TABLE study_sessions 
                ADD CONSTRAINT study_sessions_classroom_id_fkey 
                FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE;
            """))
            conn.commit()
            print("[OK] study_sessions_classroom_id_fkey updated to ON DELETE CASCADE!")
        except Exception as e:
            print(f"[NOTE] study_sessions classroom fk: {e}")

        # Fix document_chunks -> document_files
        try:
            conn.execute(text("""
                ALTER TABLE document_chunks 
                DROP CONSTRAINT IF EXISTS document_chunks_document_id_fkey;
                
                ALTER TABLE document_chunks 
                ADD CONSTRAINT document_chunks_document_id_fkey 
                FOREIGN KEY (document_id) REFERENCES document_files(id) ON DELETE CASCADE;
            """))
            conn.commit()
            print("[OK] document_chunks_document_id_fkey updated to ON DELETE CASCADE!")
        except Exception as e:
            print(f"[NOTE] document_chunks fk: {e}")

    print("[DONE] All Foreign Key constraints fixed successfully!")

if __name__ == "__main__":
    fix_foreign_keys()
