import re
import json
import random
from typing import List, Optional
from datetime import datetime, date
import requests
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from google import genai
from groq import Groq

from app.database import get_db
from app.config import settings
from app.models.user import User
from app.models.classroom import Classroom, Enrollment
from app.models.file import DocumentFile
from app.models.quiz import StudentDailyQuiz
from app.utils.deps import get_current_user
from app.utils.time_utils import get_ist_now
from app.routes.analytics import record_learning_activity
from app.services.curriculum_registry import get_active_term_chapters, build_advanced_diagnostic_prompt
from app.services.youtube_service import get_curated_weak_topic_videos

router = APIRouter(prefix="/api/student", tags=["Student Portal"])


class DailyQuizSubmission(BaseModel):
    quiz_id: int
    user_answers: dict


class VideoProgressLog(BaseModel):
    video_id: str
    video_title: str
    subject: str
    topic: str
    watch_seconds: int = 30


def get_daily_subject_schedule(class_name: str, ist_date) -> dict:
    weekday = ist_date.weekday()
    clean_class = (class_name or "").lower()

    if "11" in clean_class or "12" in clean_class:
        schedule = {
            0: {
                "subject": "Physics",
                "focus": "Core Laws, Mechanics, Electromagnetism & Derivations",
                "q_count": 20,
                "lang": "en",
                "keywords": ["physics", "mechanics", "optics", "thermodynamics"],
                "instruction": "Generate 20 rigorous conceptual, numerical, and derivation-based Physics multiple choice questions."
            },
            1: {
                "subject": "Chemistry",
                "focus": "Organic Reaction Mechanisms, Chemical Bonding & Equilibrium",
                "q_count": 20,
                "lang": "en",
                "keywords": ["chemistry", "organic", "inorganic", "bonding", "equilibrium"],
                "instruction": "Generate 20 conceptual and numerical Chemistry MCQs testing reactions and concepts."
            },
            2: {
                "subject": "Mathematics / Biology",
                "focus": "Calculus, Vectors, Probability, Genetics & Cell Physiology",
                "q_count": 20,
                "lang": "en",
                "keywords": ["math", "mathematics", "calculus", "biology", "genetics"],
                "instruction": "Generate 20 problem-solving MCQs with LaTeX equations ($...$) and step-by-step mathematical reasoning."
            },
            3: {
                "subject": "English Core",
                "focus": "Advanced Reading Comprehension, Literary Devices & Applied Grammar",
                "q_count": 20,
                "lang": "en",
                "keywords": ["english", "grammar", "comprehension", "literature"],
                "instruction": "Provide a 150-word Unseen Passage followed by 8 Reading Comprehension MCQs and 12 English Applied Grammar & Vocabulary MCQs."
            },
            4: {
                "subject": "Computer Science / Elective",
                "focus": "Algorithms, Python Data Structures, SQL, Networks & Computational Thinking",
                "q_count": 20,
                "lang": "en",
                "keywords": ["computer", "python", "code", "cs", "algorithm", "sql"],
                "instruction": "Generate 20 algorithmic, coding, and conceptual MCQs."
            },
            5: {
                "subject": "JEE / NEET Mixed Diagnostic",
                "focus": "High-Yield Multi-Concept Practice Problems across Physics, Chemistry, Math & Biology",
                "q_count": 20,
                "lang": "en",
                "keywords": ["physics", "chemistry", "math", "biology"],
                "instruction": "Generate 20 high-yield multi-disciplinary diagnostic MCQs for entrance revision."
            },
            6: {
                "subject": "Weekly Comprehensive Mock Assessment",
                "focus": "Full Syllabus Cross-Topic Revision",
                "q_count": 20,
                "lang": "en",
                "keywords": [],
                "instruction": "Generate 20 balanced cross-subject diagnostic MCQs covering this week's topics."
            }
        }
    else:
        schedule = {
            0: {
                "subject": "Science",
                "focus": "Physics, Chemistry & Biology (Light, Electricity, Life Processes, Chemical Reactions, Acid-Bases)",
                "q_count": 20,
                "lang": "en",
                "keywords": ["science", "physics", "chemistry", "biology", "life processes", "light", "electricity"],
                "instruction": "Generate 20 high-quality conceptual and experimental Science MCQs with clear explanations."
            },
            1: {
                "subject": "Social Science (SST)",
                "focus": "History (Nationalism), Geography (Resources), Civics (Power Sharing) & Economics (Development)",
                "q_count": 20,
                "lang": "en",
                "keywords": ["sst", "social science", "history", "geography", "civics", "economics"],
                "instruction": "Generate 20 analytical Social Science (SST) MCQs testing conceptual understanding, historical context, and economics."
            },
            2: {
                "subject": "Mathematics (Numerical)",
                "focus": "Step-by-step Numericals, Quadratic Equations, Trigonometry, Geometry, Surface Areas & Arithmetic Progressions",
                "q_count": 20,
                "lang": "en",
                "keywords": ["math", "mathematics", "trigonometry", "algebra", "geometry", "equations"],
                "instruction": "Generate 20 numerical problem-solving Math questions with LaTeX formatting ($...$) and detailed calculation steps in explanations."
            },
            3: {
                "subject": "English",
                "focus": "Unseen Reading Comprehension Passage + Grammar & Vocabulary",
                "q_count": 20,
                "lang": "en",
                "keywords": ["english", "grammar", "comprehension", "literature"],
                "instruction": "Include a short 150-word Unseen Passage at the start, followed by 8 Reading Comprehension MCQs and 12 English Grammar MCQs (Tenses, Active/Passive, Modals, Subject-Verb Agreement)."
            },
            4: {
                "subject": "Hindi (हिंदी)",
                "focus": "अपठित गद्यांश (Unseen Passage) + हिंदी व्याकरण (समास, संधि, पद-परिचय, मुहावरे, वाक्य शोधन)",
                "q_count": 20,
                "lang": "hi",
                "keywords": ["hindi", "हिंदी", "व्याकरण", "गद्यांश"],
                "instruction": "CRITICAL: The entire output MUST be strictly in Hindi (Devanagari script हिंदी). Provide a 120-word रोचक अपठित गद्यांश, followed by 8 गद्यांश आधारित MCQs और 12 हिंदी व्याकरण MCQs (समास, संधि, पद परिचय, मुहावरे)."
            },
            5: {
                "subject": "Math & Science Revision",
                "focus": "STEM Conceptual & Numerical Problem Solving",
                "q_count": 20,
                "lang": "en",
                "keywords": ["science", "math"],
                "instruction": "Generate 20 mixed STEM numerical and conceptual questions reviewing this week's key topics."
            },
            6: {
                "subject": "Weekly Comprehensive Mock Assessment",
                "focus": "All-Round Subject Assessment (Science, SST, Math, English, Hindi)",
                "q_count": 20,
                "lang": "en",
                "keywords": [],
                "instruction": "Generate a balanced 20-question comprehensive diagnostic test covering Science, SST, Math, English, and Hindi."
            }
        }

    return schedule.get(weekday, schedule[0])


