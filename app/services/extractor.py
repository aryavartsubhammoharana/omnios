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
        if l.lower().startswith(("subject:", "question bank", "unit ", "chapter ")):
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

def perform_local_ocr_on_pdf(file_path: str, max_pages: int = 35) -> str:
    """100% Zero-Cost Local GPU-Accelerated EasyOCR Pipeline for scanned image PDFs."""
    reader = get_easyocr_reader()
    if not reader:
        return ""

    extracted_pages = []
    try:
        doc = fitz.open(file_path)
        num_pages = min(len(doc), max_pages)
        for page_idx in range(num_pages):
            page = doc[page_idx]
            pix = page.get_pixmap(dpi=150)
            img = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, pix.n))
            
            lines = reader.readtext(img, detail=0)
            if lines:
                page_text = "\n".join(lines)
                extracted_pages.append(f"--- Page {page_idx + 1} ---\n" + page_text)
        doc.close()
    except Exception as e:
        print(f"Local GPU EasyOCR error on {file_path}: {e}")

    raw_ocr_text = "\n\n".join(extracted_pages).strip()
    if not raw_ocr_text:
        return ""

    # Structure into clean Markdown locally with $0 API cost
    return format_ocr_text_locally(raw_ocr_text)

def extract_text_from_file(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower()
    filename = os.path.basename(file_path)

    if ext == ".pdf":
        text = ""
        # 1. Super-Fast PyMuPDF fitz text layer extraction (< 50ms, $0 API cost)
        try:
            doc = fitz.open(file_path)
            for page in doc:
                t = page.get_text()
                if t and t.strip():
                    text += t + "\n"
            doc.close()
        except Exception:
            pass

        if text and len(text.strip()) > 50:
            print(f"PyMuPDF extracted text layer INSTANTLY (< 50ms, $0 API cost) for '{filename}'")
            return text.strip()

        # 2. 100% Zero-Cost Local GPU EasyOCR for scanned image PDFs (0 API cost!)
        print(f"Scanned image PDF detected for '{filename}'. Running 100% Zero-Cost Local GPU EasyOCR...")
        ocr_text = perform_local_ocr_on_pdf(file_path)
        if ocr_text.strip():
            print(f"Local GPU EasyOCR completed 100% ($0 API cost) for '{filename}'")
            return ocr_text.strip()

        return f"Study Note PDF Document: '{filename}' uploaded by teacher."

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
