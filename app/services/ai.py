import requests
import json
from google import genai
from groq import Groq
from app.config import settings


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def is_valid_ai_text(text: str) -> bool:
    """Returns True only if the text is a real AI answer, not an error string."""
    if not text or len(text.strip()) < 30:
        return False
    error_signatures = [
        "error querying", "sarvam api error", "gemini api error", "groq api error",
        "httpsconnectionpool", "read timed out", "quota exceeded",
        "rate limit", "429", "500 internal", "timeout",
    ]
    t_lower = text.lower()
    return not any(sig in t_lower for sig in error_signatures)


def _build_tutor_prompt(prompt: str, context: str) -> str:
    """Build the shared structured tutor prompt used by all LLM providers."""
    if context and context.strip():
        return (
            f"You are NoteAI, an intelligent, helpful, and friendly academic tutor.\n\n"
            f"--- RELEVANT CLASSROOM STUDY MATERIAL ---\n"
            f"{context[:12000]}\n"
            f"-----------------------------------------\n\n"
            f"STUDENT QUESTION / PROMPT: {prompt}\n\n"
            f"INSTRUCTIONS:\n"
            f"1. If the user is just greeting or chatting naturally (e.g. 'Hi', 'Hello'), respond warmly.\n"
            f"2. Use the provided classroom material as your primary reference.\n"
            f"3. Supplement with your own knowledge for examples, analogies, and step-by-step guidance.\n"
            f"4. CRITICAL FORMATTING — follow exactly:\n"
            f"   - Use '##' for major sections, '###' for sub-sections\n"
            f"   - Use numbered lists (1. 2. 3.) for sequential steps or questions\n"
            f"   - Use '- ' bullet points for lists of items\n"
            f"   - Use '**bold**' for key terms and question titles\n"
            f"   - Each question/point on its OWN line with a blank line between\n"
            f"   - Markdown tables (| Col | Col |) for comparisons\n"
            f"   - `$formula$` for inline math, `$$formula$$` for display equations\n"
            f"   - NEVER write everything as one long paragraph\n"
        )
    return (
        f"You are NoteAI, an intelligent, helpful, and friendly academic tutor.\n\n"
        f"STUDENT QUESTION / PROMPT: {prompt}\n\n"
        f"Provide a clear, comprehensive answer with clean markdown formatting.\n"
        f"Use ## headings, numbered lists, bullet points, **bold** key terms, and tables where appropriate.\n"
        f"NEVER write one giant paragraph — always use structured markdown.\n"
    )


# ---------------------------------------------------------------------------
# Gemini AI  (Provider 1)
# ---------------------------------------------------------------------------