def generate_fallback_20_questions(subject: str, target_class: str, lang: str = "en") -> list:
    """Generates 20 rich, diverse curriculum-aligned fallback questions when external AI APIs are offline."""
    questions = []
    
    if lang == "hi":
        hindi_templates = [
            ("संधि के मुख्य रूप से कितने भेद होते हैं?", ["तीन (3)", "चार (4)", "दो (2)", "पाँच (5)"], 0, "हिंदी व्याकरण - संधि", "संधि के मुख्य 3 भेद होते हैं: स्वर, व्यंजन और विसर्ग संधि।"),
            ("'दशानन' शब्द में कौन सा समास है?", ["बहुव्रीहि समास", "द्विगु समास", "तत्पुरुष समास", "कर्मधारय समास"], 0, "हिंदी व्याकरण - समास", "दशानन में तीसरा पद (रावण) प्रधान होने से बहुव्रीहि समास है।"),
            ("'सूर्योदय' का सही संधि-विच्छेद क्या है?", ["सूर्य + उदय", "सूर्यो + दय", "सूर्य + दय", "सूर + उदय"], 0, "हिंदी व्याकरण - संधि", "सूर्य + उदय = सूर्योदय (गुण स्वर संधि)।"),
            ("'यथाशक्ति' में कौन सा समास है?", ["अव्ययीभाव समास", "तत्पुरुष समास", "द्वंद्व समास", "कर्मधारय समास"], 0, "हिंदी व्याकरण - समास", "पहला पद अव्यय होने के कारण 'यथाशक्ति' अव्ययीभाव समास है।"),
            ("'आँखों का तारा होना' मुहावरे का सही अर्थ क्या है?", ["अत्यधिक प्रिय होना", "बहुत दूर होना", "नेत्र रोग होना", "अंधा होना"], 0, "हिंदी व्याकरण - मुहावरे", "'आँखों का तारा' का अर्थ अत्यंत प्रिय होना है।"),
            ("वाक्य में संज्ञा या सर्वनाम की विशेषता बताने वाले शब्द को क्या कहते हैं?", ["विशेषण", "क्रिया", "अव्यय", "क्रिया-विशेषण"], 0, "हिंदी व्याकरण - पद परिचय", "संज्ञा या सर्वनाम की विशेषता बताने वाले शब्द 'विशेषण' कहलाते हैं।"),
            ("'पवन' का सही संधि विच्छेद क्या है?", ["पो + अन", "पौ + अन", "प + वन", "पा + वन"], 0, "हिंदी व्याकरण - संधि", "पो + अन = पवन (अयादि स्वर संधि)।"),
            ("'नीलकंठ' में कौन सा समास है?", ["बहुव्रीहि समास", "द्विगु समास", "अव्ययीभाव समास", "द्वंद्व समास"], 0, "हिंदी व्याकरण - समास", "नीला है कंठ जिसका (भगवान शिव) - बहुव्रीहि समास।"),
            ("'अनुराग' का विलोम शब्द क्या है?", ["विराग", "राग", "प्रेम", "द्वेष"], 0, "हिंदी व्याकरण - विलोम", "अनुराग का विलोम शब्द 'विराग' होता है।"),
            ("'कमल' का पर्यायवाची शब्द निम्न में से कौन सा है?", ["जलज", "वारिद", "जलद", "अंबुद"], 0, "हिंदी व्याकरण - पर्यायवाची", "जलज, पंकज, नीरज कमल के पर्यायवाची हैं।"),
            ("'उज्ज्वल' की सही वर्तनी कौन सी है?", ["उज्ज्वल", "उज्वल", "उज्जवल", "ऊज्वल"], 0, "हिंदी व्याकरण - वर्तनी शोधन", "उज्ज्वल (उत् + ज्वल) शुद्ध रूप है।"),
            ("क्रिया के मूल रूप को क्या कहते हैं?", ["धातु", "पद", "उपसर्ग", "प्रत्यय"], 0, "हिंदी व्याकरण - क्रिया", "क्रिया के मूल रूप को 'धातु' (जैसे: पढ़, लिख) कहते हैं।"),
            ("'प्रत्येक' का सही संधि विच्छेद क्या है?", ["प्रति + एक", "प्र + प्रत्येक", "प्रत्य + एक", "प्रति + ऐक"], 0, "हिंदी व्याकरण - संधि", "प्रति + एक = प्रत्येक (यण स्वर संधि)।"),
            ("'अंगूठा दिखाना' मुहावरे का क्या अर्थ है?", ["साफ़ मना करना", "मदद करना", "अंगूठा काटना", "प्रशंसा करना"], 0, "हिंदी व्याकरण - मुहावरे", "ऐन वक्त पर मना कर देना 'अंगूठा दिखाना' कहलाता है।"),
            ("'चतुर्भुज' में कौन सा समास है?", ["द्विगु / बहुव्रीहि", "तत्पुरुष", "कर्मधारय", "अव्ययीभाव"], 0, "हिंदी व्याकरण - समास", "चार भुजाओं का समूह (द्विगु) अथवा श्री विष्णु (बहुव्रीहि)।"),
            ("रचना के आधार पर वाक्य के कितने भेद होते हैं?", ["तीन (3)", "दो (2)", "चार (4)", "आठ (8)"], 0, "हिंदी व्याकरण - वाक्य भेद", "रचना के आधार पर 3 भेद हैं: सरल, संयुक्त, और मिश्र वाक्य।"),
            ("'अंधे की लाठी' का अर्थ क्या है?", ["एकमात्र सहारा", "अंधे की मदद", "कमजोर लाठी", "छड़ी"], 0, "हिंदी व्याकरण - मुहावरे", "'अंधे की लाठी' का अर्थ 'एकमात्र सहारा' होना है।"),
            ("'स्वागत' का सही संधि विच्छेद क्या है?", ["सु + आगत", "स्वा + गत", "स्व + आगत", "सु + गत"], 0, "हिंदी व्याकरण - संधि", "सु + आगत = स्वागत (यण स्वर संधि)।"),
            ("'माता-पिता' में कौन सा समास है?", ["द्वंद्व समास", "द्विगु समास", "कर्मधारय समास", "तत्पुरुष समास"], 0, "हिंदी व्याकरण - समास", "दोनों पद प्रधान होने के कारण द्वंद्व समास (माता और पिता) है।"),
            ("जो कभी बूढ़ा न हो - वाक्यांश के लिए एक शब्द क्या होगा?", ["अजर", "अमर", "अविनाशी", "अनंत"], 0, "हिंदी व्याकरण - अनेक शब्दों के लिए एक शब्द", "जो कभी बूढ़ा न हो उसे 'अजर' और जो कभी न मरे उसे 'अमर' कहते हैं।")
        ]
        for idx, item in enumerate(hindi_templates):
            questions.append({
                "id": idx + 1,
                "question": item[0],
                "options": item[1],
                "correct_index": item[2],
                "topic": item[3],
                "explanation": item[4]
            })
        return questions

    # English / STEM Comprehensive 20-Questions Pool
    templates = [
        (f"What is the fundamental SI unit used to quantify core dynamic measurements in {subject}?", ["Newton ($N$) / Joule ($J$)", "Erg / Dyne", "Calorie", "Foot-Pound"], 0, f"{subject} - Fundamentals", "The SI unit framework standardizes core dynamic metric measurements."),
        (f"In {subject}, according to conservation principles, what happens in an isolated closed system?", ["Total energy and momentum remain constant", "Energy degrades to zero instantaneously", "Mass converts completely to heat with no equilibrium", "None of the above"], 0, f"{subject} - Conservation Laws", "In isolated systems, total energy and conserved quantities remain invariant over time."),
        (f"Which mathematical formula represents the primary rate of change relation in {subject}?", ["$\\frac{dy}{dx} = \\lim_{\\Delta x \\to 0} \\frac{f(x+\\Delta x) - f(x)}{\\Delta x}$", "$y = mx^3 + c$", "$\\int f(x)dx = 0$", "None of these"], 0, f"{subject} - Rate of Change", "First-order derivatives formulate rates of change in dynamical physical systems."),
        (f"How is equilibrium defined under standard conditions in {subject}?", ["Net forces and torque summing to zero ($\\sum \\vec{F} = 0$)", "Acceleration reaching infinity", "Velocity being constantly variable", "Uncontrolled state fluctuations"], 0, f"{subject} - Equilibrium", "Mechanical and thermodynamic equilibrium require net external forces and gradients to balance."),
        (f"Which law governs inverse square interactions in {subject}?", ["Field intensity $I \\propto \\frac{1}{r^2}$", "$I \\propto r^2$", "$I \\propto \\sqrt{r}$", "$I \\propto \\ln(r)$"], 0, f"{subject} - Field Theory", "Radiative flux and gravitational/electrostatic forces propagate inversely with the square of distance."),
        (f"What role does a catalyst or catalytic agent play in {subject} processes?", ["Lowers activation energy without altering net enthalpy $\\Delta H$", "Increases activation energy to halt reactions", "Shifts thermodynamic equilibrium constant permanently", "Consumes itself completely"], 0, f"{subject} - Reaction Kinetics", "Catalysts lower the transition state activation energy barrier without being consumed."),
        (f"Which property characterizes wave propagation speed ($v = \\nu \\lambda$) in {subject}?", ["Product of frequency ($\\nu$) and wavelength ($\\lambda$)", "Ratio of amplitude to frequency", "Difference of wave vectors", "None of these"], 0, f"{subject} - Wave Mechanics", "Wave velocity equals frequency multiplied by spatial wavelength ($v = f \\lambda$)."),
        (f"What does the First Law of Thermodynamics state ($\\Delta U = Q - W$)?", ["Internal energy change equals heat added minus work done", "Heat flows spontaneously from cold to hot", "Entropy of isolated system decreases to zero", "Total energy can be created in isolated processes"], 0, f"{subject} - Thermodynamics", "First law expresses energy conservation: $\\Delta U = Q - W$."),
        (f"Which method is applied to determine roots of quadratic formulations ($ax^2 + bx + c = 0$)?", ["$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$", "$x = \\frac{-b \\pm \\sqrt{ac}}{2a}$", "$x = -b \\pm 2ac$", "None of these"], 0, f"{subject} - Quadratic Equations", "Standard quadratic formula yields analytic roots for second-degree polynomial systems."),
        (f"What is the significance of the discriminant $D = b^2 - 4ac > 0$ in {subject}?", ["Two distinct real roots exist", "No real solutions exist", "Two equal imaginary roots", "Indeterminate form"], 0, f"{subject} - Algebraic Analysis", "A positive discriminant guarantees two distinct real solutions on the Cartesian plane."),
        (f"In optics, Snell's Law of Refraction is formulated as:", ["$n_1 \\sin(\\theta_1) = n_2 \\sin(\\theta_2)$", "$n_1 \\cos(\\theta_1) = n_2 \\cos(\\theta_2)$", "$n_1 + \\theta_1 = n_2 + \\theta_2$", "$\\frac{n_1}{\\theta_1} = \\frac{n_2}{\\theta_2}$"], 0, f"{subject} - Optics & Waves", "Snell's law describes the exact angular bending of wavefronts across dielectric boundaries."),
        (f"What does Ohm's law state for linear isotropic conductors ($V = IR$)?", ["Potential difference is directly proportional to electric current at constant temperature", "Current is inversely proportional to potential", "Resistance decreases linearly with potential", "None of the above"], 0, f"{subject} - Electrodynamics", "Ohm's law relates voltage $V$ directly to current $I$ via resistance $R$."),
        (f"Which cellular organelle is responsible for ATP synthesis via oxidative phosphorylation?", ["Mitochondria", "Ribosome", "Golgi Apparatus", "Lysosome"], 0, f"{subject} - Cell Biology & Energy", "Mitochondria produce cellular adenosine triphosphate (ATP) through respiration cycles."),
        (f"In Mendelian genetics, what is the phenotypic ratio in a monohybrid $F_2$ cross?", ["$3 : 1$ (Dominant : Recessive)", "$1 : 2 : 1$", "$9 : 3 : 3 : 1$", "$1 : 1$"], 0, f"{subject} - Genetics & Inheritance", "Monohybrid heterozygous selfing ($Tt \\times Tt$) yields a $3:1$ phenotypic distribution."),
        (f"Which principle governs fluid buoyancy and upthrust in {subject}?", ["Archimedes' Principle ($F_b = \\rho V g$)", "Bernoulli's Equation", "Pascal's Law", "Hooke's Law"], 0, f"{subject} - Fluid Dynamics", "Archimedes' principle states buoyant force equals the weight of displaced fluid volume."),
        (f"What is the acceleration due to gravity near Earth's surface ($g$)?", ["$9.8\\text{ m/s}^2$", "$6.67 \\times 10^{-11}\\text{ m/s}^2$", "$3 \\times 10^8\\text{ m/s}^2$", "$1.6 \\times 10^{-19}\\text{ m/s}^2$"], 0, f"{subject} - Gravitation", "Standard terrestrial gravitational acceleration equals approximately $9.8\\text{ m/s}^2$."),
        (f"What is the derivative of $\\sin(x)$ with respect to $x$?", ["$\\cos(x)$", "$-\\cos(x)$", "$\\tan(x)$", "$\\sec^2(x)$"], 0, f"{subject} - Differential Calculus", "The derivative of the sine trigonometric function is the cosine function."),
        (f"Which gas law relates pressure and volume inversely at constant temperature ($P_1 V_1 = P_2 V_2$)?", ["Boyle's Law", "Charles's Law", "Avogadro's Law", "Gay-Lussac's Law"], 0, f"{subject} - Kinetic Theory of Gases", "Boyle's law establishes $P \\propto \\frac{1}{V}$ for ideal gases under isothermal conditions."),
        (f"In computer algorithms, what is the average time complexity of Binary Search?", ["$O(\\log n)$", "$O(n)$", "$O(n^2)$", "$O(1)$"], 0, f"{subject} - Algorithms & Computation", "Binary search halves the search space each iteration yielding logarithmic $O(\\log n)$ complexity."),
        (f"What is the primary role of chlorophyll in photosynthetic organisms?", ["Absorbs photon energy to drive light-dependent water photolysis", "Transports sucrose across sieve tubes", "Stores nitrogenous reserves", "Regulates transpiration exclusively"], 0, f"{subject} - Bioenergetics", "Chlorophyll pigments absorb visible light wavelengths to initiate charge separation in photosystems.")
    ]

    for idx, item in enumerate(templates):
        questions.append({
            "id": idx + 1,
            "question": item[0],
            "options": item[1],
            "correct_index": item[2],
            "topic": item[3],
            "explanation": item[4]
        })
    return questions[:20]


