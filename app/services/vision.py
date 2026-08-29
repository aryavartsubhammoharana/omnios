import os
import re
import time
import base64
import requests
from io import BytesIO
from PIL import Image
from app.config import settings

def _encode_image_to_base64(image_input: bytes | str | Image.Image) -> str:
    pil_img = None
    if isinstance(image_input, Image.Image):
        pil_img = image_input.convert("RGB")
    elif isinstance(image_input, bytes):
        pil_img = Image.open(BytesIO(image_input)).convert("RGB")
    elif isinstance(image_input, str) and os.path.exists(image_input):
        pil_img = Image.open(image_input).convert("RGB")

    if pil_img:
        max_dim = 800
        if max(pil_img.width, pil_img.height) > max_dim:
            pil_img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
        buffered = BytesIO()
        pil_img.save(buffered, format="JPEG", quality=80)
        return base64.b64encode(buffered.getvalue()).decode("utf-8")

    return ""

def analyze_image_with_groq_vision(image_input: bytes | str | Image.Image, max_retries: int = 3) -> str:
    b64_image = _encode_image_to_base64(image_input)
    if not b64_image:
        return ""

    prompt = (
        "Analyze this academic lecture diagram, chart, graph, formula, or illustration. "
        "Describe what it represents concisely. List any visible axes, variables, values, components, "
        "or scientific laws shown. Format the output in clean Markdown with LaTeX for formulas where appropriate."
    )

    vision_key = settings.GROQ_VISION_API_KEY.strip() or settings.GROQ_API_KEY.strip()
    if vision_key:
        try:
            headers = {
                "Authorization": f"Bearer {vision_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": settings.GROQ_VISION_MODEL or "qwen/qwen3.6-27b",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{b64_image}"
                                }
                            }
                        ]
                    }
                ],
                "temperature": 0.2,
                "max_tokens": 600
            }

            for attempt in range(max_retries):
                res = requests.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers, timeout=30)
                if res.status_code == 200:
                    analysis = res.json()["choices"][0]["message"]["content"].strip()
                    analysis = re.sub(r"<think>.*?</think>", "", analysis, flags=re.DOTALL).strip()
                    if analysis:
                        print(f"[OK] Groq Vision analyzed image in ~1s ({len(analysis)} chars)")
                        return analysis

                if res.status_code == 429:
                    match = re.search(r"try again in ([\d\.]+)s", res.text)
                    sleep_secs = float(match.group(1)) + 1.0 if match else (6.0 * (attempt + 1))
                    print(f"[Rate-Limit 429] Groq TPM limit reached. Sleeping {sleep_secs:.1f}s before retry (attempt {attempt + 1}/{max_retries})...")
                    time.sleep(sleep_secs)
                    continue

                print(f"Groq Vision API Error ({res.status_code}): {res.text}")
                break

        except Exception as e:
            print(f"Groq Vision note: {e}")

    return ""

def analyze_image_with_llava(image_input: bytes | str | Image.Image) -> str:
    return analyze_image_with_groq_vision(image_input)
