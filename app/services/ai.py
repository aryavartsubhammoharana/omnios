import os
import re
import requests
import json
from google import genai
from groq import Groq
from app.config import settings


def is_valid_ai_text(text: str) -> bool:
    if not text or len(text.strip()) < 20:
        return False
    error_signatures = [
        "error querying", "sarvam api error", "gemini api error", "groq api error",
        "httpsconnectionpool", "read timed out", "quota exceeded",
        "rate limit", "429", "500 internal", "timeout",
    ]
    t_lower = text.lower()
    return not any(sig in t_lower for sig in error_signatures)


def _build_squeezed_tutor_prompt(prompt: str, context: str) -> str:
    c_clean = context.strip()[:2500] if context and context.strip() else ""
    if c_clean:
        return f"Role: OmniAI Academic Tutor.\nTask: Explain accurately based on Context using structured Markdown. MANDATORY: ALWAYS wrap EVERY math formula, variable, and equation in LaTeX delimiters like $...$ (e.g. $I_D = I_{{DSS}}\\left(1 - \\frac{{V_{{GS}}}}{{V_P}}\\right)^2$, $I_{{CEO}} = (\\beta + 1)I_{{CBO}}$).\nContext:\n{c_clean}\n\nQuestion: {prompt}"
    return f"Role: OmniAI Academic Tutor.\nTask: Explain clearly using Markdown. MANDATORY: ALWAYS wrap EVERY math formula, variable, and equation in LaTeX delimiters like $...$ (e.g. $I_D = I_{{DSS}}\\left(1 - \\frac{{V_{{GS}}}}{{V_P}}\\right)^2$).\nQuestion: {prompt}"


def query_gemini_ai(prompt: str, context: str = "") -> str:
    if not settings.GEMINI_API_KEY:
        return query_sarvam_ai(prompt, context)

    squeezed_prompt = _build_squeezed_tutor_prompt(prompt, context)

    for model_name in [settings.GEMINI_MODEL or "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]:
        try:
            client = genai.Client(api_key=settings.GEMINI_API_KEY.strip())
            response = client.models.generate_content(model=model_name, contents=squeezed_prompt)
            if response.text and response.text.strip():
                return response.text.strip()
        except Exception as e:
            print(f"Gemini model '{model_name}' failed: {e}")

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY.strip()}"
        res = requests.post(url, json={"contents": [{"parts": [{"text": squeezed_prompt}]}]}, timeout=45)
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
        safe_prompt = prompt.replace("%%", "marks").replace("%", " percent ").strip()
        c_clean = context.strip()[:1800] if context and context.strip() else ""

        user_msg = f"Context:\n{c_clean}\n\nQ: {safe_prompt}" if c_clean else safe_prompt

        payload = {
            "model": settings.SARVAM_MODEL or "sarvam-105b-conversations",
            "messages": [
                {"role": "system", "content": "Role: Academic Tutor. Answer concisely with Markdown and LaTeX $...$."},
                {"role": "user", "content": user_msg},
            ],
            "temperature": 0.4,
            "max_tokens": 1200,
        }
        res = requests.post("https://api.sarvam.ai/v1/chat/completions", json=payload, headers=headers, timeout=40)
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
        squeezed_prompt = _build_squeezed_tutor_prompt(prompt, context)
        models = [settings.GROQ_MODEL or "openai/gpt-oss-120b", "qwen/qwen3.8-27b", "qwen/qwen3.6-27b"]

        for model_name in models:
            try:
                response = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": "Role: OmniAI Tutor. Format concise Markdown with LaTeX $...$."},
                        {"role": "user", "content": squeezed_prompt}
                    ],
                    temperature=0.3,
                    max_tokens=1200
                )
                content = response.choices[0].message.content
                if content and content.strip():
                    return content.strip()
            except Exception as ex:
                print(f"Groq model {model_name} error: {ex}")
    except Exception as e:
        print(f"Groq client error: {e}")

    return "OmniAI is ready to assist. Please ask your question."


def generate_document_summary(content: str, filename: str = "Document") -> str:
    prompt = f"Provide a high-yield concise summary for '{filename}'. Use bullet points and LaTeX formulas."
    return query_gemini_ai(prompt=prompt, context=content[:4000])