def query_llm_for_daily_quiz(prompt: str, subject: str, target_class: str, q_count: int = 20, lang: str = "en") -> list:
    """Executes high-capacity LLM completions across Groq, Gemini, and Sarvam with large token outputs."""
    raw_ai_text = ""

    # 1. Primary: Groq High-Speed Fast Model with 4096 tokens
    if settings.GROQ_API_KEY:
        try:
            client = Groq(api_key=settings.GROQ_API_KEY.strip())
            models = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "llama-3.3-70b-versatile"]
            for model_name in models:
                try:
                    response = client.chat.completions.create(
                        model=model_name,
                        messages=[
                            {
                                "role": "system", 
                                "content": f"You are an expert exam setter for {target_class}. Output ONLY raw valid JSON array containing exactly {q_count} multiple choice questions. Every question must have 'id', 'question', 'options' (array of 4), 'correct_index' (0-3), 'topic', and 'explanation'. No conversational text."
                            },
                            {"role": "user", "content": prompt}
                        ],
                        temperature=0.25,
                        max_tokens=4096
                    )
                    content = response.choices[0].message.content
                    if content and ("options" in content or "question" in content):
                        raw_ai_text = content.strip()
                        break
                except Exception as ex:
                    print(f"Groq daily quiz attempt with {model_name} error: {ex}")
        except Exception as e:
            print(f"Groq client error: {e}")

    # 2. Secondary: Gemini 2.5 Flash / 1.5 Flash (Large token generation)
    if not raw_ai_text and settings.GEMINI_API_KEY:
        try:
            client = genai.Client(api_key=settings.GEMINI_API_KEY.strip())
            gemini_system = f"Generate strictly {q_count} multiple choice questions in raw JSON array format for {target_class} {subject}."
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL or "gemini-2.5-flash",
                contents=f"{gemini_system}\n\n{prompt}"
            )
            if response.text and ("options" in response.text or "question" in response.text):
                raw_ai_text = response.text.strip()
        except Exception as ex:
            print(f"Gemini daily quiz error: {ex}")

    # 3. Tertiary: Sarvam AI
    if not raw_ai_text and settings.SARVAM_API_KEY:
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.SARVAM_API_KEY.strip()}",
                "api-key": settings.SARVAM_API_KEY.strip(),
            }
            payload = {
                "model": settings.SARVAM_MODEL or "sarvam-105b-conversations",
                "messages": [
                    {"role": "system", "content": f"Output ONLY a raw JSON array of {q_count} MCQs for {target_class}."},
                    {"role": "user", "content": prompt[:2800]},
                ],
                "temperature": 0.25,
                "max_tokens": 3500,
            }
            res = requests.post("https://api.sarvam.ai/v1/chat/completions", json=payload, headers=headers, timeout=40)
            if res.status_code == 200:
                raw_ai_text = res.json()["choices"][0]["message"]["content"].strip()
        except Exception as ex:
            print(f"Sarvam daily quiz error: {ex}")

    questions = []
    if raw_ai_text:
        try:
            clean_json = re.sub(r"^```json\s*", "", raw_ai_text.strip(), flags=re.MULTILINE)
            clean_json = re.sub(r"^```\s*", "", clean_json, flags=re.MULTILINE)
            clean_json = re.sub(r"```$", "", clean_json.strip(), flags=re.MULTILINE).strip()
            match = re.search(r"\[\s*\{.*\}\s*\]", clean_json, re.DOTALL)
            if match:
                clean_json = match.group(0)
            parsed = json.loads(clean_json)

            if isinstance(parsed, dict) and "questions" in parsed and isinstance(parsed["questions"], list):
                parsed = parsed["questions"]

            if isinstance(parsed, list):
                for idx, q in enumerate(parsed):
                    if isinstance(q, dict) and ("question" in q or "q" in q):
                        q_text = q.get("question") or q.get("q") or f"Diagnostic Question {idx+1}"
                        opts = q.get("options") or q.get("o") or ["Option A", "Option B", "Option C", "Option D"]
                        if len(opts) < 4:
                            opts = opts + [f"Alternative {i+1}" for i in range(4 - len(opts))]
                        c_idx = q.get("correct_index")
                        if c_idx is None:
                            c_opt = str(q.get("correct_option") or q.get("a") or "A").upper().strip()
                            c_idx = {"A": 0, "B": 1, "C": 2, "D": 3}.get(c_opt, 0)

                        questions.append({
                            "id": idx + 1,
                            "question": q_text,
                            "options": opts[:4],
                            "correct_index": int(c_idx) if 0 <= int(c_idx) < 4 else 0,
                            "topic": q.get("topic") or q.get("sub_topic") or f"{subject} Core",
                            "explanation": q.get("explanation") or q.get("e") or f"Option {int(c_idx)+1} is verified as mathematically/conceptually sound."
                        })
        except Exception as e:
            print(f"Error parsing AI daily subject quiz questions: {e}")

    # Fallback to guaranteed 20 questions if AI output is empty or truncated
    if len(questions) < q_count:
        fallback_pool = generate_fallback_20_questions(subject=subject, target_class=target_class, lang=lang)
        if not questions:
            questions = fallback_pool
        else:
            # Append missing questions up to q_count
            existing_count = len(questions)
            for i in range(q_count - existing_count):
                fb_q = fallback_pool[i % len(fallback_pool)].copy()
                fb_q["id"] = existing_count + i + 1
                questions.append(fb_q)

    return questions[:q_count]


