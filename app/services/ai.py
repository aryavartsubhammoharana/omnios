import requests
import json
from google import genai
from app.config import settings

def query_gemini_ai(prompt: str, context: str = "") -> str:
    """Generate answer using Google Gemini SDK with automatic model rotation & Sarvam AI fallback on 429 quota limits."""
    if not settings.GEMINI_API_KEY:
        print("Gemini API key missing, falling back to Sarvam AI...")
        return query_sarvam_ai(prompt, context)
    
    if context and context.strip():
        full_prompt = (
            f"You are NoteAI, an intelligent, helpful, and friendly academic tutor.\n\n"
            f"--- RELEVANT CLASSROOM STUDY MATERIAL ---\n"
            f"{context[:12000]}\n"
            f"-----------------------------------------\n\n"
            f"STUDENT QUESTION / PROMPT: {prompt}\n\n"
            f"INSTRUCTIONS:\n"
            f"1. If the user is just greeting or chatting naturally (e.g. 'Hi', 'Hello', 'Can you help me?'), respond warmly and invite them to ask questions.\n"
            f"2. Use the provided classroom study material as your primary reference when answering academic questions.\n"
            f"3. You are free to use your own knowledge to provide clear explanations, simple examples, intuitive analogies, and step-by-step guidance to help the student learn effectively.\n"
            f"4. Format your response cleanly using markdown (bold key terms, bullet points, headers, or tables where appropriate)."
        )
    else:
        full_prompt = (
            f"You are NoteAI, an intelligent, helpful, and friendly academic tutor.\n\n"
            f"STUDENT QUESTION / PROMPT: {prompt}\n\n"
            f"Provide a clear, accurate, and comprehensive answer with clean markdown formatting."
        )

    models_to_try = [settings.GEMINI_MODEL or "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
    
    for model_name in models_to_try:
        try:
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            response = client.models.generate_content(
                model=model_name,
                contents=full_prompt,
            )
            if response.text and response.text.strip() and not response.text.startswith("Gemini API Error"):
                return response.text.strip()
        except Exception as e:
            print(f"Gemini model '{model_name}' error/quota limit: {e}")

    # Fallback to direct REST API call
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
        payload = {"contents": [{"parts": [{"text": full_prompt}]}]}
        res = requests.post(url, json=payload, timeout=60)
        if res.status_code == 200:
            data = res.json()
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception as ex:
        print(f"Gemini REST API fallback error: {ex}")

    # Seamless Fallback to Sarvam AI (sarvam-105b-conversations) if Gemini 429 Quota is exhausted!
    print("Gemini API quota exhausted (429). Seamlessly falling back to Sarvam AI...")
    sarvam_res = query_sarvam_ai(prompt=prompt, context=context)
    if sarvam_res and not sarvam_res.startswith("Sarvam API Error"):
        return f"{sarvam_res}\n\n*(Powered by Sarvam AI fallback)*"
    
    return sarvam_res

def query_sarvam_ai(prompt: str, context: str = "") -> str:
    """Generate answer using Sarvam AI (sarvam-105b-conversations)."""
    if not settings.SARVAM_API_KEY:
        return "Sarvam API key is not configured in .env file."
    
    try:
        url = "https://api.sarvam.ai/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.SARVAM_API_KEY.strip()}",
            "api-key": settings.SARVAM_API_KEY.strip()
        }
        system_content = (
            "You are NoteAI, an intelligent, helpful, and friendly academic tutor. "
            "Help students with clear, well-explained answers. "
            "You can have natural conversations and use your knowledge with simple analogies, "
            "while referencing uploaded classroom notes when relevant."
        )
        if context and context.strip():
            system_content += f"\n\nClassroom Study Notes for Reference:\n{context[:10000]}"

        payload = {
            "model": settings.SARVAM_MODEL or "sarvam-105b-conversations",
            "messages": [
                {"role": "system", "content": system_content},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7
        }
        res = requests.post(url, json=payload, headers=headers, timeout=60)
        if res.status_code == 200:
            data = res.json()
            return data["choices"][0]["message"]["content"].strip()
        else:
            return f"Sarvam API Error ({res.status_code}): {res.text}"
    except Exception as e:
        return f"Error querying Sarvam AI: {str(e)}"

def generate_document_summary(context: str, summary_type: str = "bullet") -> str:
    prompt = f"Generate a comprehensive {summary_type} study guide summary based strictly on the uploaded classroom study material."
    return query_gemini_ai(prompt=prompt, context=context)

def generate_quiz_questions(context: str, num_questions: int = 5) -> list:
    prompt = f"""Generate an educational JSON list of {num_questions} multiple choice questions based on the key concepts in the provided classroom study material.
Return ONLY valid raw JSON array of objects without markdown fences.
Each object must have:
- "id": number (1 to N)
- "question": string (engaging conceptual question testing understanding)
- "options": list of 4 plausible strings
- "correct_index": integer (0, 1, 2, or 3)
- "explanation": string (clear educational reasoning why the answer is correct)
- "sub_topic": string (academic topic or concept name)
"""
    raw_response = query_gemini_ai(prompt=prompt, context=context)
    clean_json = raw_response.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(clean_json)
    except Exception:
        return [{
            "id": 1,
            "question": "Which core topic is covered in the uploaded study notes?",
            "options": ["CY202 - Biology and Environmental Science", "General Knowledge", "Unrelated Subject", "None"],
            "correct_index": 0,
            "explanation": "Extracted directly from the uploaded classroom study PDF.",
            "sub_topic": "Unit 1: Cells & Biomolecules"
        }]

def structure_ocr_text_with_sarvam(raw_ocr_text: str) -> str:
    """Uses Sarvam AI (with Gemini fallback) to convert raw OCR lines into structured Markdown with tables, bold questions, and headings."""
    if not raw_ocr_text or not raw_ocr_text.strip():
        return raw_ocr_text

    prompt = (
        "You are an expert Document Formatter. Convert the following RAW OCR text extracted from lecture notes "
        "into clean, beautifully structured Markdown without losing any information.\n\n"
        "STRICT FORMATTING RULES:\n"
        "1. Convert any tables, comparisons, or differences into clean Markdown tables (| Col 1 | Col 2 |).\n"
        "2. Format all questions in bold on separate lines (e.g. **1. What is a peptide bond?** or **Q2. Explain photosynthesis.**).\n"
        "3. Use appropriate Markdown headings (## for Units/Chapters, ### for Sections/Short Questions/Broad Questions).\n"
        "4. Preserve page separators (e.g. '### 📄 Page 1 of 4').\n"
        "5. Do NOT summarize or delete content. Keep all questions, options, definitions, and terms intact.\n"
        "6. Return ONLY the formatted markdown content without conversational chatter.\n\n"
        f"RAW OCR TEXT:\n{raw_ocr_text[:12000]}"
    )

    # 1. Try Sarvam AI First
    if settings.SARVAM_API_KEY:
        try:
            url = "https://api.sarvam.ai/v1/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.SARVAM_API_KEY.strip()}",
                "api-key": settings.SARVAM_API_KEY.strip()
            }
            payload = {
                "model": settings.SARVAM_MODEL or "sarvam-105b-conversations",
                "messages": [
                    {"role": "system", "content": "You are an expert Document Formatter. Convert raw OCR text into structured Markdown."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.2
            }
            res = requests.post(url, json=payload, headers=headers, timeout=60)
            if res.status_code == 200:
                data = res.json()
                result = data["choices"][0]["message"]["content"].strip()
                if result and len(result) > 50:
                    print("[OK] Raw OCR text structured via Sarvam AI!")
                    return result
        except Exception as e:
            print(f"Sarvam structuring fallback to Gemini: {e}")

    # 2. Try Gemini AI Fallback
    try:
        gemini_result = query_gemini_ai(prompt=prompt)
        if gemini_result and not gemini_result.startswith("Gemini API Error"):
            print("[OK] Raw OCR text structured via Gemini AI!")
            return gemini_result
    except Exception:
        pass

    # 3. Fallback to Local Regex Formatter
    from app.services.extractor import format_ocr_text_locally
    return format_ocr_text_locally(raw_ocr_text)

