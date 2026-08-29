import os
import re
import base64
import requests
from io import BytesIO
from PIL import Image
from app.config import settings

def _encode_image_to_base64(image_input: bytes | str | Image.Image) -> str:
    if isinstance(image_input, Image.Image):
        buffered = BytesIO()
        image_input.convert("RGB").save(buffered, format="JPEG", quality=85)
        return base64.b64encode(buffered.getvalue()).decode("utf-8")
    elif isinstance(image_input, bytes):
        return base64.b64encode(image_input).decode("utf-8")
    elif isinstance(image_input, str) and os.path.exists(image_input):
        with open(image_input, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")
    return ""

def analyze_image_with_groq_vision(image_input: bytes | str | Image.Image) -> str:
    b64_image = _encode_image_to_base64(image_input)
    if not b64_image:
        return ""

    prompt = (
        "Analyze this academic lecture diagram, chart, graph, formula, or illustration. "
        "Describe what it represents concisely. List any visible axes, variables, values, components, "
        "or scientific laws shown. Format the output in clean Markdown with LaTeX for formulas where appropriate."
    )

    if settings.GROQ_API_KEY:
        try:
            headers = {
                "Authorization": f"Bearer {settings.GROQ_API_KEY.strip()}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "qwen/qwen3.6-27b",
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
                "max_tokens": 700
            }
            res = requests.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers, timeout=25)
            if res.status_code == 200:
                analysis = res.json()["choices"][0]["message"]["content"].strip()
                analysis = re.sub(r"<think>.*?</think>", "", analysis, flags=re.DOTALL).strip()
                if analysis:
                    print(f"[OK] Groq Vision (qwen/qwen3.6-27b) analyzed image in ~1s ({len(analysis)} chars)")
                    return analysis
            else:
                print(f"Groq Vision API Error ({res.status_code}): {res.text}")
        except Exception as e:
            print(f"Groq Vision note: {e}")

    return ""

def analyze_image_with_llava(image_input: bytes | str | Image.Image) -> str:
    return analyze_image_with_groq_vision(image_input)