@router.get("/daily-quiz")
def get_or_generate_daily_quiz(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Daily autonomous diagnostic quizzes are exclusive to students."
        )

    today = get_ist_now().date()
    existing_quiz = db.query(StudentDailyQuiz).filter(
        StudentDailyQuiz.student_id == current_user.id,
        StudentDailyQuiz.quiz_date == today
    ).first()

    # If an incomplete quiz from earlier had fewer than 20 questions, regenerate to full 20 MCQs!
    if existing_quiz:
        if not existing_quiz.is_completed and isinstance(existing_quiz.questions_json, list) and len(existing_quiz.questions_json) < 20:
            db.delete(existing_quiz)
            db.commit()
            existing_quiz = None
        else:
            return {
                "id": existing_quiz.id,
                "student_id": existing_quiz.student_id,
                "quiz_date": str(existing_quiz.quiz_date),
                "title": existing_quiz.title,
                "questions": existing_quiz.questions_json,
                "is_completed": existing_quiz.is_completed,
                "score": existing_quiz.score,
                "max_score": existing_quiz.max_score,
                "user_answers": existing_quiz.user_answers_json,
                "weak_topics": existing_quiz.weak_topics or [],
                "recommendations": existing_quiz.recommendations_json or [],
                "completed_at": existing_quiz.completed_at
            }

    enrollments = db.query(Enrollment).filter(Enrollment.student_id == current_user.id).all()
    class_ids = [e.classroom_id for e in enrollments]

    enrolled_classes = db.query(Classroom).filter(Classroom.id.in_(class_ids)).all() if class_ids else []
    class_names = [c.name for c in enrolled_classes]
    student_class = current_user.student_class or (class_names[0] if class_names else "Class 10")

    sched = get_daily_subject_schedule(student_class, today)

    docs = []
    if class_ids:
        docs = db.query(DocumentFile).filter(
            DocumentFile.classroom_id.in_(class_ids)
        ).order_by(DocumentFile.created_at.desc()).limit(12).all()

    notes_text = ""
    for d in docs:
        if d.content_text:
            fname_lower = d.filename.lower()
            if any(k in fname_lower for k in sched.get("keywords", [])):
                notes_text += f"\n--- Material from {d.filename} ---\n{d.content_text[:3000]}\n"

    if not notes_text.strip():
        for d in docs[:4]:
            if d.content_text:
                notes_text += f"\n--- Material from {d.filename} ---\n{d.content_text[:2000]}\n"

    if not notes_text.strip():
        notes_text = f"Curriculum and core concepts for {student_class} Subject: {sched['subject']} ({sched['focus']})."

    past_quizzes = db.query(StudentDailyQuiz).filter(
        StudentDailyQuiz.student_id == current_user.id,
        StudentDailyQuiz.is_completed == True
    ).order_by(StudentDailyQuiz.completed_at.desc()).limit(5).all()

    accumulated_weak_topics = []
    for pq in past_quizzes:
        if pq.weak_topics:
            accumulated_weak_topics.extend(pq.weak_topics)

    active_chapters = get_active_term_chapters(
        class_name=student_class,
        subject=sched["subject"],
        current_month=today.month
    )

    prompt = build_advanced_diagnostic_prompt(
        student_name=current_user.full_name or "Student",
        target_class=student_class,
        subject=sched["subject"],
        weekday_name=today.strftime("%A"),
        active_chapters=active_chapters,
        weak_topics=accumulated_weak_topics,
        study_notes_context=notes_text,
        q_count=20,
        lang=sched.get("lang", "en")
    )

    questions = query_llm_for_daily_quiz(
        prompt=prompt,
        subject=sched["subject"],
        target_class=student_class,
        q_count=20,
        lang=sched.get("lang", "en")
    )

    quiz_title = f"Daily Practice: {sched['subject']} — {today.strftime('%d %b %Y (%A)')}"
    daily_quiz = StudentDailyQuiz(
        student_id=current_user.id,
        quiz_date=today,
        title=quiz_title,
        questions_json=questions,
        is_completed=False,
    )
    db.add(daily_quiz)
    db.commit()
    db.refresh(daily_quiz)

    return {
        "id": daily_quiz.id,
        "student_id": daily_quiz.student_id,
        "quiz_date": str(daily_quiz.quiz_date),
        "title": daily_quiz.title,
        "questions": daily_quiz.questions_json,
        "is_completed": daily_quiz.is_completed,
        "score": None,
        "max_score": float(len(questions)),
        "user_answers": {},
        "weak_topics": [],
        "recommendations": [],
        "completed_at": None
    }


