import os
import re
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

def _get_groq_models():
    base = [settings.GROQ_MODEL or "openai/gpt-oss-120b", "qwen/qwen3.8-27b", "groq/compound", "openai/gpt-oss-20b", "groq/compound-mini"]
    seen = set()
    result = []
    for m in base:
        if m and m not in seen:
            seen.add(m)
            result.append(m)
    return result

def query_groq_ai(prompt: str, context: str = "") -> str:
    if not settings.GROQ_API_KEY:
        return "Groq API key is not configured."

    client = Groq(api_key=settings.GROQ_API_KEY.strip())

    system_content = (
        "You are NoteAI, an expert academic tutor and classroom assistant. "
        "Answer student questions with high accuracy, detail, and proper formatting. "
        "Use ## headings, bullet points, **bold** key terms, tables, and LaTeX math formulas ($...$ for inline, $$...$$ for block). "
        "Reference provided study notes when relevant."
    )

    if context and context.strip():
        user_message = f"Study Notes (reference):\n{context.strip()[:4000]}\n\nStudent Question: {prompt}"
    else:
        user_message = prompt

    for model_name in _get_groq_models():
        try:
            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": system_content},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.4,
                max_tokens=2500,
            )
            content = response.choices[0].message.content
            if content and content.strip():
                cleaned = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
                return cleaned or content.strip()
        except Exception as e:
            print(f"Groq model '{model_name}' attempt error: {e}")

    return "Error: All Groq models failed to respond."


# ---------------------------------------------------------------------------
# Document utilities (summary, quiz, OCR structuring)
# ---------------------------------------------------------------------------

def generate_document_summary(context: str, summary_type: str = "bullet") -> str:
    prompt = f"Generate a comprehensive {summary_type} study guide summary based on the uploaded classroom study material."
    return query_gemini_ai(prompt=prompt, context=context)