def generate_fallback_quiz(notes_context: str, target_count: int = 5, diff_val: int = 5, comp_pct: int = 50) -> list:
    lines = [l.strip() for l in notes_context.split("\n") if len(l.strip()) > 15 and not l.startswith("---")]
    questions = []

    for idx in range(target_count):
        q_num = idx + 1
        ref_line = lines[idx % len(lines)] if lines else f"Core principle of topic {q_num}"
        concept = ref_line[:75].replace("*", "").replace("#", "")

        q_text = f"Which statement is correct regarding {concept}?"
        opts = [
            f"It states that {ref_line[:60]} is valid under standard conditions.",
            f"It is inversely proportional to the thermal gradient.",
            f"It causes exponential decay without energy conservation.",
            f"None of the above statements apply."
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
            "explanation": f"According to classroom notes: {ref_line[:100]}. Option A is correct.",
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

    raw_context = "\n\n".join(notes_list).strip() if notes_list else "General Academic Notes"
    squeezed_context = raw_context[:3500]

    system_prompt = (
        f"Role: Exam Generator. Task: Create {target_count} MCQs (Diff: {diff_val}/10, Comp: {comp_pct}%). "
        "Formulas: wrap in LaTeX $...$. Output ONLY raw JSON matching schema:\n"
        '{"questions":[{"q":"Question text","o":["Opt A","Opt B","Opt C","Opt D"],"a":"A","e":"1-line derivation with $formula$"}]}'
    )

    user_prompt = f"Study Notes:\n{squeezed_context}"

    json_str = ""

    # 1. Groq Fast Models (Primary)
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
                        temperature=0.2,
                        max_tokens=2000
                    )
                    content = response.choices[0].message.content
                    if content and "questions" in content:
                        json_str = content.strip()
                        break
                except Exception as ex:
                    print(f"Groq model {model_name} error: {ex}")
        except Exception as e:
            print(f"Groq quiz client error: {e}")

    # 2. Gemini 2.5 Flash (Secondary - High TPM / Large Context)
    if not json_str and settings.GEMINI_API_KEY:
        try:
            client = genai.Client(api_key=settings.GEMINI_API_KEY.strip())
            gemini_prompt = f"{system_prompt}\n\n{user_prompt}"
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL or "gemini-2.5-flash",
                contents=gemini_prompt
            )
            if response.text and "questions" in response.text:
                json_str = response.text.strip()
        except Exception as ex:
            print(f"Gemini quiz fallback error: {ex}")

    # 3. Sarvam AI (Tertiary)
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
                    {"role": "user", "content": user_prompt[:2500]},
                ],
                "temperature": 0.2,
                "max_tokens": 1800,
            }
            res = requests.post("https://api.sarvam.ai/v1/chat/completions", json=payload, headers=headers, timeout=35)
            if res.status_code == 200:
                json_str = res.json()["choices"][0]["message"]["content"].strip()
        except Exception as ex:
            print(f"Sarvam quiz fallback error: {ex}")

    # Parse squeezed schema (q, o, a, e) or standard schema
    questions_list = []
    option_keys = ["A", "B", "C", "D"]

    if json_str:
        try:
            clean = json_str.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(clean)
            raw_questions = parsed.get("questions", []) if isinstance(parsed, dict) else (parsed if isinstance(parsed, list) else [])

            for q in raw_questions:
                q_num = len(questions_list) + 1
                q_text = q.get("q") or q.get("question_text") or q.get("question", f"Question {q_num}")

                raw_opts = q.get("o") or q.get("options", {})
                if isinstance(raw_opts, list):
                    opts_list = raw_opts[:4]
                elif isinstance(raw_opts, dict):
                    opts_list = [raw_opts.get(k, "") for k in option_keys if k in raw_opts]
                    if not opts_list or len(opts_list) < 4:
                        opts_list = list(raw_opts.values())[:4]
                else:
                    opts_list = ["Option A", "Option B", "Option C", "Option D"]

                while len(opts_list) < 4:
                    opts_list.append(f"Option {option_keys[len(opts_list)]}")

                corr_opt = str(q.get("a") or q.get("correct_option", "A")).strip().upper()
                correct_idx = option_keys.index(corr_opt) if corr_opt in option_keys else 0

                explanation = q.get("e") or q.get("explanation", "Refer to the classroom notes for the complete derivation.")

                questions_list.append({
                    "id": q_num,
                    "question_number": q_num,
                    "question": q_text,
                    "question_text": q_text,
                    "options": opts_list,
                    "options_dict": {option_keys[i]: opt for i, opt in enumerate(opts_list[:4])},
                    "correct_option": option_keys[correct_idx],
                    "correct_index": correct_idx,
                    "explanation": explanation,
                    "sub_topic": "Classroom Quiz"
                })

                if len(questions_list) >= target_count:
                    break
        except Exception as err:
            print(f"Error parsing AI quiz JSON: {err}")

    # Fallback to guaranteed generator if fewer items returned
    if len(questions_list) < target_count:
        needed = target_count - len(questions_list)
        fallback_qs = generate_fallback_quiz(squeezed_context, target_count=needed, diff_val=diff_val, comp_pct=comp_pct)
        for fq in fallback_qs:
            q_num = len(questions_list) + 1
            fq["id"] = q_num
            fq["question_number"] = q_num
            questions_list.append(fq)

    return questions_list[:target_count]


def structure_ocr_text_with_sarvam(raw_ocr_text: str) -> str:
    from app.services.extractor import format_extracted_text
    return format_extracted_text(raw_ocr_text)
