import os
import re
import requests
import json
from google import genai
from groq import Groq
from app.config import settings


def is_valid_ai_text(text: str) -> bool:
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
    if context and context.strip():
        return (
            f"You are NoteAI, an intelligent, helpful, and friendly academic tutor.\n\n"
            f"--- RELEVANT CLASSROOM STUDY MATERIAL ---\n"
            f"{context[:12000]}\n"
            f"-----------------------------------------\n\n"
            f"STUDENT QUESTION / PROMPT: {prompt}\n\n"
            f"INSTRUCTIONS:\n"
            f"1. Use the provided classroom material as your primary reference.\n"
            f"2. Use '##' for major sections, '###' for sub-sections, numbered lists for steps, and bold key terms.\n"
            f"3. Format mathematical formulas with `$formula$` for inline and `$$formula$$` for display.\n"
        )
    return (
        f"You are NoteAI, an intelligent academic tutor.\n\n"
        f"STUDENT QUESTION / PROMPT: {prompt}\n\n"
        f"Provide a clear, comprehensive answer with clean markdown formatting and LaTeX formulas."
    )


def query_gemini_ai(prompt: str, context: str = "") -> str:
    if not settings.GEMINI_API_KEY:
        return query_sarvam_ai(prompt, context)

    full_prompt = _build_tutor_prompt(prompt, context)

    for model_name in [settings.GEMINI_MODEL or "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]:
        try:
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            response = client.models.generate_content(model=model_name, contents=full_prompt)
            if response.text and response.text.strip():
                return response.text.strip()
        except Exception as e:
            print(f"Gemini model '{model_name}' failed: {e}")

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
        res = requests.post(url, json={"contents": [{"parts": [{"text": full_prompt}]}]}, timeout=60)
        if res.status_code == 200:
            return res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception as ex:
        print(f"Gemini REST error: {ex}")

    sarvam_res = query_sarvam_ai(prompt=prompt, context=context)
    if is_valid_ai_text(sarvam_res):
        return sarvam_res

    return query_groq_ai(prompt=prompt, context=context)


def query_sarvam_ai(prompt: str, context: str = "") -> str:
    if not settings.SARVAM_API_KEY:
        return query_groq_ai(prompt, context)

    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.SARVAM_API_KEY.strip()}",
            "api-key": settings.SARVAM_API_KEY.strip(),
        }
        system_content = (
            "You are NoteAI, a helpful academic tutor. Answer student questions clearly and accurately. "
            "Use Markdown formatting with LaTeX $...$ for formulas."
        )

        safe_prompt = prompt.replace("%%", "marks").replace("%", " percent ").strip()

        if context and context.strip():
            user_message = f"Study Notes:\n{context.strip()[:3000]}\n\nStudent Question: {safe_prompt}"
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
        res = requests.post("https://api.sarvam.ai/v1/chat/completions", json=payload, headers=headers, timeout=45)
        if res.status_code == 200:
            return res.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"Sarvam error: {e}")

    return query_groq_ai(prompt, context)


def query_groq_ai(prompt: str, context: str = "") -> str:
    if not settings.GROQ_API_KEY:
        return "Groq API key not configured."

    try:
        client = Groq(api_key=settings.GROQ_API_KEY.strip())
        full_prompt = _build_tutor_prompt(prompt, context)
        models = [settings.GROQ_MODEL or "openai/gpt-oss-120b", "qwen/qwen3.8-27b", "qwen/qwen3.6-27b"]

        for model_name in models:
            try:
                response = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": "You are NoteAI, an intelligent tutor. Format formulas with LaTeX $...$."},
                        {"role": "user", "content": full_prompt}
                    ],
                    temperature=0.4,
                    max_tokens=1500
                )
                content = response.choices[0].message.content
                if content and content.strip():
                    return content.strip()
            except Exception as ex:
                print(f"Groq model {model_name} error: {ex}")
    except Exception as e:
        print(f"Groq client error: {e}")

    return "NoteAI is currently reviewing the study notes. Please try again in a moment."


def generate_document_summary(content: str, filename: str = "Document") -> str:
    prompt = f"Provide a comprehensive, high-yield academic summary for the document '{filename}'. Use bullet points, bold key terms, and LaTeX math formulas where appropriate."
    return query_gemini_ai(prompt=prompt, context=content[:8000])


def generate_fallback_quiz(notes_context: str, target_count: int = 5, diff_val: int = 5, comp_pct: int = 50) -> list:
    lines = [l.strip() for l in notes_context.split("\n") if len(l.strip()) > 20 and not l.startswith("---")]
    questions = []

    for idx in range(target_count):
        q_num = idx + 1
        ref_line = lines[idx % len(lines)] if lines else f"Core principle of topic {q_num}"
        concept = ref_line[:80].replace("*", "").replace("#", "")

        q_text = f"Which of the following statements correctly describes {concept}?"
        opts = [
            f"It states that {ref_line[:65]} holds true under standard conditions.",
            f"It is inversely proportional to the applied kinetic gradient.",
            f"It causes a total decay of energy without conservation.",
            f"None of the above statements are applicable."
        ]

        questions.append({
            "id": q_num,
            "question_number": q_num,
            "question": q_text,
            "question_text": q_text,
            "options": opts,
            "options_dict": {"A": opts[0], "B": opts[1], "C": opts[2], "D": opts[3]},
            "correct_option": "A",
            "correct_index": 0,
            "explanation": f"Based on the classroom notes: {ref_line[:120]}. Option A correctly represents this concept.",
            "sub_topic": "Classroom Assessment"
        })

    return questions