def generate_quiz_questions(
    notes_list: list,
    num_questions: int = 5,
    difficulty: int = 5,
    competency_percentage: int = 50,
    previous_quizzes_json: list = None
) -> list:
    """
    Generate high-quality assessment quiz questions using Groq AI.
    Guarantees EXACTLY `num_questions` by batching (max 5 per batch) to prevent token truncation.
    """
    target_count = max(1, min(30, int(num_questions)))

    # 1. Format Source Notes from List
    if isinstance(notes_list, str):
        notes_list = [notes_list]

    formatted_notes = []
    for idx, note_text in enumerate(notes_list or []):
        clean_note = note_text.strip() if isinstance(note_text, str) else str(note_text)
        if clean_note:
            formatted_notes.append(f"=== [SOURCE STUDY NOTE #{idx+1}] ===\n{clean_note[:6000]}")

    notes_context = "\n\n".join(formatted_notes) if formatted_notes else "General Classroom Material"

    # 2. Difficulty Level Guidance (1 to 10)
    diff_val = max(1, min(10, difficulty))
    if diff_val <= 3:
        diff_desc = f"Difficulty Level {diff_val}/10 (Foundational/Easy): Focus on core definitions, direct facts, basic recall, and straightforward terminology."
    elif diff_val <= 7:
        diff_desc = f"Difficulty Level {diff_val}/10 (Intermediate/Conceptual): Focus on conceptual understanding, comparisons, practical applications, and identifying relationships."
    else:
        diff_desc = f"Difficulty Level {diff_val}/10 (Advanced/Hard): Focus on complex analytical reasoning, multi-step problem solving, subtle edge cases, formula application, and tricky distractors."

    # 3. Competency Percentage Guidance
    comp_pct = max(0, min(100, competency_percentage or 50))
    comp_desc = (
        f"Competency-Based Target: {comp_pct}% of questions MUST be "
        f"higher-order Competency/Scenario/Case-Study based questions testing real-world applied problem-solving."
    )

    # 4. Previous Classroom Quizzes for Deduplication
    classroom_prev_questions = []
    if previous_quizzes_json and len(previous_quizzes_json) > 0:
        for pq in previous_quizzes_json[:25]:
            q_str = pq.get("question_text") or pq.get("question") or ""
            if q_str:
                classroom_prev_questions.append(q_str)

    system_prompt = (
        "You are an expert educational assessment generator. Your task is to analyze the provided list of study notes and generate a high-quality quiz.\n\n"
        f"ASSESSMENT CALIBRATION:\n"
        f"- {diff_desc}\n"
        f"- {comp_desc}\n"
        "- MATHEMATICAL & NUMERICAL FORMULAS (STRICT LATEX FORMATTING):\n"
        "  * ALWAYS wrap EVERY mathematical expression, formula, fraction, Greek letter, or numerical variable in standard markdown math delimiters:\n"
        "    - `$ ... $` for inline math (e.g. `$x(t) = A \\cos(\\omega t + \\phi)$`, `$E_p = \\frac{1}{2} k x^2$`, `$m = 0.20\\text{ kg}$`, `$\\omega_d = \\sqrt{\\omega_0^2 - (r/2m)^2}$`).\n"
        "    - `$$ ... $$` for standalone display equations.\n"
        "  * NEVER split a mathematical expression across multiple dollar signs (e.g. NEVER write `$E_p = \\frac{1}{2} m \\omega^2 A^2 \\cos^2$\\omega t` — ALWAYS write `$E_p = \\frac{1}{2} m \\omega^2 A^2 \\cos^2(\\omega t + \\phi)$`).\n"
        "  * ALWAYS write fractions using `\\frac{a}{b}` (e.g. `\\frac{1}{2}`, `\\frac{r}{2m}`) instead of ambiguous text.\n"
        "  * NEVER output naked parentheses without dollar signs like (m=0.20,\\text{kg}) or (\\omega_d) — ALWAYS write `$m = 0.20\\text{ kg}$` and `$\\omega_d$`.\n"
        "  * For any numerical calculation question, the 'explanation' field MUST provide a complete, step-by-step mathematical derivation showing: (1) Given values in `$ ... $`, (2) Formula in `$$ ... $$`, (3) Step-by-step substitution, (4) Final calculated answer with units.\n\n"
        "You must return ONLY a JSON object matching this exact structure, with NO surrounding markdown:\n\n"
        "{\n"
        '  "quiz_title": "string",\n'
        '  "questions": [\n'
        "    {\n"
        '      "question_number": 1,\n'
        '      "question_text": "string",\n'
        '      "options": {\n'
        '        "A": "string",\n'
        '        "B": "string",\n'
        '        "C": "string",\n'
        '        "D": "string"\n'
        "      },\n"
        '      "correct_option": "A",\n'
        '      "explanation": "Detailed step-by-step explanation with LaTeX formulas and derivations where applicable"\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Ensure all distractors (wrong answers) are plausible but definitively incorrect."
    )

    all_standardized_questions = []
    option_keys = ["A", "B", "C", "D"]
    batch_size = 3  # Chunk size to ensure no token truncation for high-density LaTeX formulas

    # 5. Batch Generation Loop (Generates in chunks of 3 questions to ensure EXACT count without token cutoffs)
    client = Groq(api_key=settings.GROQ_API_KEY.strip()) if settings.GROQ_API_KEY else None
    groq_models = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b"]

    max_attempts = 10
    attempts = 0

    while len(all_standardized_questions) < target_count and attempts < max_attempts:
        attempts += 1
        needed_in_batch = min(batch_size, target_count - len(all_standardized_questions))

        # Build exclusion list
        current_existing_texts = [
            q["question_text"] for q in all_standardized_questions
        ] + classroom_prev_questions

        prev_prompt = ""
        if current_existing_texts:
            prev_prompt = (
                "\n\n--- PREVIOUSLY GENERATED QUESTIONS (DO NOT REPEAT THESE) ---\n" +
                "\n".join([f"- {t}" for t in current_existing_texts[:25]])
            )

        user_prompt = (
            f"Generate EXACTLY {needed_in_batch} unique multiple-choice questions (Target Difficulty: {diff_val}/10 | Target Competency: {comp_pct}%).\n"
            f"You MUST return exactly {needed_in_batch} items in the 'questions' array.\n\n"
            f"--- SELECTED CLASSROOM STUDY NOTES ---\n"
            f"{notes_context[:8000]}"
            f"{prev_prompt}"
        )

        batch_json_str = ""

        # Try Groq models with json_object mode
        if client:
            for model_name in groq_models:
                try:
                    response = client.chat.completions.create(
                        model=model_name,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.3,
                        max_tokens=3000
                    )
                    content = response.choices[0].message.content
                    if content and content.strip():
                        batch_json_str = content.strip()
                        break
                except Exception as e:
                    print(f"Groq batch model '{model_name}' error: {repr(e)[:120]}")

        # Fallback to Sarvam if Groq failed
        if not batch_json_str and settings.SARVAM_API_KEY:
            try:
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {settings.SARVAM_API_KEY.strip()}",
                    "api-key": settings.SARVAM_API_KEY.strip(),
                }
                payload = {
                    "model": settings.SARVAM_MODEL or "sarvam-105b-conversations",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 2500,
                }
                res = requests.post("https://api.sarvam.ai/v1/chat/completions", json=payload, headers=headers, timeout=45)
                if res.status_code == 200:
                    batch_json_str = res.json()["choices"][0]["message"]["content"].strip()
            except Exception as e:
                print(f"Sarvam batch fallback error: {repr(e)[:120]}")

        # Parse batch response
        if batch_json_str:
            try:
                clean = batch_json_str.replace("```json", "").replace("```", "").strip()
                parsed = json.loads(clean)
                quiz_title = parsed.get("quiz_title", "Classroom Assessment Quiz") if isinstance(parsed, dict) else "Classroom Assessment Quiz"
                raw_questions = parsed.get("questions", []) if isinstance(parsed, dict) else (parsed if isinstance(parsed, list) else [])

                for q in raw_questions:
                    if len(all_standardized_questions) >= target_count:
                        break

                    q_num = len(all_standardized_questions) + 1
                    q_text = q.get("question_text") or q.get("question", f"Question {q_num}")
                    raw_opts = q.get("options", {})

                    if isinstance(raw_opts, dict):
                        opts_list = [raw_opts.get(k, "") for k in option_keys if k in raw_opts]
                        if not opts_list or len(opts_list) < 4:
                            opts_list = list(raw_opts.values())[:4]
                    elif isinstance(raw_opts, list):
                        opts_list = raw_opts[:4]
                    else:
                        opts_list = ["Option A", "Option B", "Option C", "Option D"]

                    # Pad to 4 options if fewer returned
                    while len(opts_list) < 4:
                        opts_list.append(f"Option {option_keys[len(opts_list)]}")

                    corr_opt = str(q.get("correct_option", "A")).strip().upper()
                    if corr_opt in option_keys:
                        correct_idx = option_keys.index(corr_opt)
                    elif "correct_index" in q:
                        correct_idx = int(q["correct_index"]) % 4
                    else:
                        correct_idx = 0

                    all_standardized_questions.append({
                        "id": q_num,
                        "question_number": q_num,
                        "question": q_text,
                        "question_text": q_text,
                        "options": opts_list,
                        "options_dict": {option_keys[i]: opt for i, opt in enumerate(opts_list[:4])},
                        "correct_option": option_keys[correct_idx],
                        "correct_index": correct_idx,
                        "explanation": q.get("explanation", "Refer to the classroom study notes for detailed formula derivation."),
                        "sub_topic": quiz_title
                    })
            except Exception as parse_err:
                print(f"Error parsing batch quiz JSON: {parse_err}")

    # Re-index all IDs sequentially 1..N
    for i, q in enumerate(all_standardized_questions):
        q["id"] = i + 1
        q["question_number"] = i + 1

    return all_standardized_questions


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
