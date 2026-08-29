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
    """Intelligently repairs broken OCR sentence fragments and formats into clean structured Markdown."""
    import re

    if not raw_text or not raw_text.strip():
        return raw_text

    # Step 1: Normalize OCR artifacts
    text = raw_text.replace("_", ". ").replace(". . ", ". ").replace(".  ", ". ")
    # Replace weird OCR quotes or pipes
    text = re.sub(r'[|~^]', ' ', text)

    raw_lines = [l.strip() for l in text.split("\n") if l.strip()]
    merged_lines = []

    # Step 2: Merge broken mid-sentence fragments
    # If line i does not end with terminal punctuation (. ? ! : ---) and line i+1 doesn't start with a new question/heading/bullet, JOIN THEM!
    for line in raw_lines:
        if not merged_lines:
            merged_lines.append(line)
            continue

        prev = merged_lines[-1]

        # Is this a new structural block (Page header, Heading, Question number, bullet)?
        is_new_block = (
            bool(re.match(r'^-{2,}\s*Page\s+\d+', line, re.I)) or
            bool(re.match(r'^(subject\s*[:.]|question\s*bank|unit\s+\d|chapter\s+\d)', line, re.I)) or
            bool(re.match(r'^(short\s+questions?|broad\s+questions?|long\s+questions?|section\s+[a-z]|notes?\s*[:.]|fill\s+in|true\s+or\s+false|match\s+the|multiple\s+choice|mcq|objective)', line, re.I)) or
            bool(re.match(r'^(Q\.?\s*)?(\d{1,3})\s*[.)]\s+', line)) or
            line.startswith(("-", "*", "•")) or
            bool(re.match(r'^\(?[a-eA-Eivx]{1,4}[.)]\s+', line))
        )

        prev_is_block_header = (
            bool(re.match(r'^-{2,}\s*Page\s+\d+', prev, re.I)) or
            bool(re.match(r'^(subject\s*[:.]|question\s*bank|unit\s+\d|chapter\s+\d)', prev, re.I)) or
            bool(re.match(r'^(short\s+questions?|broad\s+questions?|long\s+questions?|section\s+[a-z]|notes?\s*[:.]|fill\s+in|true\s+or\s+false|match\s+the|multiple\s+choice|mcq|objective)', prev, re.I))
        )

        if not is_new_block and not prev_is_block_header and not prev.endswith((".", "?", "!", ":", ";", "---")):
            # Join with previous line to form a complete coherent sentence!
            merged_lines[-1] = prev + " " + line
        else:
            merged_lines.append(line)

    # Step 3: Format merged lines into structured Markdown
    formatted_lines = []
    for l in merged_lines:
        l = l.strip()
        if not l:
            continue

        # Page Header
        if re.match(r'^-{2,}\s*Page\s+\d+', l, re.IGNORECASE):
            formatted_lines.append(f"\n\n---\n\n### 📄 {l.strip('- ')}\n")

        # Top Headings (Subject, Unit, Chapter)
        elif re.match(r'^(subject\s*[:.]|question\s*bank|unit\s+\d|chapter\s+\d)', l, re.IGNORECASE):
            formatted_lines.append(f"\n## {l}\n")

        # Section Headings (Short Questions, Broad Questions)
        elif re.match(r'^(short\s+questions?|broad\s+questions?|long\s+questions?|section\s+[a-z]|notes?\s*[:.]|fill\s+in|true\s+or\s+false|match\s+the|multiple\s+choice|mcq|objective)', l, re.IGNORECASE):
            formatted_lines.append(f"\n### {l}\n")

        # Numbered Questions
        elif re.match(r'^(Q\.?\s*)?(\d{1,3})\s*[.)]\s+', l):
            m = re.match(r'^(Q\.?\s*)?(\d{1,3})\s*[.)]\s+(.*)', l)
            if m:
                num = m.group(2)
                qtext = m.group(3).strip()
                formatted_lines.append(f"\n**{num}. {qtext}**\n")
            else:
                formatted_lines.append(f"\n**{l}**\n")

        # Bullet lists
        elif l.startswith(("-", "*", "•")):
            formatted_lines.append(f"- {l.lstrip('-*• ')}")

        # Lettered sub-options
        elif re.match(r'^\(?[a-eA-Eivx]{1,4}[.)]\s+', l):
            formatted_lines.append(f"   - {l}")

        # Standalone Question keywords (Define, Describe, What is...)
        elif re.match(r'^(Define|Describe|Differentiate|Distinguish|Draw|Discuss|Mention|Write|What|Why|How|Give|Classify|Compare|Contrast|Explain|State|List|Name|Depict|Enumerate)\b', l, re.IGNORECASE) and len(l) > 15:
            formatted_lines.append(f"\n**{l}**\n")

        # Normal text
        else:
            formatted_lines.append(l)

    result = "\n".join(formatted_lines).strip()
    result = re.sub(r'\n{4,}', '\n\n\n', result)
    return result

def extract_pdf_page_by_page(file_path: str, on_page_progress=None) -> str:
    """Calculates total pages and processes PDF page-by-page (Text layer -> GPU OCR per page) with real-time progress."""
    filename = os.path.basename(file_path)
    extracted_pages = []
    
    try:
        doc = fitz.open(file_path)
        total_pages = len(doc)
        print(f"[+] '{filename}' has {total_pages} page(s). Starting Page-by-Page Extraction...")

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
            
            print(f"   -> [Page {page_num}/{total_pages}] Extracted {'via GPU OCR' if ocr_used else 'via Text Layer'} ({len(page_text.strip()) if page_text else 0} chars)")

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