def query_gemini_ai(prompt: str, context: str = "") -> str:
    """Query Google Gemini with model rotation. Falls back to Sarvam → Groq on quota exhaustion."""
    if not settings.GEMINI_API_KEY:
        return query_sarvam_ai(prompt, context)

    full_prompt = _build_tutor_prompt(prompt, context)

    # Try SDK models in rotation
    for model_name in [settings.GEMINI_MODEL or "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]:
        try:
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            response = client.models.generate_content(model=model_name, contents=full_prompt)
            if response.text and response.text.strip():
                return response.text.strip()
        except Exception as e:
            print(f"Gemini model '{model_name}' failed: {e}")

    # REST API fallback
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
        res = requests.post(url, json={"contents": [{"parts": [{"text": full_prompt}]}]}, timeout=60)
        if res.status_code == 200:
            return res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception as ex:
        print(f"Gemini REST fallback error: {ex}")

    # Cascade to Sarvam
    print("Gemini quota exhausted — falling back to Sarvam AI...")
    sarvam_res = query_sarvam_ai(prompt=prompt, context=context)
    if is_valid_ai_text(sarvam_res):
        return f"{sarvam_res}\n\n*(Powered by Sarvam AI)*"

    # Cascade to Groq
    print("Sarvam also failed — falling back to Groq AI...")
    groq_res = query_groq_ai(prompt=prompt, context=context)
    if is_valid_ai_text(groq_res):
        return f"{groq_res}\n\n*(Powered by Groq AI)*"

    return groq_res


# ---------------------------------------------------------------------------
# Sarvam AI  (Provider 2)
# ---------------------------------------------------------------------------

def query_sarvam_ai(prompt: str, context: str = "") -> str:
    """Query Sarvam AI with short system prompt and capped context to avoid content_filter (400)."""
    if not settings.SARVAM_API_KEY:
        return query_groq_ai(prompt, context)

    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.SARVAM_API_KEY.strip()}",
            "api-key": settings.SARVAM_API_KEY.strip(),
        }
        system_content = (
            "You are NoteAI, a helpful academic tutor. "
            "Answer student questions clearly and accurately. "
            "Reference the provided notes when relevant, and use your knowledge for analogies and guidance."
        )

        # Sanitize prompt — repeated % chars can trigger Sarvam's content filter
        safe_prompt = prompt.replace("%%", "marks").replace("%", " percent ").strip()

        # Merge context into user message (capped at 3000 chars) — safer than large system prompts
        if context and context.strip():
            user_message = f"Study Notes (reference):\n{context.strip()[:3000]}\n\nStudent Question: {safe_prompt}"
        else:
            user_message = safe_prompt

        payload = {
            "model": settings.SARVAM_MODEL or "sarvam-105b-conversations",
            "messages": [
                {"role": "system", "content": system_content},
                {"role": "user", "content": user_message},
            ],
            "temperature": 0.7,
            "max_tokens": 1500,
        }
        res = requests.post("https://api.sarvam.ai/v1/chat/completions", json=payload, headers=headers, timeout=60)
        if res.status_code == 200:
            return res.json()["choices"][0]["message"]["content"].strip()
        print(f"Sarvam API Error ({res.status_code}): {res.text}")
        return f"Sarvam API Error ({res.status_code}): {res.text}"
    except Exception as e:
        return f"Error querying Sarvam AI: {e}"


# ---------------------------------------------------------------------------
# Groq AI  (Provider 3 — ultra-fast LPU inference)
# ---------------------------------------------------------------------------

def query_groq_ai(prompt: str, context: str = "") -> str:
    """Query Groq AI (LLaMA 3.3 70B) — ultra-fast LPU inference, great free tier."""
    if not settings.GROQ_API_KEY:
        return "Groq API key is not configured."

    try:
        client = Groq(api_key=settings.GROQ_API_KEY.strip())

        system_content = (
            "You are NoteAI, a helpful and friendly academic tutor. "
            "Answer student questions clearly and accurately using proper markdown formatting. "
            "Use ## headings, numbered lists, bullet points, **bold** key terms, tables, and math formulas. "
            "Reference provided study notes when relevant."
        )

        # Cap context at 4000 chars (Groq's context window is generous)
        if context and context.strip():
            user_message = f"Study Notes (reference):\n{context.strip()[:4000]}\n\nStudent Question: {prompt}"
        else:
            user_message = prompt

        response = client.chat.completions.create(
            model=settings.GROQ_MODEL or "llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": user_message},
            ],
            temperature=0.7,
            max_tokens=2048,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Groq API error: {e}")
        return f"Groq API Error: {e}"


# ---------------------------------------------------------------------------
# Document utilities (summary, quiz, OCR structuring)
# ---------------------------------------------------------------------------

def generate_document_summary(context: str, summary_type: str = "bullet") -> str:
    prompt = f"Generate a comprehensive {summary_type} study guide summary based on the uploaded classroom study material."
    return query_gemini_ai(prompt=prompt, context=context)


