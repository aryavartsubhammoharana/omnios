import os
import re
import fitz

def format_extracted_text(raw_text: str) -> str:
    if not raw_text or not raw_text.strip():
        return raw_text

    text = raw_text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    formatted = []
    for l in lines:
        if re.match(r"^--- Page \d+", l, re.I) or re.match(r"^--- Slide \d+", l, re.I):
            formatted.append(f"\n\n---\n\n### {l.strip('- ')}\n")
        elif re.match(r"^(subject\s*[:.]|question\s*bank|unit\s+\d+|chapter\s+\d+|module\s+\d+|topic\s*[:.])", l, re.I):
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

        for page_idx in range(total_pages):
            page_num = page_idx + 1
            page = doc[page_idx]
            page_text = page.get_text("text").strip()

            if page_text:
                extracted_pages.append(f"--- Page {page_num} of {total_pages} ---\n{page_text}")

            if on_page_progress:
                on_page_progress(page_num, total_pages, False)

        doc.close()
    except Exception as e:
        print(f"Error reading PDF {filename}: {e}")

    full_text = "\n\n".join(extracted_pages).strip()
    return format_extracted_text(full_text) if full_text else f"Classroom Study Note: '{filename}'"


def extract_docx_clean(file_path: str, on_page_progress=None) -> str:
    filename = os.path.basename(file_path)
    try:
        import docx
        doc = docx.Document(file_path)
        parts = []

        for p in doc.paragraphs:
            txt = p.text.strip()
            if not txt:
                continue
            if p.style.name.startswith("Heading 1"):
                parts.append(f"\n# {txt}\n")
            elif p.style.name.startswith("Heading 2"):
                parts.append(f"\n## {txt}\n")
            elif p.style.name.startswith("Heading 3"):
                parts.append(f"\n### {txt}\n")
            elif p.style.name.startswith("List"):
                parts.append(f"- {txt}")
            else:
                parts.append(txt)

        for t_idx, table in enumerate(doc.tables):
            table_rows = []
            for r_idx, row in enumerate(table.rows):
                cells = [cell.text.strip().replace("\n", " ") for cell in row.cells]
                row_str = "| " + " | ".join(cells) + " |"
                table_rows.append(row_str)
                if r_idx == 0:
                    sep = "| " + " | ".join(["---"] * len(cells)) + " |"
                    table_rows.append(sep)
            if table_rows:
                parts.append("\n" + "\n".join(table_rows) + "\n")

        if on_page_progress:
            on_page_progress(1, 1, False)

        text = "\n".join(parts).strip()
        return format_extracted_text(text) if text else f"Word Document Note: '{filename}'"
    except Exception as e:
        print(f"Error extracting DOCX {filename}: {e}")
        return f"Word Document Note: '{filename}'"


def extract_pptx_clean(file_path: str, on_page_progress=None) -> str:
    filename = os.path.basename(file_path)
    try:
        import pptx
        prs = pptx.Presentation(file_path)
        total_slides = len(prs.slides)
        slides_text = []

        for s_idx, slide in enumerate(prs.slides):
            slide_num = s_idx + 1
            shape_texts = []
            for shape in slide.shapes:
                if hasattr(shape, "text") and shape.text.strip():
                    txt = shape.text.strip()
                    shape_texts.append(txt)

            if shape_texts:
                slides_text.append(f"--- Slide {slide_num} of {total_slides} ---\n" + "\n".join(shape_texts))

            if on_page_progress:
                on_page_progress(slide_num, total_slides, False)

        text = "\n\n".join(slides_text).strip()
        return format_extracted_text(text) if text else f"Presentation Lecture: '{filename}'"
    except Exception as e:
        print(f"Error extracting PPTX {filename}: {e}")
        return f"Presentation Lecture: '{filename}'"


def extract_text_file_clean(file_path: str, on_page_progress=None) -> str:
    filename = os.path.basename(file_path)
    encodings = ["utf-8", "latin-1", "cp1252"]
    for enc in encodings:
        try:
            with open(file_path, "r", encoding=enc, errors="ignore") as f:
                text = f.read().strip()
                if text:
                    if on_page_progress:
                        on_page_progress(1, 1, False)
                    return format_extracted_text(text)
        except Exception:
            continue
    return f"Study Note: '{filename}'"


def extract_text_from_file(file_path: str, doc_id: int | None = None, unique_code: str | None = None, classroom_code: str | None = None, on_page_progress=None) -> str:
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        return extract_pdf_clean(file_path, on_page_progress=on_page_progress)

    if ext in (".docx", ".doc"):
        return extract_docx_clean(file_path, on_page_progress=on_page_progress)

    if ext in (".pptx", ".ppt"):
        return extract_pptx_clean(file_path, on_page_progress=on_page_progress)

    if ext in (".txt", ".md", ".json", ".csv", ".py", ".c", ".cpp", ".java"):
        return extract_text_file_clean(file_path, on_page_progress=on_page_progress)

    return extract_text_file_clean(file_path, on_page_progress=on_page_progress)
