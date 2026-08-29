import os
import re
import logging
import warnings
import numpy as np
import fitz  # PyMuPDF
import torch

# Suppress verbose loggers
warnings.filterwarnings("ignore")
logging.getLogger("easyocr").setLevel(logging.ERROR)

_easyocr_reader = None


# ---------------------------------------------------------------------------
# EasyOCR lazy singleton
# ---------------------------------------------------------------------------

def get_easyocr_reader():
    global _easyocr_reader
    if _easyocr_reader is None:
        try:
            import easyocr
            use_gpu = torch.cuda.is_available()
            device = torch.cuda.get_device_name(0) if use_gpu else "CPU"
            print(f"Initializing EasyOCR (GPU: {use_gpu}, Device: {device})...")
            _easyocr_reader = easyocr.Reader(["en"], gpu=use_gpu, verbose=False)
        except Exception as e:
            print(f"Failed to initialize EasyOCR: {e}")
            _easyocr_reader = False
    return _easyocr_reader if _easyocr_reader is not False else None


# ---------------------------------------------------------------------------
# Local OCR text formatter (instant, zero-cost fallback)
# ---------------------------------------------------------------------------

def format_ocr_text_locally(raw_text: str) -> str:
    """Repairs broken OCR sentence fragments and formats into clean structured Markdown."""
    if not raw_text or not raw_text.strip():
        return raw_text

    # Normalize OCR artifacts
    text = raw_text.replace("_", ". ").replace(". . ", ". ").replace(".  ", ". ")
    text = re.sub(r"[|~^]", " ", text)

    raw_lines = [l.strip() for l in text.split("\n") if l.strip()]
    merged = []

    # Merge broken mid-sentence fragments
    for line in raw_lines:
        if not merged:
            merged.append(line)
            continue
        prev = merged[-1]
        is_new_block = (
            bool(re.match(r"^-{2,}\s*Page\s+\d+", line, re.I)) or
            bool(re.match(r"^(subject\s*[:.] |question\s*bank|unit\s+\d|chapter\s+\d)", line, re.I)) or
            bool(re.match(r"^(short\s+questions?|broad\s+questions?|long\s+questions?|section\s+[a-z]|fill\s+in|true\s+or\s+false|match\s+the|multiple\s+choice|mcq|objective)", line, re.I)) or
            bool(re.match(r"^(Q\.?\s*)?(\d{1,3})\s*[.)]\s+", line)) or
            line.startswith(("-", "*", "•")) or
            bool(re.match(r"^\(?[a-eA-Eivx]{1,4}[.)]\s+", line))
        )
        prev_is_block_header = (
            bool(re.match(r"^-{2,}\s*Page\s+\d+", prev, re.I)) or
            bool(re.match(r"^(subject\s*[:.] |question\s*bank|unit\s+\d|chapter\s+\d)", prev, re.I)) or
            bool(re.match(r"^(short\s+questions?|broad\s+questions?|long\s+questions?|section\s+[a-z]|fill\s+in|true\s+or\s+false|match\s+the|multiple\s+choice|mcq|objective)", prev, re.I))
        )
        if not is_new_block and not prev_is_block_header and not prev.endswith((".", "?", "!", ":", ";", "---")):
            merged[-1] = prev + " " + line
        else:
            merged.append(line)

    # Format merged lines into structured Markdown
    formatted = []
    for l in merged:
        l = l.strip()
        if not l:
            continue
        if re.match(r"^-{2,}\s*Page\s+\d+", l, re.I):
            formatted.append(f"\n\n---\n\n### {l.strip('- ')}\n")
        elif re.match(r"^(subject\s*[:.] |question\s*bank|unit\s+\d|chapter\s+\d)", l, re.I):
            formatted.append(f"\n## {l}\n")
        elif re.match(r"^(short\s+questions?|broad\s+questions?|long\s+questions?|section\s+[a-z]|fill\s+in|true\s+or\s+false|match\s+the|multiple\s+choice|mcq|objective)", l, re.I):
            formatted.append(f"\n### {l}\n")
        elif re.match(r"^(Q\.?\s*)?(\d{1,3})\s*[.)]\s+", l):
            m = re.match(r"^(Q\.?\s*)?(\d{1,3})\s*[.)]\s+(.*)", l)
            if m:
                formatted.append(f"\n**{m.group(2)}. {m.group(3).strip()}**\n")
            else:
                formatted.append(f"\n**{l}**\n")
        elif l.startswith(("-", "*", "•")):
            formatted.append(f"- {l.lstrip('-*• ')}")
        elif re.match(r"^\(?[a-eA-Eivx]{1,4}[.)]\s+", l):
            formatted.append(f"   - {l}")
        elif re.match(r"^(Define|Describe|Differentiate|Distinguish|Draw|Discuss|Mention|Write|What|Why|How|Give|Classify|Compare|Contrast|Explain|State|List|Name|Enumerate)\b", l, re.I) and len(l) > 15:
            formatted.append(f"\n**{l}**\n")
        else:
            formatted.append(l)

    result = "\n".join(formatted).strip()
    return re.sub(r"\n{4,}", "\n\n\n", result)