@router.post("/daily-quiz/submit")
def submit_daily_quiz(
    data: DailyQuizSubmission,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Daily quizzes are exclusive to students."
        )

    daily_quiz = db.query(StudentDailyQuiz).filter(
        StudentDailyQuiz.id == data.quiz_id,
        StudentDailyQuiz.student_id == current_user.id
    ).first()

    if not daily_quiz:
        raise HTTPException(status_code=404, detail="Daily practice quiz not found.")

    if daily_quiz.is_completed:
        return {
            "message": "Quiz was already completed.",
            "score": daily_quiz.score,
            "max_score": daily_quiz.max_score,
            "percentage": round((daily_quiz.score / (daily_quiz.max_score or 1)) * 100),
            "weak_topics": daily_quiz.weak_topics or [],
            "recommendations": daily_quiz.recommendations_json or [],
            "detailed_answers": daily_quiz.user_answers_json or {}
        }

    questions = daily_quiz.questions_json or []
    user_answers = data.user_answers or {}

    score = 0
    detailed_answers = {}
    topic_errors = {}

    for q in questions:
        q_id = str(q.get("id"))
        correct_idx = q.get("correct_index", 0)
        topic = q.get("topic", "General Academic")
        user_selected = user_answers.get(q_id)

        is_correct = (user_selected is not None and int(user_selected) == int(correct_idx))
        if is_correct:
            score += 1
        else:
            topic_errors[topic] = topic_errors.get(topic, 0) + 1

        detailed_answers[q_id] = {
            "question": q.get("question"),
            "options": q.get("options", []),
            "selected_index": user_selected,
            "correct_index": correct_idx,
            "is_correct": is_correct,
            "explanation": q.get("explanation", ""),
            "topic": topic
        }

    max_score = len(questions)
    weak_topics = [t for t, count in sorted(topic_errors.items(), key=lambda x: x[1], reverse=True)]

    # Autonomous Remediation Recommendations
    student_class = current_user.student_class or "Class 10"
    target_topics = weak_topics[:3] if weak_topics else [questions[0].get("topic", "Core Concepts")]

    recommendations = get_curated_weak_topic_videos(
        weak_topics=target_topics,
        grade_context=student_class,
        target_count=6
    )

    now_ist = get_ist_now()
    daily_quiz.is_completed = True
    daily_quiz.score = float(score)
    daily_quiz.max_score = float(max_score)
    daily_quiz.user_answers_json = detailed_answers
    daily_quiz.weak_topics = weak_topics
    daily_quiz.recommendations_json = recommendations
    daily_quiz.completed_at = now_ist
    db.commit()
    db.refresh(daily_quiz)

    # Automatically Record Analytics Streak Activity
    streak_data = record_learning_activity(
        student_id=current_user.id,
        activity_type="daily_quiz",
        duration_minutes=max(10, len(questions) * 2),
        db=db
    )

    percentage = round((score / (max_score or 1)) * 100)
    return {
        "message": f"Daily Practice submitted! Score: {score}/{max_score} ({percentage}%)",
        "score": score,
        "max_score": max_score,
        "percentage": percentage,
        "weak_topics": weak_topics,
        "recommendations": recommendations,
        "detailed_answers": detailed_answers,
        "streak": streak_data.get("current_streak", 1)
    }


