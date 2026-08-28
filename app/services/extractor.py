import os
import sys
import logging
import warnings
import numpy as np
import fitz  # PyMuPDF
import torch
from app.config import settings

# Suppress verbose loggers and CPU warnings
warnings.filterwarnings("ignore")
logging.getLogger("easyocr").setLevel(logging.ERROR)

_easyocr_reader = None

def get_easyocr_reader():
    global _easyocr_reader
    if _easyocr_reader is None:
        try:
            import easyocr
            use_gpu = torch.cuda.is_available()
            device_name = torch.cuda.get_device_name(0) if use_gpu else "CPU"
            print(f"Initializing EasyOCR Reader ($0 API Cost, GPU Acceleration: {use_gpu}, Device: {device_name})...")
            _easyocr_reader = easyocr.Reader(['en'], gpu=use_gpu, verbose=False)
        except Exception as e:
            print(f"Failed to initialize EasyOCR reader: {e}")
            _easyocr_reader = False
    return _easyocr_reader if _easyocr_reader is not False else None

def format_ocr_text_locally(raw_text: str) -> str:
    """Formats raw OCR lines into clean structured Markdown locally with $0 API cost."""
    lines = raw_text.split("\n")
    formatted_lines = []
    
    for line in lines:
        l = line.strip()
        if not l:
            continue
        if l.startswith("--- Page "):
            formatted_lines.append(f"\n\n### {l}\n")
        elif l.lower().startswith(("subject:", "question bank", "unit ", "chapter ")):
            formatted_lines.append(f"\n## {l}\n")
        elif l.lower().startswith(("short questions:", "broad questions:", "section ", "notes:")):
            formatted_lines.append(f"\n### {l}\n")
        elif len(l) > 1 and l[0].isdigit() and l[1] in [".", ")", " "]:
            formatted_lines.append(f"\n**{l}**")
        elif l.startswith(("-", "*", "•")):
            formatted_lines.append(f"- {l.lstrip('-*• ')}")
        else:
            formatted_lines.append(l)

    return "\n".join(formatted_lines).strip()

def extract_pdf_page_by_page(file_path: str, on_page_progress=None) -> str:
    """Calculates total pages and processes PDF page-by-page (Text layer -> GPU OCR per page) with real-time progress."""
    filename = os.path.basename(file_path)
    extracted_pages = []
    
    try:
        doc = fitz.open(file_path)
        total_pages = len(doc)
        print(f"📄 '{filename}' has {total_pages} page(s). Starting Page-by-Page Extraction...")

        for page_idx in range(total_pages):
            page_num = page_idx + 1
            page = doc[page_idx]
            
            # Step 1: Check text layer on this individual page
            page_text = page.get_text()
            ocr_used = False

            # Step 2: If no text on this page, run GPU EasyOCR on this page's pixmap
            if not page_text or len(page_text.strip()) < 15:
                reader = get_easyocr_reader()
                if reader:
                    ocr_used = True
                    pix = page.get_pixmap(dpi=150)
                    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, pix.n))
                    lines = reader.readtext(img, detail=0)
                    if lines:
                        page_text = "\n".join(lines)
            
            if page_text and page_text.strip():
                extracted_pages.append(f"--- Page {page_num} of {total_pages} ---\n" + page_text.strip())
            
            print(f"   ↳ [Page {page_num}/{total_pages}] Extracted {'via GPU OCR' if ocr_used else 'via Text Layer'} ({len(page_text.strip()) if page_text else 0} chars)")

            # Step 3: Trigger real-time progress callback
            if on_page_progress:
                on_page_progress(page_num, total_pages, ocr_used)

        doc.close()
    except Exception as e:
        print(f"Error during page-by-page extraction for {filename}: {e}")

    raw_combined = "\n\n".join(extracted_pages).strip()
    if not raw_combined:
        return f"Classroom Study Note PDF Document: '{filename}'"

    return format_ocr_text_locally(raw_combined)

def extract_text_from_file(file_path: str, on_page_progress=None) -> str:
    ext = os.path.splitext(file_path)[1].lower()
    filename = os.path.basename(file_path)

    if ext == ".pdf":
        return extract_pdf_page_by_page(file_path, on_page_progress=on_page_progress)

    elif ext in [".docx", ".doc"]:
        try:
            import docx
            doc = docx.Document(file_path)
            full_text = [p.text for p in doc.paragraphs if p.text]
            res = "\n".join(full_text).strip()
            if res:
                return res
        except Exception:
            pass

    elif ext in [".pptx", ".ppt"]:
        try:
            import pptx
            prs = pptx.Presentation(file_path)
            slides_text = []
            for slide in prs.slides:
                for shape in slide.shapes:
                    if hasattr(shape, "text") and shape.text.strip():
                        slides_text.append(shape.text.strip())
            res = "\n".join(slides_text).strip()
            if res:
                return res
        except Exception:
            pass

    # Default text reading for .txt, .md, code files
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            t = f.read().strip()
            if t:
                return t
    except Exception:
        pass

    return f"Classroom Study Material File: '{filename}' uploaded by teacher."
