"""Advanced Multimodal Vision Analysis Service:
Uses local Ollama LLaVA (7B) with Groq Vision (LLaMA 3.2 11B Vision) and Gemini Vision fallbacks.
Analyzes lecture diagrams, charts, circuit diagrams, geometric figures, and mathematical graphs.
"""

import os
import base64
import requests
from io import BytesIO
from PIL import Image
from app.config import settings

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

def _encode_image_to_base64(image_input: bytes | str | Image.Image) -> str:
    """Helper to convert bytes, filepath, or PIL Image to base64 jpeg string."""
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

def analyze_image_with_llava(image_input: bytes | str | Image.Image) -> str:
    """Analyzes an image/diagram using LLaVA (Ollama) with Groq Vision / Gemini fallbacks."""
    b64_image = _encode_image_to_base64(image_input)
    if not b64_image:
        return ""

    prompt = (
        "Analyze this academic lecture diagram, chart, graph, formula, or illustration. "
        "Describe what it represents concisely. List any visible axes, variables, values, components, "
        "or scientific laws shown. Format the output in clean Markdown with LaTeX for formulas where appropriate."
    )

    # -------------------------------------------------------------------------
    # 1. Primary: Local Ollama LLaVA (llava:latest or qwen2.5vl:3b or moondream)
    # -------------------------------------------------------------------------
    try:
        payload = {
            "model": "llava",
            "prompt": prompt,
            "images": [b64_image],
            "stream": False,
            "options": {
                "temperature": 0.2,
                "num_predict": 350
            }
        }
        res = requests.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload, timeout=25)
        if res.status_code == 200:
            analysis = res.json().get("response", "").strip()
            if analysis and len(analysis) > 15:
                print(f"[OK] LLaVA (Ollama) analyzed image successfully ({len(analysis)} chars)")
                return analysis
    except Exception as e:
        print(f"Ollama LLaVA note (will try fallback): {e}")

    # -------------------------------------------------------------------------
    # 2. Fallback: Groq Vision (llama-3.2-11b-vision-preview)
    # -------------------------------------------------------------------------
    if settings.GROQ_API_KEY:
        try:
            headers = {
                "Authorization": f"Bearer {settings.GROQ_API_KEY.strip()}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "llama-3.2-11b-vision-preview",
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
                "max_tokens": 400
            }
            res = requests.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers, timeout=20)
            if res.status_code == 200:
                analysis = res.json()["choices"][0]["message"]["content"].strip()
                if analysis:
                    print(f"[OK] Groq Vision analyzed image successfully ({len(analysis)} chars)")
                    return analysis
        except Exception as e:
            print(f"Groq Vision fallback note: {e}")

    # -------------------------------------------------------------------------
    # 3. Fallback: Google Gemini Vision
    # -------------------------------------------------------------------------
    if settings.GEMINI_API_KEY:
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY.strip())
            model = genai.GenerativeModel("gemini-2.5-flash")
            
            # Load as PIL Image for Gemini
            image_data = base64.b64decode(b64_image)
            pil_img = Image.open(BytesIO(image_data))
            
            response = model.generate_content([prompt, pil_img])
            if response and response.text:
                print(f"[OK] Gemini Vision analyzed image successfully ({len(response.text)} chars)")
                return response.text.strip()
        except Exception as e:
            print(f"Gemini Vision fallback note: {e}")

    return ""
