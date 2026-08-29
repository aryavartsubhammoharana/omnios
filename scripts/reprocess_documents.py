import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.file import DocumentFile
from app.services.extractor import extract_text_from_file, format_ocr_text_locally
from app.services.ai import structure_ocr_text_with_sarvam
from app.services.vector_store import index_document_in_chroma

def reprocess():
    db = SessionLocal()
    docs = db.query(DocumentFile).all()
    print(f"[+] Reprocessing {len(docs)} documents...")

    for d in docs:
        if not d.file_path or not os.path.exists(d.file_path):
            continue
        print(f"[*] Reprocessing Document #{d.id} ('{d.filename}')...")
        raw_text = extract_text_from_file(d.file_path)
        structured = structure_ocr_text_with_sarvam(raw_text)
        if not structured or "error querying" in structured.lower() or "read timed out" in structured.lower():
            structured = format_ocr_text_locally(raw_text)
        
        d.content_text = structured
        d.processing_status = "ready"
        d.processing_progress = 100
        db.commit()

        # Re-index in ChromaDB
        index_document_in_chroma(d.id, d.classroom_id, d.filename, d.content_text)
        print(f"[OK] Document #{d.id} ('{d.filename}') successfully repaired and re-indexed!")

    db.close()
    print("[DONE] All documents reprocessed cleanly!")

if __name__ == "__main__":
    reprocess()