def generate_quiz_questions(context: str, num_questions: int = 5) -> list:
    prompt = (
        f"Generate an educational JSON list of {num_questions} multiple-choice questions "
        f"based on the key concepts in the provided classroom study material.\n"
        f"Return ONLY a valid raw JSON array (no markdown fences). Each object must have:\n"
        f'- "id": number\n- "question": string\n- "options": list of 4 strings\n'
        f'- "correct_index": integer (0–3)\n- "explanation": string\n- "sub_topic": string'
    )
    raw = query_gemini_ai(prompt=prompt, context=context)
    clean = raw.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(clean)
    except Exception:
        return [{
            "id": 1,
            "question": "Which core topic is covered in the uploaded study notes?",
            "options": ["The uploaded classroom material", "General Knowledge", "Unrelated Subject", "None"],
            "correct_index": 0,
            "explanation": "Extracted directly from the uploaded classroom PDF.",
            "sub_topic": "Classroom Notes",
        }]


def structure_ocr_text_with_sarvam(raw_ocr_text: str) -> str:
    """Structure raw OCR text into clean Markdown using Gemini → Sarvam → Groq → local fallback."""
    from app.services.extractor import format_ocr_text_locally

    if not raw_ocr_text or not raw_ocr_text.strip():
        return raw_ocr_text

    local_clean = format_ocr_text_locally(raw_ocr_text)

    formatting_prompt = (
        "You are an expert Document Formatter. Convert the following RAW OCR text extracted from lecture notes "
        "into clean, beautifully structured Markdown without losing any information.\n\n"
        "STRICT FORMATTING RULES:\n"
        "1. REPAIR ALL BROKEN SENTENCES. OCR splits single sentences across lines. Join them.\n"
        "2. Format question titles in bold on a single line (e.g. **2. What is a peptide bond?**).\n"
        "3. Convert tables/comparisons into clean Markdown tables.\n"
        "4. Use ## for Units/Chapters, ### for Sections.\n"
        "5. Do NOT summarize or drop any content — keep everything 100% intact.\n"
        "6. Return ONLY the structured markdown, no conversational filler.\n\n"
        f"RAW OCR TEXT:\n{raw_ocr_text[:8000]}"
    )

    # Try Gemini
    if settings.GEMINI_API_KEY:
        try:
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL or "gemini-2.5-flash",
                contents=formatting_prompt,
            )
            if response.text and is_valid_ai_text(response.text):
                print("[OK] Document structured via Gemini AI!")
                return response.text.strip()
        except Exception as e:
            print(f"Note on Gemini structuring: {e}")

    # Try Sarvam
    if settings.SARVAM_API_KEY:
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.SARVAM_API_KEY.strip()}",
                "api-key": settings.SARVAM_API_KEY.strip(),
            }
            payload = {
                "model": settings.SARVAM_MODEL or "sarvam-105b-conversations",
                "messages": [
                    {"role": "system", "content": "You are an expert Document Formatter. Convert raw OCR text into structured Markdown."},
                    {"role": "user", "content": formatting_prompt},
                ],
                "temperature": 0.2,
            }
            res = requests.post("https://api.sarvam.ai/v1/chat/completions", json=payload, headers=headers, timeout=25)
            if res.status_code == 200:
                result = res.json()["choices"][0]["message"]["content"].strip()
                if is_valid_ai_text(result):
                    print("[OK] Document structured via Sarvam AI!")
                    return result
        except Exception as e:
            print(f"Note on Sarvam structuring: {e}")

    # Try Groq
    if settings.GROQ_API_KEY:
        try:
            groq_client = Groq(api_key=settings.GROQ_API_KEY.strip())
            response = groq_client.chat.completions.create(
                model=settings.GROQ_MODEL or "llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are an expert Document Formatter. Convert raw OCR text into clean structured Markdown."},
                    {"role": "user", "content": formatting_prompt},
                ],
                temperature=0.2,
                max_tokens=4096,
            )
            result = response.choices[0].message.content.strip()
            if is_valid_ai_text(result):
                print("[OK] Document structured via Groq AI!")
                return result
        except Exception as e:
            print(f"Note on Groq structuring: {e}")

    # Local fallback (instant, zero cost)
    print("[OK] Document structured via local sentence repair engine!")
    return local_clean
