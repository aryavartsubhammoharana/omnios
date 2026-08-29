import os
import re
import logging
import warnings
import numpy as np
import fitz
import torch

warnings.filterwarnings("ignore")
logging.getLogger("easyocr").setLevel(logging.ERROR)

_easyocr_reader = None

def get_easyocr_reader():
    global _easyocr_reader
    if _easyocr_reader is None:
        try:
            import easyocr
            use_gpu = torch.cuda.is_available()
            _easyocr_reader = easyocr.Reader(["en"], gpu=use_gpu, verbose=False)
        except Exception as e:
            print(f"Failed to initialize EasyOCR: {e}")
            _easyocr_reader = False
    return _easyocr_reader if _easyocr_reader is not False else None


def format_extracted_text(raw_text: str) -> str:
    if not raw_text or not raw_text.strip():
        return raw_text

    text = raw_text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    formatted = []
    for l in lines:
        if re.match(r"^--- Page \d+", l, re.I):
            formatted.append(f"\n\n---\n\n### {l.strip('- ')}\n")
        elif re.match(r"^(subject\s*[:.]|question\s*bank|unit\s+\d+|chapter\s+\d+|module\s+\d+)", l, re.I):
            formatted.append(f"\n## {l}\n")
        elif re.match(r"^(short\s+questions?|broad\s+questions?|long\s+questions?|section\s+[a-z]|fill\s+in|true\s+or\s+false|match\s+the|multiple\s+choice|mcq|objective)", l, re.I):
            formatted.append(f"\n### {l}\n")
        elif re.match(r"^(Q\.?\s*)?(\d{1,3})\s*[.)]\s+", l):
            formatted.append(f"\n**{l}**\n")
        elif l.startswith(("-", "*", "•")):
            formatted.append(f"- {l.lstrip('-*• ')}")
        elif re.match(r"^\(?[a-eA-Eivx]{1,4}[.)]\s+", l):
            formatted.append(f"   - {l}")
        else:
            formatted.append(l)

    result = "\n".join(formatted).strip()
    return re.sub(r"\n{3,}", "\n\n", result)


def extract_pdf_clean(file_path: str, on_page_progress=None) -> str:
    filename = os.path.basename(file_path)
    extracted_pages = []

    try:
        doc = fitz.open(file_path)
        total_pages = len(doc)
        print(f"[+] Extracting PDF: '{filename}' ({total_pages} pages)...")

        for page_idx in range(total_pages):
            page_num = page_idx + 1
            page = doc[page_idx]
            page_text = page.get_text("text").strip()
            ocr_used = False

            if not page_text or len(page_text) < 15:
                reader = get_easyocr_reader()
                if reader:
                    ocr_used = True
                    pix = page.get_pixmap(dpi=150)
                    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, pix.n))
                    ocr_lines = reader.readtext(img, detail=0)
                    if ocr_lines:
                        page_text = "\n".join(ocr_lines).strip()

            if page_text:
                extracted_pages.append(f"--- Page {page_num} of {total_pages} ---\n{page_text}")

            if on_page_progress:
                on_page_progress(page_num, total_pages, ocr_used)

        doc.close()
    except Exception as e:
        print(f"Error reading PDF {filename}: {e}")

    full_text = "\n\n".join(extracted_pages).strip()
    return format_extracted_text(full_text) if full_text else f"Classroom Study Note: '{filename}'"


def extract_text_from_file(file_path: str, doc_id: int | None = None, unique_code: str | None = None, classroom_code: str | None = None, on_page_progress=None) -> str:
    ext = os.path.splitext(file_path)[1].lower()
    filename = os.path.basename(file_path)

    if ext == ".pdf":
        return extract_pdf_clean(file_path, on_page_progress=on_page_progress)

    if ext in (".docx", ".doc"):
        try:
            import docx
            doc = docx.Document(file_path)
            paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
            for table in doc.tables:
                for row in table.rows:
                    row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                    if row_text:
                        paragraphs.append(row_text)
            text = "\n".join(paragraphs).strip()
            if on_page_progress:
                on_page_progress(1, 1, False)
            if text:
                return format_extracted_text(text)
        except Exception as e:
            print(f"Error extracting DOCX {filename}: {e}")

    if ext in (".pptx", ".ppt"):
        try:
            import pptx
            prs = pptx.Presentation(file_path)
            slides_text = []
            for s_idx, slide in enumerate(prs.slides):
                slide_shapes = [shape.text.strip() for shape in slide.shapes if hasattr(shape, "text") and shape.text.strip()]
                if slide_shapes:
                    slides_text.append(f"--- Slide {s_idx + 1} ---\n" + "\n".join(slide_shapes))
            text = "\n\n".join(slides_text).strip()
            if on_page_progress:
                on_page_progress(1, 1, False)
            if text:
                return format_extracted_text(text)
        except Exception as e:
            print(f"Error extracting PPTX {filename}: {e}")

    if ext in (".png", ".jpg", ".jpeg", ".webp", ".bmp"):
        if on_page_progress:
            on_page_progress(1, 1, True)
        reader = get_easyocr_reader()
        if reader:
            try:
                results = reader.readtext(file_path, detail=0)
                if results:
                    return format_extracted_text("\n".join(results).strip())
            except Exception as e:
                print(f"Error extracting image {filename}: {e}")

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
