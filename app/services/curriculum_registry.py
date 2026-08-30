import random
from typing import List, Dict, Any, Optional

CURRICULUM_TAXONOMY: Dict[str, Dict[str, Dict[str, Any]]] = {
    "class 10": {
        "science": {
            "term1_chapters": [
                "Chemical Reactions and Equations",
                "Acids, Bases and Salts",
                "Metals and Non-Metals",
                "Life Processes (Nutrition, Respiration, Transportation, Excretion)",
                "Light - Reflection and Refraction"
            ],
            "term2_chapters": [
                "Carbon and its Compounds",
                "Control and Coordination",
                "How do Organisms Reproduce?",
                "Heredity and Evolution",
                "The Human Eye and the Colourful World",
                "Electricity (Ohm's Law, Resistance, Power)",
                "Magnetic Effects of Electric Current",
                "Our Environment"
            ],
            "core_keywords": ["chemical", "acid", "base", "metal", "life process", "light", "electricity", "magnetism", "carbon", "reproduction", "eye"]
        },
        "social science (sst)": {
            "term1_chapters": [
                "History: The Rise of Nationalism in Europe",
                "Geography: Resources and Development",
                "Geography: Forest and Wildlife Resources",
                "Civics: Power Sharing",
                "Civics: Federalism",
                "Economics: Development"
            ],
            "term2_chapters": [
                "History: Nationalism in India",
                "History: The Making of a Global World",
                "Geography: Water Resources and Agriculture",
                "Geography: Minerals and Energy Resources",
                "Civics: Gender, Religion and Caste",
                "Civics: Political Parties",
                "Civics: Outcomes of Democracy",
                "Economics: Sectors of the Indian Economy",
                "Economics: Money and Credit",
                "Economics: Globalisation and the Indian Economy"
            ],
            "core_keywords": ["nationalism", "resources", "power sharing", "federalism", "development", "agriculture", "political parties", "credit", "economy"]
        },
        "mathematics": {
            "term1_chapters": [
                "Real Numbers (Fundamental Theorem of Arithmetic)",
                "Polynomials (Zeroes & Coefficients)",
                "Pair of Linear Equations in Two Variables",
                "Quadratic Equations (Factorisation & Quadratic Formula)",
                "Arithmetic Progressions ($a_n$ and $S_n$)"
            ],
            "term2_chapters": [
                "Triangles (Similarity & Thales Theorem)",
                "Coordinate Geometry (Distance & Section Formula)",
                "Introduction to Trigonometry (Identities & Ratios)",
                "Some Applications of Trigonometry (Heights & Distances)",
                "Circles (Tangents to a Circle)",
                "Surface Areas and Volumes (Combinations of Solids)",
                "Statistics (Mean, Median, Mode of Grouped Data)",
                "Probability (Theoretical Probability)"
            ],
            "core_keywords": ["real numbers", "polynomial", "quadratic", "arithmetic progression", "triangle", "trigonometry", "circle", "surface area", "statistics", "probability"]
        },
        "english": {
            "term1_chapters": [
                "Unseen Factual & Discursive Passages (Reading Comprehension)",
                "Grammar: Tenses & Subject-Verb Concord",
                "Grammar: Modals & Determiners",
                "First Flight: A Letter to God, Nelson Mandela: Long Walk to Freedom",
                "Poetry: Dust of Snow, Fire and Ice, A Tiger in the Zoo"
            ],
            "term2_chapters": [
                "Unseen Case-Based Comprehension Passages",
                "Grammar: Reported Speech (Commands, Requests, Statements, Questions)",
                "Grammar: Active and Passive Voice Transformations",
                "First Flight: Two Stories about Flying, From the Diary of Anne Frank, Glimpses of India, Madam Rides the Bus",
                "Footprints without Feet: A Triumph of Surgery, The Thief's Story, The Necklace"
            ],
            "core_keywords": ["reading passage", "tenses", "modals", "reported speech", "concord", "determiners", "letter to god", "mandela", "comprehension"]
        },
        "hindi": {
            "term1_chapters": [
                "अपठित गद्यांश (Unseen Prose Comprehension)",
                "व्याकरण: रचना के आधार पर वाक्य भेद (सरल, संयुक्त, मिश्र वाक्य)",
                "व्याकरण: वाच्य (कर्तृवाच्य, कर्मवाच्य, भाववाच्य)",
                "व्याकरण: पद परिचय",
                "क्षितिज: नेताजी का चश्मा, बालगोबिन भगत, सूरदास के पद"
            ],
            "term2_chapters": [
                "अपठित पद्यांश एवं गद्यांश बोध",
                "व्याकरण: अलंकार (श्लेष, उत्प्रेक्षा, अतिशयोक्ति, मानवीकरण)",
                "व्याकरण: संधि एवं समास (द्वंद्व, द्विगु, कर्मधारय, बहुव्रीहि)",
                "व्याकरण: मुहावरे एवं लोकोक्तियाँ",
                "क्षितिज: राम-लक्ष्मण-परशुराम संवाद, उत्साह, अट नहीं रही है, लखनवी अंदाज",
                "कृतिका: माता का आँचल, साना-साना हाथ जोड़ि"
            ],
            "core_keywords": ["अपठित गद्यांश", "वाक्य भेद", "वाच्य", "पद परिचय", "अलंकार", "समास", "संधि", "मुहावरे"]
        }
    },
    "class 12": {
        "physics": {
            "term1_chapters": [
                "Electric Charges and Fields",
                "Electrostatic Potential and Capacitance",
                "Current Electricity (Kirchhoff's Laws & Potentiometer)",
                "Moving Charges and Magnetism (Biot-Savart & Ampere's Law)",
                "Magnetism and Matter"
            ],
            "term2_chapters": [
                "Electromagnetic Induction (Faraday & Lenz's Law)",
                "Alternating Current (LCR Circuits & Resonance)",
                "Electromagnetic Waves",
                "Ray Optics and Optical Instruments",
                "Wave Optics (Huygens & Interference)",
                "Dual Nature of Radiation and Matter",
                "Atoms and Nuclei",
                "Semiconductor Electronics (p-n junction & diodes)"
            ],
            "core_keywords": ["electrostatics", "capacitance", "current", "magnetism", "induction", "alternating current", "optics", "semiconductor", "atoms"]
        },
        "chemistry": {
            "term1_chapters": [
                "Solutions (Raoult's Law & Colligative Properties)",
                "Electrochemistry (Nernst Equation & Kohlrausch's Law)",
                "Chemical Kinetics (Rate Law & Arrhenius Equation)",
                "d and f Block Elements",
                "Coordination Compounds (IUPAC, CFT & VBT)"
            ],
            "term2_chapters": [
                "Haloalkanes and Haloarenes (SN1 & SN2 Mechanisms)",
                "Alcohols, Phenols and Ethers",
                "Aldehydes, Ketones and Carboxylic Acids (Nucleophilic Additions)",
                "Amines (Diazonium Salts)",
                "Biomolecules (Proteins, Carbohydrates & Nucleic Acids)"
            ],
            "core_keywords": ["solutions", "electrochemistry", "kinetics", "coordination", "haloalkanes", "alcohols", "aldehydes", "amines", "biomolecules"]
        },
        "mathematics": {
            "term1_chapters": [
                "Relations and Functions",
                "Inverse Trigonometric Functions",
                "Matrices and Determinants",
                "Continuity and Differentiability",
                "Applications of Derivatives (Rate of Change, Maxima & Minima)"
            ],
            "term2_chapters": [
                "Integrals (Indefinite & Definite)",
                "Applications of the Integrals (Area under curves)",
                "Differential Equations",
                "Vectors and Three-Dimensional Geometry",
                "Linear Programming",
                "Probability (Bayes' Theorem & Conditional Probability)"
            ],
            "core_keywords": ["matrices", "determinants", "derivative", "integral", "differential equation", "vectors", "3d geometry", "probability"]
        }
    }
}


