import os
import re
import time
import math
import base64
import requests
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
from app.config import settings

def merge_images_into_grid(image_paths: list[str], output_path: str, images_per_row: int = 3) -> str:
    if not image_paths:
        return ""

    num_images = len(image_paths)
    cols = min(images_per_row, num_images)
    rows = math.ceil(num_images / cols)

    thumb_w, thumb_h = 350, 350
    label_h = 36
    cell_w = thumb_w
    cell_h = thumb_h + label_h
    gap = 16

    grid_w = (cols * cell_w) + ((cols + 1) * gap)
    grid_h = (rows * cell_h) + ((rows + 1) * gap)

    grid_img = Image.new("RGB", (grid_w, grid_h), color=(20, 24, 39))
    draw = ImageDraw.Draw(grid_img)

    try:
        font = ImageFont.truetype("arial.ttf", 20)
    except Exception:
        font = ImageFont.load_default()

    for idx, path in enumerate(image_paths):
        if not os.path.exists(path):
            continue
        try:
            img = Image.open(path).convert("RGB")
            img.thumbnail((thumb_w, thumb_h), Image.Resampling.LANCZOS)

            pad_img = Image.new("RGB", (thumb_w, thumb_h), color=(13, 17, 28))
            offset_x = (thumb_w - img.width) // 2
            offset_y = (thumb_h - img.height) // 2
            pad_img.paste(img, (offset_x, offset_y))

            r = idx // cols
            c = idx % cols

            x = gap + c * (cell_w + gap)
            y = gap + r * (cell_h + gap)

            grid_img.paste(pad_img, (x, y))

            label_text = f"Image {idx + 1}"
            bbox = draw.textbbox((0, 0), label_text, font=font)
            text_w = bbox[2] - bbox[0]
            text_x = x + (cell_w - text_w) // 2
            text_y = y + thumb_h + 6

            draw.text((text_x, text_y), label_text, fill=(200, 215, 255), font=font)
        except Exception:
            continue

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    grid_img.save(output_path, format="JPEG", quality=80, optimize=True)
    return output_path


def analyze_image_batch_with_groq(image_path: str, image_count: int, page_number: int, max_retries: int = 3) -> str:
    if not settings.GROQ_API_KEY:
        print("[WARNING] GROQ_API_KEY is not configured in .env")
        return ""

    if not os.path.exists(image_path):
        return ""

    try:
        pil_img = Image.open(image_path).convert("RGB")
        max_dim = 800
        if max(pil_img.width, pil_img.height) > max_dim:
            pil_img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

        buf = BytesIO()
        pil_img.save(buf, format="JPEG", quality=80)
        b64_str = base64.b64encode(buf.getvalue()).decode("utf-8")

        if image_count > 1:
            prompt = (
                f"This image shows {image_count} diagram(s)/figure(s) from page {page_number} of a classroom document, "
                f"labeled Image 1 through Image {image_count}. Describe what EACH labeled image shows separately. "
                f"Extract any visible text, formulas, numbers, or data. Format your response as:\n"
                f"Image 1: <description>\n"
                f"Image 2: <description>\n"
                f"(etc, one per labeled image)"
            )
        else:
            prompt = (
                f"This image shows a diagram/figure from page {page_number} of a classroom document. "
                f"Describe what it shows concisely. Extract any visible text, formulas, numbers, or data."
            )

        headers = {
            "Authorization": f"Bearer {settings.GROQ_API_KEY.strip()}",
            "Content-Type": "application/json"
        }

        model_to_use = "qwen/qwen3.6-27b"

        payload = {
            "model": model_to_use,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{b64_str}"
                            }
                        }
                    ]
                }
            ],
            "temperature": 0.2,
            "max_tokens": 800
        }

        for attempt in range(max_retries):
            res = requests.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers, timeout=45)
            if res.status_code == 200:
                content = res.json()["choices"][0]["message"]["content"].strip()
                content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
                return content

            if res.status_code == 429:
                match = re.search(r"try again in ([\d\.]+)s", res.text)
                sleep_secs = float(match.group(1)) + 1.0 if match else (6.0 * (attempt + 1))
                print(f"[Rate-Limit 429] Groq TPM limit reached. Sleeping {sleep_secs:.1f}s before retry (attempt {attempt + 1}/{max_retries})...")
                time.sleep(sleep_secs)
                continue

            print(f"Groq Vision API Error ({res.status_code}): {res.text}")
            break

    except Exception as e:
        print(f"Groq Vision call failed: {e}")

    return ""


def parse_groq_batch_response(raw_text: str, local_image_ids: dict) -> dict:
    if not raw_text or not local_image_ids:
        return {}

    cleaned_text = re.sub(r"<think>.*?</think>", "", raw_text, flags=re.DOTALL).strip()

    results = {}
    if len(local_image_ids) == 1:
        first_id = list(local_image_ids.values())[0]
        results[first_id] = cleaned_text
        return results

    pattern = r"(?:^|\n)\s*Image\s+(\d+)\s*:\s*"
    splits = re.split(pattern, cleaned_text, flags=re.IGNORECASE)

    if len(splits) > 1:
        for i in range(1, len(splits), 2):
            img_num = splits[i].strip()
            desc = splits[i + 1].strip() if (i + 1) < len(splits) else ""
            key = f"Image {img_num}"
            if key in local_image_ids:
                img_id = local_image_ids[key]
                results[img_id] = desc

    if not results and local_image_ids:
        first_id = list(local_image_ids.values())[0]
        results[first_id] = cleaned_text

    return results