# ---------------------------------------------------------------------------
# PDF extraction (text layer → GPU OCR per page)
# ---------------------------------------------------------------------------

def extract_pdf_page_by_page(file_path: str, on_page_progress=None) -> str:
    """Extract text page-by-page: prefer text layer, fall back to GPU EasyOCR."""
    filename = os.path.basename(file_path)
    extracted_pages = []

    try:
        doc = fitz.open(file_path)
        total_pages = len(doc)
        print(f"[+] '{filename}' — {total_pages} page(s). Starting extraction...")

        for page_idx in range(total_pages):
            page_num = page_idx + 1
            page = doc[page_idx]
            page_text = page.get_text()
            ocr_used = False

            # Fall back to EasyOCR if page has no meaningful text
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
                extracted_pages.append(f"--- Page {page_num} of {total_pages} ---\n{page_text.strip()}")

            print(f"   -> [Page {page_num}/{total_pages}] {'GPU OCR' if ocr_used else 'Text Layer'} ({len(page_text.strip()) if page_text else 0} chars)")

            if on_page_progress:
                on_page_progress(page_num, total_pages, ocr_used)

        doc.close()
    except Exception as e:
        print(f"Error during extraction for {filename}: {e}")

    raw = "\n\n".join(extracted_pages).strip()
    return format_ocr_text_locally(raw) if raw else f"Classroom Study Note: '{filename}'"


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def extract_text_from_file(file_path: str, on_page_progress=None) -> str:
    ext = os.path.splitext(file_path)[1].lower()
    filename = os.path.basename(file_path)

    if ext == ".pdf":
        return extract_pdf_page_by_page(file_path, on_page_progress=on_page_progress)

    if ext in (".docx", ".doc"):
        try:
            import docx
            doc = docx.Document(file_path)
            text = "\n".join(p.text for p in doc.paragraphs if p.text).strip()
            if text:
                return text
        except Exception:
            pass

    if ext in (".pptx", ".ppt"):
        try:
            import pptx
            prs = pptx.Presentation(file_path)
            text = "\n".join(
                shape.text.strip()
                for slide in prs.slides
                for shape in slide.shapes
                if hasattr(shape, "text") and shape.text.strip()
            ).strip()
            if text:
                return text
        except Exception:
            pass

    if ext in (".png", ".jpg", ".jpeg", ".webp", ".bmp"):
        reader = get_easyocr_reader()
        if reader:
            try:
                if on_page_progress:
                    on_page_progress(1, 1, True)
                results = reader.readtext(file_path, detail=0)
                text = " ".join(results).strip()
                if text:
                    return format_ocr_text_locally(text)
            except Exception as e:
                print(f"Error OCR extracting standalone image {filename}: {e}")

    # Plain text and Markdown fallback (.txt, .md)
    try:
        if on_page_progress:
            on_page_progress(1, 1, False)
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read().strip()
            if text:
                return text
    except Exception:
        pass

    return f"Classroom Study Material: '{filename}'"
