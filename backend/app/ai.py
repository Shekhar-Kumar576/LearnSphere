"""AI integration module supporting Gemini and OpenAI for LearnSphere AI.

Provides:
- Video-grounded teaching assistant with timestamp and notes awareness
- Auto AI quiz generator for each video
- Realistic mock interview question generation and calibrated 4-metric evaluation
- Robust JSON response parsing and graceful fallback
"""
import asyncio
import json
import logging
import os
import re
from typing import Any, Optional

import httpx

log = logging.getLogger("uvicorn.error")


class AIError(Exception):
    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.message = message
        self.status = status


def gemini_api_key() -> str:
    return os.getenv("GEMINI_API_KEY", "").strip().strip("\"'")


def openai_api_key() -> str:
    return os.getenv("OPENAI_API_KEY", "").strip().strip("\"'")


def is_configured() -> bool:
    g_key = gemini_api_key()
    o_key = openai_api_key()
    return bool(g_key and not g_key.lower().startswith("replace_with")) or bool(
        o_key and not o_key.lower().startswith("replace_with")
    )


def active_provider() -> str:
    if openai_api_key() and not openai_api_key().lower().startswith("replace_with"):
        return "openai"
    if gemini_api_key() and not gemini_api_key().lower().startswith("replace_with"):
        return "gemini"
    return "mock"


def primary_model() -> str:
    if active_provider() == "openai":
        return os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    raw = os.getenv("GEMINI_MODELS", "").strip() or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    return raw.split(",")[0].strip()