@router.post("/refresh-recommendations")
def refresh_remediation_recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Remediation recommendations are exclusive to students."
        )

    today = get_ist_now().date()
    daily_quiz = db.query(StudentDailyQuiz).filter(
        StudentDailyQuiz.student_id == current_user.id,
        StudentDailyQuiz.quiz_date == today
    ).first()

    student_class = current_user.student_class or "Class 10"

    topics_to_search = []
    if daily_quiz and daily_quiz.weak_topics:
        topics_to_search = daily_quiz.weak_topics[:3]
    else:
        sched = get_daily_subject_schedule(student_class, today)
        active_chaps = get_active_term_chapters(student_class, sched["subject"], today.month)
        topics_to_search = active_chaps[:2] if active_chaps else [f"{sched['subject']} {sched['focus']}"]

    all_recs = get_curated_weak_topic_videos(
        weak_topics=topics_to_search,
        grade_context=student_class,
        target_count=6
    )

    if daily_quiz:
        daily_quiz.recommendations_json = all_recs
        db.commit()

    return {
        "topics": topics_to_search,
        "recommendations": all_recs
    }


@router.post("/log-video-watch")
def log_video_watch_progress(
    data: VideoProgressLog,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Student only feature.")

    record_learning_activity(
        student_id=current_user.id,
        activity_type="video_lecture",
        duration_minutes=max(1, data.watch_seconds // 60),
        db=db
    )

    return {"status": "logged", "watched_seconds": data.watch_seconds}