def get_active_term_chapters(class_name: str, subject: str, current_month: int) -> List[str]:
    clean_class = (class_name or "class 10").lower().strip()
    clean_subj = (subject or "science").lower().strip()

    matched_class = "class 10"
    for k in CURRICULUM_TAXONOMY:
        if k in clean_class:
            matched_class = k
            break

    class_data = CURRICULUM_TAXONOMY.get(matched_class, CURRICULUM_TAXONOMY["class 10"])
    
    matched_subj = "science"
    for s_key in class_data:
        if s_key in clean_subj or clean_subj in s_key:
            matched_subj = s_key
            break

    subj_data = class_data.get(matched_subj, class_data.get("science", {}))
    t1 = subj_data.get("term1_chapters", [])
    t2 = subj_data.get("term2_chapters", [])

    if 4 <= current_month <= 8:
        return t1 if t1 else ["Foundational Concept Mastery", "Core Principles"]
    elif 9 <= current_month <= 12:
        return (t1[-2:] + t2) if t2 else t1
    else:
        return (t1 + t2) if (t1 or t2) else ["Comprehensive Syllabus Revisions", "Board Exam Focus"]


def build_advanced_diagnostic_prompt(
    student_name: str,
    target_class: str,
    subject: str,
    weekday_name: str,
    active_chapters: List[str],
    weak_topics: List[str],
    study_notes_context: str,
    q_count: int = 8,
    lang: str = "en"
) -> str:
    chapter_str = "\n".join([f"- {c}" for c in active_chapters[:6]])
    weak_str = ", ".join(weak_topics[:3]) if weak_topics else "None (Balanced Distribution)"

    if lang == "hi":
        return f"""आप {target_class} के लिए आधिकारिक CBSE/NCERT पाठ्यक्रम आधारित परीक्षा विशेषज्ञ हैं।
आज का विषय: {subject} ({weekday_name})
सक्रिय अध्याय (Active Term Chapters):
{chapter_str}

छात्र के कमज़ोर विषय (Remediation Topics): {weak_str}
क्लासरूम नोट्स संदर्भ:\n{study_notes_context[:3000]}

निर्देश (Bloom's Taxonomy Cognitive Distribution):
1. ठीक {q_count} प्रश्न (MCQs) बनाएं strictly हिंदी (देवनागरी लिपि) में।
2. 20% प्रश्न सीधे सिद्धांत/परिभाषा, 40% व्यावहारिक/प्रयोग आधारित, 40% तार्किक/विश्लेषणात्मक (समास, संधि, पद परिचय, अपठित बोध)।
3. यदि अपठित गद्यांश है तो 120 शब्दों का रोचक गद्यांश दें और उससे जुड़े प्रश्न पूछें।
4. JSON संरचना strictly यह होनी चाहिए:
[
  {{
    "id": 1,
    "question": "प्रश्न विवरण",
    "options": ["विकल्प 1", "विकल्प 2", "विकल्प 3", "विकल्प 4"],
    "correct_index": 0,
    "topic": "संक्षिप्त अध्याय/टॉपिक नाम",
    "explanation": "विस्तृत व्याख्या क्यों सही है"
  }}
]
Output ONLY raw valid JSON array, no markdown ticks, no commentary."""

    return f"""You are an elite academic curriculum assessment engine for {target_class} (CBSE/NCERT/State Standards).
Today's Scheduled Subject: {subject} ({weekday_name})
Active Syllabus Chapters for Current Academic Term:
{chapter_str}

Student's Target Diagnostic Focus (Prior Weak Topics): {weak_str}
Classroom Study Material Context:
{study_notes_context[:3000]}

CRITICAL BLOOM'S TAXONOMY & CBSE 2026 SPECIFICATIONS:
1. Generate exactly {q_count} multiple-choice questions.
2. Cognitive Distribution:
   - 20% Recall & Fundamental Laws (Direct conceptual check).
   - 40% Application & Problem Solving (Numericals with exact LaTeX equations e.g. $F = ma$, $\\Delta U = Q - W$, $a_n = a + (n-1)d$).
   - 30% Analytical / Assertion-Reason / Case Context (e.g. "Assertion: ... Reason: ...").
   - 10% High Order Thinking Skills (HOTS).
3. If subject is English/Hindi, provide an authentic 120-word passage followed by context comprehension and applied grammar MCQs.
4. Each mathematical and scientific derivation in "explanation" must be clearly formatted with step-by-step calculation.

Return ONLY a valid JSON array of objects with keys:
- "id": number (1 to {q_count})
- "question": string (with LaTeX $...$ for math/science)
- "options": array of 4 distinct choices
- "correct_index": integer (0, 1, 2, or 3)
- "topic": concise chapter or subtopic tag (e.g. "Electricity Ohm Law", "Life Processes Photosynthesis")
- "explanation": complete step-by-step reasoning and mathematical derivation.

Output raw JSON only. No markdown formatting."""