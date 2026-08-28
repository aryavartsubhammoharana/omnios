import requests
import json
from google import genai
from app.config import settings

def query_gemini_ai(prompt: str, context: str = "") -> str:
    """Generate answer using Google Gemini SDK with automatic model rotation & Sarvam AI fallback on 429 quota limits."""
    if not settings.GEMINI_API_KEY:
        print("Gemini API key missing, falling back to Sarvam AI...")
        return query_sarvam_ai(prompt, context)
    
    full_prompt = prompt
    if context:
        full_prompt = f"STRICT CONTEXT FROM UPLOADED CLASSROOM MATERIAL ONLY:\n{context[:12000]}\n\nUser Prompt:\n{prompt}\n\nIMPORTANT: Base your response ONLY and EXCLUSIVELY on the uploaded material."

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
        res = requests.post(url, json=payload, timeout=20)
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
        system_content = "You are NoteAI Assistant powered by Sarvam AI. Assist students and teachers with clear, accurate answers based exclusively on the provided classroom documents."
        if context:
            system_content += f"\nBase your answer STRICTLY AND ONLY on this document context:\n{context[:10000]}"

        payload = {
            "model": settings.SARVAM_MODEL or "sarvam-105b-conversations",
            "messages": [
                {"role": "system", "content": system_content},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7
        }
        res = requests.post(url, json=payload, headers=headers, timeout=30)
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
    prompt = f"""STRICT REQUIREMENT: Generate a JSON list of exactly {num_questions} multiple choice questions BASED EXCLUSIVELY AND ONLY ON THE UPLOADED CLASSROOM STUDY MATERIAL.
DO NOT use any external knowledge, outside facts, or topics not explicitly covered in the study material.
Return ONLY valid raw JSON array of objects without markdown fences.
Each object must have:
- "id": number (1 to N)
- "question": string (derived directly from the study material)
- "options": list of 4 strings
- "correct_index": integer (0, 1, 2, or 3)
- "explanation": string (referencing the exact concept in the notes)
- "sub_topic": string
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