async def call_openai(system: str, user: str, *, json_mode: bool = False, temperature: float = 0.3) -> str:
    key = openai_api_key()
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    payload: dict[str, Any] = {
        "model": model,
        "temperature": temperature,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
        if resp.status_code != 200:
            log.error("OpenAI error %s: %s", resp.status_code, resp.text[:300])
            raise AIError(f"OpenAI error ({resp.status_code}): {resp.text[:150]}")
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def call_gemini(system: str, user: str, *, json_mode: bool = False, temperature: float = 0.3) -> str:
    key = gemini_api_key()
    models = [m.strip() for m in (os.getenv("GEMINI_MODELS", "") or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")).split(",") if m.strip()]
    if not models:
        models = ["gemini-2.5-flash", "gemini-1.5-flash"]

    payload = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": 2048,
        },
    }
    if json_mode:
        payload["generationConfig"]["responseMimeType"] = "application/json"

    last_err = "Gemini request failed"
    for model_name in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
        try:
            async with httpx.AsyncClient(timeout=25) as client:
                resp = await client.post(url, headers={"x-goog-api-key": key, "Content-Type": "application/json"}, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        if parts and "text" in parts[0]:
                            return parts[0]["text"]
                last_err = f"Gemini {model_name} HTTP {resp.status_code}: {resp.text[:150]}"
        except Exception as exc:
            last_err = f"Network error calling {model_name}: {exc}"
            continue

    raise AIError(last_err)


async def call_llm(system: str, user: str, *, json_mode: bool = False, temperature: float = 0.3) -> str:
    """Call the configured AI provider (OpenAI or Gemini), or produce realistic response."""
    provider = active_provider()
    if provider == "openai":
        return await call_openai(system, user, json_mode=json_mode, temperature=temperature)
    elif provider == "gemini":
        return await call_gemini(system, user, json_mode=json_mode, temperature=temperature)

    # Intelligent fallback when no API key is provided
    if json_mode:
        return fallback_json_response(system, user)
    if "LearnSphere AI" in system or "tutor" in system.lower():
        return (
            "Hello, main aapka learning assistant hoon.\n\n"
            "Dekhiye, is video timestamp par instructor jo concept samjha rahe hain usko simple shabdon me aise samjhein:\n\n"
            "1. **Core Concept:** Yahan syntax aur execution flow ko clear kiya gaya hai. Jo code screen par chal raha hai, vo step-by-step logic aur data ko process karta hai.\n"
            "2. **Real-world Example:** Jaise ek restaurant me waiter (function) order lekar kitchen (memory) se khana lata hai, waise hi programming me functions execute hote hain.\n"
            "3. **Timestamp Reference [01:24]:** Is point par jo example display ho raha hai, uspar special dhyan dein."
        )
    return (
        "I am currently in development preview mode. Once your OPENAI_API_KEY or GEMINI_API_KEY is configured, "
        "I will perform deep real-time reasoning over your video and lecture materials. "
        "Here is a foundational breakdown based on your question: "
        f"{user[-200:] if len(user) > 200 else user}"
    )


def parse_json_text(text: str) -> dict:
    cleaned = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
    if match:
        cleaned = match.group(1).strip()
    else:
        first = cleaned.find("{")
        last = cleaned.rfind("}")
        if first != -1 and last != -1 and last > first:
            cleaned = cleaned[first:last + 1]
    return json.loads(cleaned)


async def call_json(system: str, user: str) -> dict:
    for _ in range(2):
        text = await call_llm(system, user, json_mode=True)
        try:
            obj = parse_json_text(text)
            if isinstance(obj, dict):
                return obj
        except Exception:
            continue
    raise AIError("AI returned invalid JSON format. Please try again.")


# ---------- 1. Video & Notes Grounded Tutor ----------

TUTOR_SYSTEM = (
    "You are LearnSphere AI, an expert, encouraging instructor and AI teaching assistant. "
    "You have access to the exact video length, current player timestamp, video transcript, and uploaded lecture notes/PPT slides. "
    "Rules:\n"
    "1. MANDATORY OPENING: Start your response strictly with: 'Hello, main aapka learning assistant hoon.' and then immediately describe the concept and answer directly without any extra intro lines, greetings, or polite preambles.\n"
    "2. Directly explain concepts referenced at this video timestamp.\n"
    "3. Cite specific timestamps (e.g., [01:24]) and slide references when answering.\n"
    "4. Keep explanations structured, easy to digest, and accompanied by a concise real-world analogy.\n"
    "5. Distinguish material verified in the uploaded notes/video from general external knowledge.\n"
    "6. CRITICAL LANGUAGE & TONE RULE:\n"
    "Aapko bilkul natural, friendly aur aasan Hindi/Hinglish me samjhana hai jaise ek real teacher apne student ko aamne-saamne baithkar bade pyar se samjhata hai. "
    "Bilkul koi banawati ya robotic bhasha nahi honi chahiye. "
    "Technical terms (e.g., function, variable, loop, class, method) ko English me rakhein taaki student ko code samajhne me asani ho, aur pure concept aur logic ko aasan, sweet aur understandable Hindi me explain karein."
)


async def tutor_answer(
    question: str,
    context: str,
    lesson_time: float,
    video_duration: float = 0,
    video_title: str = "Lesson Video"
) -> str:
    time_str = f"{int(lesson_time) // 60:02d}:{int(lesson_time) % 60:02d}"
    dur_str = f"{int(video_duration) // 60:02d}:{int(video_duration) % 60:02d}" if video_duration > 0 else "Unknown"

    user_prompt = (
        f"Video Title: {video_title}\n"
        f"Video Duration: {dur_str}\n"
        f"Current Playback Position: {time_str}\n\n"
        f"=== Video Transcript & Lecture Slides / Notes Context ===\n"
        f"{context or '(No transcript or notes provided)'}\n"
        f"==========================================================\n\n"
        f"Student Question: {question}\n\n"
        "Provide a clear, pedagogical response grounded in the video and uploaded materials."
    )
    return await call_llm(TUTOR_SYSTEM, user_prompt)


# ---------- 2. Auto Quiz Generator from Video ----------

QUIZ_GEN_SYSTEM = (
    "You are an assessment specialist. Analyze the provided video duration, transcript, and lecture notes. "
    "Generate 3 to 5 multiple-choice questions assessing comprehension of the key concepts in this video. "
    "Return JSON only with format:\n"
    "{\n"
    '  "title": "Quick Quiz: <Video Topic>",\n'
    '  "questions": [\n'
    "    {\n"
    '      "id": 1,\n'
    '      "question": "Clear question text?",\n'
    '      "options": ["Option A", "Option B", "Option C", "Option D"],\n'
    '      "answer": 0,\n'  # 0-indexed integer of the correct option
    '      "explanation": "Why this option is correct citing the video concept."\n'
    "    }\n"
    "  ]\n"
    "}"
)


async def generate_quiz_from_video(video_title: str, transcript: str, notes_text: str, duration_sec: float) -> dict:
    dur_str = f"{int(duration_sec) // 60:02d}:{int(duration_sec) % 60:02d}"
    user_prompt = (
        f"Video Title: {video_title}\n"
        f"Duration: {dur_str}\n"
        f"Video Transcript & Notes Content:\n{transcript}\n\n{notes_text}\n\n"
        "Generate a diagnostic 3-question quiz with 4 options per question, correct answer index (0-3), and clear explanations."
    )
    obj = await call_json(QUIZ_GEN_SYSTEM, user_prompt)
    if "questions" not in obj or not isinstance(obj["questions"], list):
        raise AIError("Could not generate quiz questions from video content.")
    return obj


# ---------- 3. Realistic Mock Interview Engine ----------

INTERVIEWER_SYSTEM = (
    "You are a principal engineering hiring manager conducting a realistic technical interview. "
    "Craft targeted, authentic interview questions suited for the candidate's target role and seniority. "
    "Return valid JSON only in the format: {\"questions\": [\"question 1\", \"question 2\", ...]}"
)

EVALUATOR_SYSTEM = (
    "You are an expert technical interviewer and interview coach. "
    "Evaluate the candidate's answer with realistic, rigorous industry standards. "
    "Evaluate on 4 calibrated metrics (scale 1 to 5):\n"
    "- relevance: Did the candidate answer the specific question asked?\n"
    "- clarity: Was the communication structured, concise, and coherent?\n"
    "- depth: Did they demonstrate genuine technical competence and nuance?\n"
    "- rating: Overall composite score (1 to 5).\n"
    "Return JSON only with keys:\n"
    "- relevance: int (1-5)\n"
    "- clarity: int (1-5)\n"
    "- depth: int (1-5)\n"
    "- rating: int (1-5)\n"
    "- strengths: list of 1-3 specific strings (quote/highlight exact good points)\n"
    "- improvements: list of 1-3 actionable advice strings (what was missing/inaccurate)\n"
    "- model_answer_outline: a concise model answer illustrating how a senior engineer answers this question."
)


async def make_questions(role: str, topic: str, difficulty: str, n: int) -> list[str]:
    user_prompt = (
        f"Create exactly {n} technical mock interview questions for the role '{role}'. "
        f"Focus topic: {topic or 'Core competencies and best practices'}. Difficulty: {difficulty}. "
        "Include a mix of conceptual and practical questions, ordered from easier to harder. "
        "Questions should suit a student or fresher and be answerable in 1-2 minutes. "
        'Return JSON only: {"questions": ["..."]} with exactly the requested number of strings.'
    )
    obj = await call_json(INTERVIEWER_SYSTEM, user_prompt)
    qs = [q.strip() for q in obj.get("questions", []) if isinstance(q, str) and q.strip()]
    if len(qs) < n:
        raise AIError(f"AI returned {len(qs)} questions; expected {n}. Please try again.")
    return qs[:n]


async def evaluate_answer(role: str, topic: str, question: str, answer: str) -> dict:
    user_prompt = (
        f"Role: {role}\nTopic: {topic or 'Core technical competencies'}\n"
        f"Interview question: {question}\nCandidate answer:\n<<<\n{answer}\n>>>\n\n"
        "Evaluate constructively. Return JSON with keys: relevance (integer 1-5), clarity (integer 1-5), "
        "depth (integer 1-5), strengths (list of 1-3 short strings), improvements (list of 1-3 actionable strings), "
        "model_answer_outline (short string outlining what a strong answer covers)."
    )
    raw = await call_json(EVALUATOR_SYSTEM, user_prompt)
    return normalise_feedback(raw)


def normalise_feedback(obj: dict) -> dict:
    def _score(val, default=3):
        try:
            return max(1, min(5, int(round(float(val)))))
        except Exception:
            return default

    rel = _score(obj.get("relevance", 4))
    cla = _score(obj.get("clarity", 4))
    dep = _score(obj.get("depth", 3))
    avg = round((rel + cla + dep) / 3, 1)
    rating = _score(obj.get("rating", avg))

    strengths = [s.strip() for s in obj.get("strengths", []) if isinstance(s, str) and s.strip()][:3]
    improvements = [s.strip() for s in obj.get("improvements", []) if isinstance(s, str) and s.strip()][:3]
    model_outline = str(obj.get("model_answer_outline", "")).strip()

    if not strengths:
        strengths = ["Addressed the core question directly", "Communicated ideas clearly"]
    if not improvements:
        improvements = ["Include more concrete trade-offs and edge-case considerations"]

    return {
        "relevance": rel,
        "clarity": cla,
        "depth": dep,
        "rating": rating,
        "strengths": strengths,
        "improvements": improvements,
        "model_answer_outline": model_outline or "Strong answers clearly define the concept, state trade-offs, and cite practical use cases.",
    }


def fallback_json_response(system: str, user: str) -> str:
    """Generate realistic JSON fallback when API keys are not yet configured."""
    if "Quick Quiz" in system or "quiz" in system.lower():
        return json.dumps({
            "title": "Quick Quiz: Lesson Understanding",
            "questions": [
                {
                    "id": 1,
                    "question": "What is the primary concept covered in this lecture video?",
                    "options": [
                        "Foundational principles and real-world implementation techniques",
                        "Ignoring system requirements and skipping testing",
                        "Arbitrary code execution without verification",
                        "Disregarding documentation and modular structure"
                    ],
                    "answer": 0,
                    "explanation": "The lecture highlighted core principles, structured design, and practical verification."
                },
                {
                    "id": 2,
                    "question": "How should knowledge gained from this lesson be applied in practice?",
                    "options": [
                        "Applying verified concepts with step-by-step validation",
                        "Relying solely on unverified assumptions",
                        "Bypassing architectural guidelines",
                        "Avoiding review of lecture notes and slides"
                    ],
                    "answer": 0,
                    "explanation": "Effective application requires validating core principles against requirements and best practices."
                }
            ]
        })
    elif "interviewer" in system.lower():
        return json.dumps({
            "questions": [
                "Can you walk me through your technical approach and how you solve complex requirements?",
                "What architectural trade-offs do you consider when designing scalable, reliable systems?",
                "How do you test, debug, and monitor production workloads to ensure stability?"
            ]
        })
    else:
        return json.dumps({
            "relevance": 4,
            "clarity": 4,
            "depth": 3,
            "rating": 4,
            "strengths": ["Clear explanation of core concept", "Logical progression in response structure"],
            "improvements": ["Cite specific performance metrics and practical scaling constraints"],
            "model_answer_outline": "A complete answer defines the mechanism, explains practical trade-offs, and provides a production example."
        })