def generate_quiz_questions(
    notes_list: list,
    num_questions: int = 5,
    difficulty: int = 5,
    competency_percentage: int = 50,
    previous_quizzes_json: list = None
) -> list:
    target_count = max(1, min(20, num_questions))
    diff_val = max(1, min(10, difficulty))
    comp_pct = max(0, min(100, competency_percentage or 50))

    notes_context = "\n\n".join(notes_list).strip() if notes_list else "General Academic Notes"

    system_prompt = (
        "You are an expert assessment generator. Create high-yield Multiple Choice Questions based on the study notes.\n"
        f"Difficulty: {diff_val}/10. Competency-Based: {comp_pct}%.\n"
        "STRICT LATEX FORMATTING: Wrap EVERY mathematical formula, variable, and fraction in `$ ... $` (inline) or `$$ ... $$` (display).\n"
        "Return ONLY a JSON object with this exact schema and NO surrounding markdown:\n"
        "{\n"
        '  "quiz_title": "Classroom Assessment",\n'
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
        '      "explanation": "Step-by-step derivation and explanation with LaTeX formulas"\n'
        "    }\n"
        "  ]\n"
        "}"
    )

    user_prompt = (
        f"Generate EXACTLY {target_count} unique multiple-choice questions from these study notes:\n\n"
        f"{notes_context[:10000]}"
    )

    json_str = ""

    # 1. Try Groq (Primary)
    if settings.GROQ_API_KEY:
        try:
            client = Groq(api_key=settings.GROQ_API_KEY.strip())
            models = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "qwen/qwen3.6-27b"]
            for model_name in models:
                try:
                    response = client.chat.completions.create(
                        model=model_name,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.3,
                        max_tokens=4000
                    )
                    content = response.choices[0].message.content
                    if content and "questions" in content:
                        json_str = content.strip()
                        break
                except Exception as ex:
                    print(f"Groq quiz model {model_name} error: {ex}")
        except Exception as e:
            print(f"Groq quiz client error: {e}")

    # 2. Try Gemini (Secondary)
    if not json_str and settings.GEMINI_API_KEY:
        try:
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            gemini_prompt = f"{system_prompt}\n\n{user_prompt}"
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL or "gemini-2.5-flash",
                contents=gemini_prompt
            )
            if response.text and "questions" in response.text:
                json_str = response.text.strip()
        except Exception as ex:
            print(f"Gemini quiz fallback error: {ex}")

    # 3. Try Sarvam (Tertiary)
    if not json_str and settings.SARVAM_API_KEY:
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
                    {"role": "user", "content": user_prompt[:4000]},
                ],
                "temperature": 0.3,
                "max_tokens": 3000,
            }
            res = requests.post("https://api.sarvam.ai/v1/chat/completions", json=payload, headers=headers, timeout=45)
            if res.status_code == 200:
                json_str = res.json()["choices"][0]["message"]["content"].strip()
        except Exception as ex:
            print(f"Sarvam quiz fallback error: {ex}")

    # Parse and Standardize
    questions_list = []
    option_keys = ["A", "B", "C", "D"]

    if json_str:
        try:
            clean = json_str.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(clean)
            raw_questions = parsed.get("questions", []) if isinstance(parsed, dict) else (parsed if isinstance(parsed, list) else [])

            for q in raw_questions:
                q_num = len(questions_list) + 1
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

                while len(opts_list) < 4:
                    opts_list.append(f"Option {option_keys[len(opts_list)]}")

                corr_opt = str(q.get("correct_option", "A")).strip().upper()
                correct_idx = option_keys.index(corr_opt) if corr_opt in option_keys else 0

                questions_list.append({
                    "id": q_num,
                    "question_number": q_num,
                    "question": q_text,
                    "question_text": q_text,
                    "options": opts_list,
                    "options_dict": {option_keys[i]: opt for i, opt in enumerate(opts_list[:4])},
                    "correct_option": option_keys[correct_idx],
                    "correct_index": correct_idx,
                    "explanation": q.get("explanation", "Refer to the classroom notes for the complete derivation and explanation."),
                    "sub_topic": "Classroom Quiz"
                })

                if len(questions_list) >= target_count:
                    break
        except Exception as err:
            print(f"Error parsing AI quiz JSON: {err}")

    # Guaranteed Fallback if LLM generated fewer questions
    if len(questions_list) < target_count:
        needed = target_count - len(questions_list)
        fallback_qs = generate_fallback_quiz(notes_context, target_count=needed, diff_val=diff_val, comp_pct=comp_pct)
        for fq in fallback_qs:
            q_num = len(questions_list) + 1
            fq["id"] = q_num
            fq["question_number"] = q_num
            questions_list.append(fq)

    return questions_list[:target_count]


def structure_ocr_text_with_sarvam(raw_ocr_text: str) -> str:
    from app.services.extractor import format_extracted_text
    return format_extracted_text(raw_ocr_text)
