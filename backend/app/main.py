"""LearnSphere AI backend (FastAPI).

Comprehensive REST API providing:
- Teaching Video Upload, Duration Inspection & Streaming
- Downloadable Lecture Notes & PPT Resource Center with AI Document Grounding
- Per-Video Automatic AI Quiz Generator & Student Evaluation
- Realistic Multi-Metric Mock Interview Engine & Detailed Rubric Feedback
- Real Database Persistence (SQLite), User Data Management, and History
"""
import httpx
import logging
import os
import re
import shutil
import sys
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal, Optional

logger = logging.getLogger("learnsphere")

# Ensure parent and app directories are in sys.path for direct execution
_app_dir = Path(__file__).resolve().parent
_backend_dir = _app_dir.parent
if str(_app_dir) not in sys.path:
    sys.path.insert(0, str(_app_dir))
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

try:
    from . import ai, db, media_utils
except (ImportError, ValueError):
    import ai, db, media_utils

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./data/uploads"))
VIDEOS_DIR = UPLOAD_DIR / "videos"
DOCS_DIR = UPLOAD_DIR / "documents"


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="LearnSphere AI API", version="3.0", lifespan=lifespan)

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True if origins else False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Error Formatting ----------
@app.exception_handler(ai.AIError)
async def _ai_error(_: Request, e: ai.AIError):
    return JSONResponse({"error": e.message}, status_code=e.status)


@app.exception_handler(HTTPException)
async def _http_error(_: Request, e: HTTPException):
    return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)


@app.exception_handler(RequestValidationError)
async def _validation_error(_: Request, e: RequestValidationError):
    first = e.errors()[0] if e.errors() else {}
    where = ".".join(str(p) for p in first.get("loc", []) if p != "body")
    return JSONResponse({"error": f"Invalid input ({where}): {first.get('msg', 'bad value')}"}, status_code=422)


# ---------- User Identity ----------
USER_RE = re.compile(r"^[A-Za-z0-9_.-]{3,128}$")


def current_user(x_user_id: str = Header(default="")) -> str:
    if not USER_RE.match(x_user_id):
        raise HTTPException(400, "Missing or invalid X-User-Id header")
    return x_user_id


def optional_user(x_user_id: str = Header(default="")) -> str:
    if not USER_RE.match(x_user_id):
        return "default-student-user"
    return x_user_id


_hits: dict[str, deque] = defaultdict(deque)


def ai_limit(user: str = Depends(current_user)) -> str:
    limit = int(os.getenv("RATE_LIMIT_PER_10MIN", "50"))
    now = time.time()
    q = _hits[user]
    while q and now - q[0] > 600:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(429, "Too many AI requests. Please wait a few minutes.")
    q.append(now)
    return user


# ---------- Schemas ----------
class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=4, max_length=120)
    role: Literal["student", "teacher"] = "student"
    avatar_url: Optional[str] = ""


class LoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=1, max_length=120)
    role: Optional[Literal["student", "teacher"]] = None


class GoogleAuthIn(BaseModel):
    email: str = Field(min_length=3, max_length=120)
    name: str = Field(min_length=1, max_length=120)
    role: Literal["student", "teacher"] = "student"
    avatar_url: Optional[str] = ""


class SetRoleIn(BaseModel):
    email: str = Field(min_length=3, max_length=120)
    role: Literal["student", "teacher"]


class ChatIn(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    context: str = Field(default="", max_length=50000)
    lessonTime: float = Field(default=0, ge=0)
    videoId: Optional[int] = None


class TTSIn(BaseModel):
    text: str = Field(min_length=1, max_length=10000)
    voice: Optional[str] = "hi-IN-MadhurNeural"


class StartIn(BaseModel):
    role: str = Field(min_length=2, max_length=80)
    topic: str = Field(default="", max_length=120)
    difficulty: Literal["beginner", "intermediate", "advanced"] = "intermediate"
    num_questions: Literal[1, 3, 5, 7] = 5


class AnswerIn(BaseModel):
    question_index: int = Field(ge=0, le=20)
    answer: str = Field(min_length=1, max_length=4000)


class QuizSubmitIn(BaseModel):
    quiz_id: int
    answers: list[int]


# ---------- Authentication Endpoints ----------
import secrets

@app.post("/api/auth/register")
def register(payload: RegisterIn):
    existing = db.get_user_by_email(payload.email)
    if existing:
        raise HTTPException(400, "An account with this email address already exists. Please sign in instead.")
    user = db.create_user(
        email=payload.email,
        password=payload.password,
        name=payload.name,
        role=payload.role,
        avatar_url=payload.avatar_url or "",
    )
    user_session_id = f"usr_{user['id']}_{secrets.token_hex(6)}"
    return {"ok": True, "user": user, "sessionId": user_session_id}


@app.post("/api/auth/login")
def login(payload: LoginIn):
    user = db.get_user_by_email(payload.email)
    if not user:
        raise HTTPException(401, "No account found with this email. Please check your email or register.")
    if not db.verify_password(payload.password, user["password_hash"]):
        raise HTTPException(401, "Incorrect password. Please try again.")
    user_clean = {k: v for k, v in user.items() if k != "password_hash"}
    user_session_id = f"usr_{user['id']}_{secrets.token_hex(6)}"
    return {"ok": True, "user": user_clean, "sessionId": user_session_id}


@app.post("/api/auth/google")
def google_auth(payload: GoogleAuthIn):
    user = db.upsert_google_user(
        email=payload.email,
        name=payload.name,
        role=payload.role,
        avatar_url=payload.avatar_url or "",
    )
    user_session_id = f"usr_{user['id']}_{secrets.token_hex(6)}"
    return {"ok": True, "user": user, "sessionId": user_session_id}


@app.post("/api/auth/set-role")
def set_user_role(payload: SetRoleIn):
    clean_email = payload.email.strip().lower()
    with db.conn() as c:
        row = c.execute("SELECT id, email, name, role, avatar_url, provider, created_at FROM users WHERE LOWER(email) = ?", (clean_email,)).fetchone()
        if not row:
            raise HTTPException(404, "User account not found.")
        # Account roles are permanently locked to their registration portal and cannot be flipped.
        return {"ok": True, "user": dict(row), "message": "Account role is permanently locked to its registered portal."}


@app.get("/api/auth/user")
def get_user_profile(email: str):
    clean_email = email.strip().lower()
    user = db.get_user_by_email(clean_email)
    if not user:
        raise HTTPException(404, "User not found")
    clean = {k: v for k, v in user.items() if k != "password_hash"}
    return {"ok": True, "user": clean}


# ---------- System & Health ----------
@app.get("/api/health")
def health():
    return {
        "ok": True,
        "aiConfigured": ai.is_configured(),
        "provider": ai.active_provider(),
        "model": ai.primary_model(),
    }


@app.get("/api/stats")
def stats(user: str = Depends(current_user)):
    with db.conn() as c:
        q_count = c.execute("SELECT COUNT(*) FROM chat_history WHERE user_id = ?", (user,)).fetchone()[0]
        iv_start = c.execute("SELECT COUNT(*) FROM interview_sessions WHERE user_id = ?", (user,)).fetchone()[0]
        iv_fin = c.execute("SELECT COUNT(*) FROM interview_sessions WHERE user_id = ? AND status = 'finished'", (user,)).fetchone()[0]
        ans_count = c.execute(
            """SELECT COUNT(*) FROM interview_answers a
               JOIN interview_sessions s ON a.session_id = s.id
               WHERE s.user_id = ?""",
            (user,)
        ).fetchone()[0]
        avg_rating = c.execute(
            """SELECT AVG(rating) FROM interview_answers a
               JOIN interview_sessions s ON a.session_id = s.id
               WHERE s.user_id = ?""",
            (user,)
        ).fetchone()[0]
        quizzes_taken = c.execute("SELECT COUNT(*) FROM quiz_attempts WHERE user_id = ?", (user,)).fetchone()[0]

        focus_areas = []
        if iv_fin > 0:
            last_sess = c.execute("SELECT summary FROM interview_sessions WHERE user_id = ? AND status = 'finished' ORDER BY id DESC LIMIT 1", (user,)).fetchone()
            if last_sess and last_sess["summary"]:
                summary_obj = db.jload(last_sess["summary"]) or {}
                focus_areas = summary_obj.get("practice_areas", [])

    return {
        "questions_asked": q_count,
        "interviews_started": iv_start,
        "interviews_finished": iv_fin,
        "answers_reviewed": ans_count,
        "average_rating": round(avg_rating, 1) if avg_rating else None,
        "quizzes_taken": quizzes_taken,
        "focus_areas": focus_areas,
    }


class HistoryEventIn(BaseModel):
    type: str = Field(default="Lesson", max_length=50)
    title: str = Field(min_length=1, max_length=200)
    detail: str = Field(default="", max_length=500)
    video_id: Optional[int] = None
    lesson_time: Optional[float] = 0


@app.post("/api/history/event")
def log_history_event(payload: HistoryEventIn, user: str = Depends(current_user)):
    with db.conn() as c:
        c.execute(
            """INSERT INTO chat_history (user_id, question, answer, video_id, lesson_time)
               VALUES (?, ?, ?, ?, ?)""",
            (user, f"[{payload.type}] {payload.title}", payload.detail or payload.type, payload.video_id, payload.lesson_time or 0),
        )
    return {"ok": True}


@app.get("/api/history")
def history(user: str = Depends(current_user)):
    with db.conn() as c:
        chat_rows = c.execute(
            "SELECT question, answer, lesson_time, created_at FROM chat_history WHERE user_id = ? ORDER BY id DESC LIMIT 50",
            (user,),
        ).fetchall()
        iv_rows = c.execute(
            "SELECT role, topic, status, created_at FROM interview_sessions WHERE user_id = ? ORDER BY id DESC LIMIT 50",
            (user,),
        ).fetchall()
        quiz_rows = c.execute(
            """SELECT q.title, a.score, a.total_questions, a.created_at
               FROM quiz_attempts a
               JOIN quizzes q ON a.quiz_id = q.id
               WHERE a.user_id = ?
               ORDER BY a.id DESC LIMIT 50""",
            (user,),
        ).fetchall()

    items = []
    for r in chat_rows:
        raw_q = r["question"]
        is_event = raw_q.startswith("[") and "]" in raw_q
        if is_event:
            ev_type = raw_q[1:raw_q.index("]")]
            ev_title = raw_q[raw_q.index("]") + 1:].strip()
            items.append({
                "type": ev_type,
                "title": ev_title,
                "detail": r["answer"],
                "time": r["created_at"],
            })
        else:
            items.append({
                "type": "AI Question",
                "title": raw_q[:60],
                "detail": f"Time {media_utils.format_duration(r['lesson_time'])} • {r['answer'][:70]}...",
                "time": r["created_at"],
            })
    for r in iv_rows:
        items.append({
            "type": "Interview",
            "title": f"Mock Interview: {r['role']}",
            "detail": f"Topic: {r['topic'] or 'General'} • Status: {r['status']}",
            "time": r["created_at"],
        })
    for r in quiz_rows:
        items.append({
            "type": "Quiz",
            "title": f"Quiz: {r['title']}",
            "detail": f"Score: {r['score']}/{r['total_questions']} ({int(r['score'] / max(1, r['total_questions']) * 100)}%)",
            "time": r["created_at"],
        })

    # Sort all items by timestamp descending
    items.sort(key=lambda x: x.get("time", ""), reverse=True)
    return {"items": items}


@app.delete("/api/history")
@app.delete("/api/me/data")
def delete_user_data(user: str = Depends(current_user)):
    with db.conn() as c:
        c.execute("DELETE FROM chat_history WHERE user_id = ?", (user,))
        c.execute("DELETE FROM interview_sessions WHERE user_id = ?", (user,))
        c.execute("DELETE FROM quiz_attempts WHERE user_id = ?", (user,))
    return {"ok": True, "message": "All personal learning history deleted from database."}


# ---------- 1. Courses & Video Endpoints ----------
class CourseCreateIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default="", max_length=1000)
    instructor: Optional[str] = Field(default="Course Instructor", max_length=100)
    thumbnail: Optional[str] = Field(default="/photo.jpg", max_length=200)


class CourseUpdateIn(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    instructor: Optional[str] = Field(default=None, max_length=100)
    thumbnail: Optional[str] = Field(default=None, max_length=200)


@app.get("/api/courses")
def list_courses(x_user_role: str = Header(default="")):
    with db.conn() as c:
        rows = c.execute("SELECT * FROM courses ORDER BY id ASC").fetchall()
        courses = []
        is_student = (x_user_role or "").strip().lower() == "student"
        for r in rows:
            video_count = c.execute("SELECT COUNT(*) FROM videos WHERE course_id = ?", (r["id"],)).fetchone()[0]
            # Students only view courses made available by teachers with uploaded lessons
            if is_student and (video_count == 0 or r["title"].strip().lower() == "my teaching course"):
                continue
            courses.append({
                "id": r["id"],
                "title": r["title"],
                "description": r["description"],
                "instructor": r["instructor"],
                "thumbnail": r["thumbnail"],
                "video_count": video_count,
            })
        return courses


@app.post("/api/courses")
def create_course(payload: CourseCreateIn, user: str = Depends(current_user)):
    clean_title = payload.title.strip()
    clean_desc = payload.description.strip() if payload.description else ""
    clean_inst = payload.instructor.strip() if payload.instructor else "Course Instructor"
    with db.conn() as c:
        # Check if already exists
        existing = c.execute("SELECT * FROM courses WHERE LOWER(title) = LOWER(?)", (clean_title,)).fetchone()
        if existing:
            c_dict = dict(existing)
            cnt = c.execute("SELECT COUNT(*) FROM videos WHERE course_id = ?", (c_dict["id"],)).fetchone()[0]
            c_dict["video_count"] = cnt
            return c_dict

        cur = c.execute(
            """INSERT INTO courses (title, description, instructor, thumbnail)
               VALUES (?, ?, ?, ?)""",
            (clean_title, clean_desc, clean_inst, payload.thumbnail or "/photo.jpg"),
        )
        course_id = cur.lastrowid
        row = c.execute("SELECT * FROM courses WHERE id = ?", (course_id,)).fetchone()
        c_dict = dict(row)
        c_dict["video_count"] = 0
        return c_dict


@app.put("/api/courses/{course_id}")
def update_course(course_id: int, payload: CourseUpdateIn, user: str = Depends(current_user)):
    with db.conn() as c:
        row = c.execute("SELECT * FROM courses WHERE id = ?", (course_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Course not found.")

        updates = []
        params = []
        if payload.title is not None and payload.title.strip():
            updates.append("title = ?")
            params.append(payload.title.strip())
        if payload.description is not None:
            updates.append("description = ?")
            params.append(payload.description.strip())
        if payload.instructor is not None and payload.instructor.strip():
            updates.append("instructor = ?")
            params.append(payload.instructor.strip())
        if payload.thumbnail is not None and payload.thumbnail.strip():
            updates.append("thumbnail = ?")
            params.append(payload.thumbnail.strip())

        if updates:
            params.append(course_id)
            c.execute(f"UPDATE courses SET {', '.join(updates)} WHERE id = ?", tuple(params))

        updated = c.execute("SELECT * FROM courses WHERE id = ?", (course_id,)).fetchone()
        c_dict = dict(updated)
        cnt = c.execute("SELECT COUNT(*) FROM videos WHERE course_id = ?", (course_id,)).fetchone()[0]
        c_dict["video_count"] = cnt
        return c_dict


@app.delete("/api/courses/{course_id}")
def delete_course(course_id: int, user: str = Depends(optional_user), x_user_role: str = Header(default="")):
    if x_user_role and x_user_role.strip().lower() != "teacher":
        raise HTTPException(403, "Permission denied: Only teachers can delete courses.")
    with db.conn() as c:
        row = c.execute("SELECT * FROM courses WHERE id = ?", (course_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Course not found.")
        other = c.execute("SELECT id FROM courses WHERE id != ? ORDER BY id ASC LIMIT 1", (course_id,)).fetchone()
        if other:
            c.execute("UPDATE videos SET course_id = ? WHERE course_id = ?", (other["id"], course_id))
        else:
            vids = c.execute("SELECT id, file_path FROM videos WHERE course_id = ?", (course_id,)).fetchall()
            for v in vids:
                if "/api/media/videos/" in (v["file_path"] or ""):
                    fname = v["file_path"].split("/api/media/videos/")[-1].strip()
                    df = VIDEOS_DIR / fname
                    if df.is_file():
                        try:
                            df.unlink()
                        except Exception:
                            pass
            c.execute("DELETE FROM quiz_attempts WHERE quiz_id IN (SELECT id FROM quizzes WHERE video_id IN (SELECT id FROM videos WHERE course_id = ?))", (course_id,))
            c.execute("DELETE FROM quizzes WHERE video_id IN (SELECT id FROM videos WHERE course_id = ?)", (course_id,))
            c.execute("DELETE FROM videos WHERE course_id = ?", (course_id,))
        c.execute("DELETE FROM courses WHERE id = ?", (course_id,))
    return {"ok": True, "message": f"Course #{course_id} deleted successfully."}


@app.get("/api/videos")
def list_all_videos():
    with db.conn() as c:
        rows = c.execute(
            """SELECT v.*, c.title AS course_title, c.instructor AS course_instructor
               FROM videos v
               LEFT JOIN courses c ON v.course_id = c.id
               ORDER BY v.id DESC"""
        ).fetchall()
        return [dict(r) for r in rows]


@app.get("/api/courses/{course_id}/videos")
def get_course_videos(course_id: int):
    with db.conn() as c:
        rows = c.execute(
            """SELECT v.*, c.title AS course_title, c.instructor AS course_instructor
               FROM videos v
               LEFT JOIN courses c ON v.course_id = c.id
               WHERE v.course_id = ?
               ORDER BY v.id ASC""",
            (course_id,),
        ).fetchall()
        return [dict(r) for r in rows]


@app.get("/api/videos/{video_id}")
def get_video_details(video_id: int):
    with db.conn() as c:
        row = c.execute(
            """SELECT v.*, c.title AS course_title, c.instructor AS course_instructor
               FROM videos v
               LEFT JOIN courses c ON v.course_id = c.id
               WHERE v.id = ?""",
            (video_id,),
        ).fetchone()
        if not row:
            raise HTTPException(404, "Video not found")
        v = dict(row)
        quiz_row = c.execute("SELECT id FROM quizzes WHERE video_id = ?", (video_id,)).fetchone()
        v["quiz_id"] = quiz_row["id"] if quiz_row else None
        return v


@app.delete("/api/videos/{video_id}")
def delete_video(video_id: int, user: str = Depends(optional_user), x_user_role: str = Header(default="")):
    if x_user_role and x_user_role.strip().lower() != "teacher":
        raise HTTPException(403, "Permission denied: Only teachers can remove course videos.")

    with db.conn() as c:
        row = c.execute("SELECT * FROM videos WHERE id = ?", (video_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Video not found")

        # Safely remove uploaded video file from disk if present
        file_path_str = row["file_path"] or ""
        if "/api/media/videos/" in file_path_str:
            fname = file_path_str.split("/api/media/videos/")[-1].strip()
            disk_file = VIDEOS_DIR / fname
            if disk_file.is_file():
                try:
                    disk_file.unlink()
                except Exception:
                    pass

        # Cleanup dependent records
        c.execute("DELETE FROM quiz_attempts WHERE quiz_id IN (SELECT id FROM quizzes WHERE video_id = ?)", (video_id,))
        c.execute("DELETE FROM quizzes WHERE video_id = ?", (video_id,))
        c.execute("UPDATE resources SET video_id = NULL WHERE video_id = ?", (video_id,))
        c.execute("UPDATE chat_history SET video_id = NULL WHERE video_id = ?", (video_id,))
        c.execute("DELETE FROM videos WHERE id = ?", (video_id,))

    return {"ok": True, "message": f"Video #{video_id} deleted successfully."}


@app.post("/api/videos/upload")
async def upload_video(
    file: UploadFile = File(...),
    title: str = Form(...),
    course_id: Optional[int] = Form(None),
    new_course_title: Optional[str] = Form(None),
    new_course_desc: Optional[str] = Form(None),
    new_course_instructor: Optional[str] = Form(None),
    lesson_topic: Optional[str] = Form(None),
    duration: float = Form(0),
    user: str = Depends(current_user),
):
    safe_name = f"{int(time.time())}_{re.sub(r'[^A-Za-z0-9_.-]', '_', file.filename or 'lesson.mp4')}"
    file_path = VIDEOS_DIR / safe_name

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = file_path.stat().st_size

    dur_sec = duration
    if dur_sec <= 0:
        parsed_sec = media_utils.inspect_mp4_duration(file_path)
        if parsed_sec and parsed_sec > 0:
            dur_sec = parsed_sec
        else:
            dur_sec = max(30.0, round(file_size / (150 * 1024), 1))

    dur_display = media_utils.format_duration(dur_sec)

    clean_lesson_topic = (lesson_topic or "").strip()
    topic_header = f" [{clean_lesson_topic}]" if clean_lesson_topic else ""
    transcript_text = (
        f"00:00 - Overview of {title}{topic_header}\n"
        f"00:30 - Core principles and key mechanisms\n"
        f"01:15 - Practical applications and production best practices"
    )
    ai_summary = f"Comprehensive lecture on {title}{f' ({clean_lesson_topic})' if clean_lesson_topic else ''}. Covers principles and implementation."

    target_course_id = course_id
    assigned_course_title = ""

    with db.conn() as c:
        # If user specified a new custom course of their choice:
        if new_course_title and new_course_title.strip():
            c_title = new_course_title.strip()
            c_desc = (new_course_desc or "").strip() or f"Curated curriculum for {c_title}"
            c_inst = (new_course_instructor or "").strip() or "Course Instructor"
            
            existing_course = c.execute("SELECT id, title FROM courses WHERE LOWER(title) = LOWER(?)", (c_title,)).fetchone()
            if existing_course:
                target_course_id = existing_course["id"]
                assigned_course_title = existing_course["title"]
            else:
                cur_c = c.execute(
                    "INSERT INTO courses (title, description, instructor, thumbnail) VALUES (?, ?, ?, '/photo.jpg')",
                    (c_title, c_desc, c_inst),
                )
                target_course_id = cur_c.lastrowid
                assigned_course_title = c_title
        elif target_course_id:
            course_row = c.execute("SELECT id, title FROM courses WHERE id = ?", (target_course_id,)).fetchone()
            if course_row:
                assigned_course_title = course_row["title"]
            else:
                first = c.execute("SELECT id, title FROM courses ORDER BY id ASC LIMIT 1").fetchone()
                if first:
                    target_course_id = first["id"]
                    assigned_course_title = first["title"]
                else:
                    cur_c = c.execute(
                        "INSERT INTO courses (title, description, instructor, thumbnail) VALUES ('My Teaching Course', 'Custom teaching series', 'Course Instructor', '/photo.jpg')"
                    )
                    target_course_id = cur_c.lastrowid
                    assigned_course_title = "My Teaching Course"
        else:
            first = c.execute("SELECT id, title FROM courses ORDER BY id ASC LIMIT 1").fetchone()
            if first:
                target_course_id = first["id"]
                assigned_course_title = first["title"]
            else:
                cur_c = c.execute(
                    "INSERT INTO courses (title, description, instructor, thumbnail) VALUES ('My Teaching Course', 'Custom teaching series', 'Course Instructor', '/photo.jpg')"
                )
                target_course_id = cur_c.lastrowid
                assigned_course_title = "My Teaching Course"

        cur = c.execute(
            """INSERT INTO videos (course_id, title, filename, file_path, duration_seconds, duration_display, file_size, transcript_text, ai_summary, lesson_topic)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                target_course_id,
                title.strip(),
                file.filename or safe_name,
                f"/api/media/videos/{safe_name}",
                dur_sec,
                dur_display,
                file_size,
                transcript_text,
                ai_summary,
                clean_lesson_topic,
            ),
        )
        video_id = cur.lastrowid

        default_quiz = [
            {
                "id": 1,
                "question": f"What is the central focus of the lecture '{title}'?",
                "options": [
                    f"Understanding the core principles and practical applications of {title}",
                    "Ignoring standard methodologies and skipping verification",
                    "Memorizing surface details without understanding fundamentals",
                    "Applying techniques without structured planning",
                ],
                "answer": 0,
                "explanation": f"The video explicitly teaches the foundations and application of {title}.",
            },
            {
                "id": 2,
                "question": f"What is the best practice highlighted when applying {title}?",
                "options": [
                    "Validate concepts methodically using structured testing and continuous feedback",
                    "Execute workflows without any review or verification",
                    "Bypass core architectural guidelines and safety checks",
                    "Omit documentation and reproducible steps",
                ],
                "answer": 0,
                "explanation": "Structured validation and adherence to fundamentals ensure high-quality, reproducible results.",
            },
        ]
        c.execute(
            "INSERT INTO quizzes (video_id, title, questions) VALUES (?, ?, ?)",
            (video_id, f"Quick Quiz: {title}", db.jdump(default_quiz)),
        )

    return {
        "id": video_id,
        "course_id": target_course_id,
        "course_title": assigned_course_title,
        "lesson_topic": clean_lesson_topic,
        "title": title.strip(),
        "duration_seconds": dur_sec,
        "duration_display": dur_display,
        "file_path": f"/api/media/videos/{safe_name}",
        "file_size": file_size,
    }


@app.get("/api/media/videos/{filename}")
def stream_video(filename: str):
    file_path = VIDEOS_DIR / filename
    if not file_path.is_file():
        raise HTTPException(404, "Video file not found")
    return FileResponse(file_path, media_type="video/mp4")


# ---------- 2. Notes & PPT Resources (Downloadable + AI Grounded) ----------
# ---------- 2. Notes & PPT Resources (Downloadable + AI Grounded) ----------
@app.get("/api/resources")
def list_resources(course_id: Optional[int] = None, video_id: Optional[int] = None):
    with db.conn() as c:
        query = "SELECT * FROM resources"
        params = []
        conditions = []
        if video_id is not None:
            conditions.append("(video_id = ? OR video_id IS NULL)")
            params.append(video_id)
        if course_id is not None:
            conditions.append("(course_id = ? OR course_id IS NULL)")
            params.append(course_id)
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY id DESC"
        rows = c.execute(query, params).fetchall()
        res = []
        for r in rows:
            item = dict(r)
            item["has_text"] = bool(item.get("extracted_text"))
            item["download_url"] = f"/api/resources/download/{item['id']}"
            item.pop("extracted_text", None)
            res.append(item)
        return res


@app.post("/api/resources/upload")
async def upload_resource(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    course_id: Optional[int] = Form(None),
    video_id: Optional[int] = Form(None),
    user: str = Depends(current_user),
):
    ext = (Path(file.filename or "").suffix).lower().replace(".", "")
    safe_name = f"{int(time.time())}_{re.sub(r'[^A-Za-z0-9_.-]', '_', file.filename or 'notes.pdf')}"
    file_path = DOCS_DIR / safe_name

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = file_path.stat().st_size
    doc_title = title or file.filename or "Lecture Notes"
    extracted_text = media_utils.extract_document_text(file_path, ext or "pdf")

    # Safely resolve foreign keys
    valid_course_id: Optional[int] = None
    valid_video_id: Optional[int] = None

    with db.conn() as c:
        if course_id:
            c_row = c.execute("SELECT id FROM courses WHERE id = ?", (course_id,)).fetchone()
            if c_row:
                valid_course_id = course_id
        if not valid_course_id:
            c_first = c.execute("SELECT id FROM courses ORDER BY id ASC LIMIT 1").fetchone()
            if c_first:
                valid_course_id = c_first["id"]

        if video_id:
            v_row = c.execute("SELECT id FROM videos WHERE id = ?", (video_id,)).fetchone()
            if v_row:
                valid_video_id = video_id

        cur = c.execute(
            """INSERT INTO resources (course_id, video_id, title, filename, file_type, file_path, file_size, extracted_text)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                valid_course_id,
                valid_video_id,
                doc_title,
                file.filename or safe_name,
                ext or "pdf",
                str(file_path),
                file_size,
                extracted_text,
            ),
        )
        res_id = cur.lastrowid

    return {
        "id": res_id,
        "title": doc_title,
        "filename": file.filename,
        "file_type": ext,
        "file_size": file_size,
        "download_url": f"/api/resources/download/{res_id}",
        "extracted_preview": extracted_text[:300] if extracted_text else "",
    }


@app.get("/api/resources/download/{resource_id}")
def download_resource(resource_id: int):
    with db.conn() as c:
        row = c.execute("SELECT * FROM resources WHERE id = ?", (resource_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Resource not found")
        c.execute("UPDATE resources SET download_count = download_count + 1 WHERE id = ?", (resource_id,))

    file_path = Path(row["file_path"])
    if not file_path.is_file():
        file_path = Path("./public/notes.pdf")
        if not file_path.is_file():
            return JSONResponse({"content": row["extracted_text"] or "LearnSphere Study Notes"})

    return FileResponse(
        file_path,
        filename=row["filename"],
        media_type="application/octet-stream",
    )


@app.get("/api/resources/{resource_id}/view")
def view_resource(resource_id: int):
    with db.conn() as c:
        row = c.execute("SELECT * FROM resources WHERE id = ?", (resource_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Resource not found")
        item = dict(row)
        item["download_url"] = f"/api/resources/download/{item['id']}"
        return item


@app.delete("/api/resources/{resource_id}")
def delete_resource(resource_id: int, user: str = Depends(optional_user), x_user_role: str = Header(default="")):
    if x_user_role and x_user_role.strip().lower() != "teacher":
        raise HTTPException(403, "Permission denied: Only teachers can delete lecture notes.")
    with db.conn() as c:
        row = c.execute("SELECT * FROM resources WHERE id = ?", (resource_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Resource not found")
        if row["file_path"]:
            try:
                p = Path(row["file_path"])
                if p.is_file():
                    p.unlink()
            except Exception:
                pass
        c.execute("DELETE FROM resources WHERE id = ?", (resource_id,))
    return {"ok": True, "message": f"Resource #{resource_id} deleted successfully."}


# ---------- 3. AI Learning Chat (Grounded in Video & Notes) ----------
@app.post("/api/chat")
async def chat(body: ChatIn, user: str = Depends(ai_limit)):
    video_duration = 0.0
    video_title = "Lesson Video"
    video_transcript = ""

    stored_video_id = None
    with db.conn() as c:
        if body.videoId:
            v_row = c.execute("SELECT * FROM videos WHERE id = ?", (body.videoId,)).fetchone()
            if v_row:
                stored_video_id = v_row["id"]
                video_duration = v_row["duration_seconds"]
                video_title = v_row["title"]
                video_transcript = v_row["transcript_text"] or ""

        notes_rows = c.execute("SELECT title, extracted_text FROM resources WHERE extracted_text != '' LIMIT 3").fetchall()
        notes_context = "\n\n".join(f"[{r['title']}]: {r['extracted_text'][:2000]}" for r in notes_rows)

    combined_context = f"{body.context}\n\n{video_transcript}\n\n{notes_context}".strip()

    answer = await ai.tutor_answer(
        question=body.question,
        context=combined_context,
        lesson_time=body.lessonTime,
        video_duration=video_duration,
        video_title=video_title,
    )

    with db.conn() as c:
        c.execute(
            "INSERT INTO chat_history (user_id, question, answer, video_id, lesson_time) VALUES (?, ?, ?, ?, ?)",
            (user, body.question, answer, stored_video_id, body.lessonTime),
        )

    return {"answer": answer, "lessonTime": body.lessonTime}


# ---------- 3b. Natural Neural Hindi Text-To-Speech (Single Natural Voice or Cloned Personal Voice) ----------
@app.post("/api/voice/tts")
async def generate_tts(body: TTSIn):
    raw_text = (body.text or "").strip()
    if not raw_text:
        raise HTTPException(400, "Text is required")

    # Clean markdown, timestamps, code blocks for crystal clear human-like speech
    clean = re.sub(r"```[\s\S]*?```", "Code block skipped.", raw_text)
    clean = re.sub(r"`([^`]+)`", r"\1", clean)
    clean = re.sub(r"\*\*([^*]+)\*\*", r"\1", clean)
    clean = re.sub(r"[*_#~>]", "", clean)
    clean = re.sub(r"\[\d{1,2}:\d{2}\]", "", clean)
    clean = re.sub(r"https?://\S+", "", clean).strip()
    clean = clean[:3500]

    # 1. Native User Voice Cloning (from backend/app/voices/my_voice.wav)
    voices_dir = Path(__file__).resolve().parent / "voices"
    wav_voice_file = voices_dir / "my_voice.wav"

    # Auto-convert m4a/mp3 if my_voice.wav is not yet generated
    if not wav_voice_file.exists():
        for alt_name in ("my_voice.m4a", "my_voice.mp3", "Recording (2).m4a"):
            alt_path = voices_dir / alt_name
            if alt_path.exists():
                try:
                    import subprocess
                    import imageio_ffmpeg  # type: ignore # pyrefly: ignore[missing-import]
                    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
                    subprocess.run(
                        [ffmpeg_exe, "-y", "-i", str(alt_path), "-ar", "22050", "-ac", "1", str(wav_voice_file)],
                        capture_output=True,
                        check=False,
                    )
                    break
                except Exception as ex:
                    logger.warning(f"Audio conversion failed: {ex}")

    # Check local cache for instant playback
    import hashlib
    text_hash = hashlib.sha256(clean.encode("utf-8")).hexdigest()[:16]
    cache_dir = voices_dir / "cache"
    cache_dir.mkdir(exist_ok=True)
    cached_wav = cache_dir / f"{text_hash}.wav"
    if cached_wav.exists() and cached_wav.stat().st_size > 1000:
        with open(cached_wav, "rb") as f:
            return Response(content=f.read(), media_type="audio/wav")

    # If native user voice sample exists, clone with free XTTS
    if wav_voice_file.exists() and wav_voice_file.stat().st_size > 1000:
        try:
            from gradio_client import Client, handle_file  # type: ignore # pyrefly: ignore[missing-import]
            client = Client("Nymbo/Voice-Clone-Multilingual", download_files=False)
            cloned_audio_path = client.predict(
                text=clean[:600],
                speaker_wav=handle_file(str(wav_voice_file)),
                language="en",
                api_name="/predict",
            )
            if cloned_audio_path and os.path.exists(cloned_audio_path):
                with open(cloned_audio_path, "rb") as f:
                    audio_bytes = f.read()
                if len(audio_bytes) > 500:
                    with open(cached_wav, "wb") as f:
                        f.write(audio_bytes)
                    return Response(content=audio_bytes, media_type="audio/wav")
        except Exception as e:
            logger.warning(f"Native voice clone synthesis error: {e}, falling back to neural voice")

    # 2. Check if user configured ElevenLabs or custom API key
    eleven_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    eleven_voice_id = os.getenv("ELEVENLABS_VOICE_ID", "").strip() or os.getenv("CUSTOM_VOICE_ID", "").strip()

    if eleven_key and eleven_voice_id:
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                res = await client.post(
                    f"https://api.elevenlabs.io/v1/text-to-speech/{eleven_voice_id}",
                    headers={
                        "xi-api-key": eleven_key,
                        "Content-Type": "application/json",
                        "Accept": "audio/mpeg",
                    },
                    json={
                        "text": clean,
                        "model_id": "eleven_multilingual_v2",
                        "voice_settings": {
                            "stability": 0.5,
                            "similarity_boost": 0.8,
                        },
                    },
                )
                if res.status_code == 200 and len(res.content) > 100:
                    return Response(content=res.content, media_type="audio/mpeg")
                else:
                    logger.warning(f"ElevenLabs voice clone failed ({res.status_code}): {res.text[:100]}, falling back to local neural voice")
        except Exception as e:
            logger.warning(f"Custom voice cloning exception: {e}, falling back to local neural voice")

    # Single unified natural Hindi voice (Madhur)
    chosen_voice = "hi-IN-MadhurNeural"

    try:
        import edge_tts  # type: ignore # pyrefly: ignore[missing-import]
        communicate = edge_tts.Communicate(clean, chosen_voice, rate="-2%")
        audio_chunks = []
        async for chunk in communicate.stream():
            if chunk.get("type") == "audio":
                data = chunk.get("data")
                if data:
                    audio_chunks.append(data)
        audio_bytes = b"".join(audio_chunks)
        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as e:
        logger.warning(f"Neural TTS failed: {e}")
        raise HTTPException(500, f"Neural TTS failed: {e}")


# ---------- 4. Auto AI Quiz from Video ----------
@app.get("/api/quiz/video/{video_id}")
async def get_quiz_for_video(video_id: int):
    with db.conn() as c:
        row = c.execute("SELECT * FROM quizzes WHERE video_id = ?", (video_id,)).fetchone()
        if row:
            return {
                "id": row["id"],
                "video_id": row["video_id"],
                "title": row["title"],
                "questions": db.jload(row["questions"]),
            }

        v_row = c.execute("SELECT * FROM videos WHERE id = ?", (video_id,)).fetchone()
        if not v_row:
            raise HTTPException(404, "Video not found")

        v_title = v_row["title"]
        v_transcript = v_row["transcript_text"] or ""
        v_dur = v_row["duration_seconds"]

    generated = await ai.generate_quiz_from_video(v_title, v_transcript, "", v_dur)
    quiz_title = generated.get("title", f"Quick Quiz: {v_title}")
    questions = generated.get("questions", [])

    with db.conn() as c:
        cur = c.execute(
            "INSERT INTO quizzes (video_id, title, questions) VALUES (?, ?, ?)",
            (video_id, quiz_title, db.jdump(questions)),
        )
        quiz_id = cur.lastrowid

    return {
        "id": quiz_id,
        "video_id": video_id,
        "title": quiz_title,
        "questions": questions,
    }


@app.post("/api/quiz/generate")
async def trigger_quiz_generation(video_id: int = Form(...), user: str = Depends(ai_limit)):
    with db.conn() as c:
        v_row = c.execute("SELECT * FROM videos WHERE id = ?", (video_id,)).fetchone()
        if not v_row:
            raise HTTPException(404, "Video not found")

        n_rows = c.execute("SELECT extracted_text FROM resources WHERE video_id = ?", (video_id,)).fetchall()
        notes_str = "\n".join(r["extracted_text"] for r in n_rows if r["extracted_text"])

    generated = await ai.generate_quiz_from_video(v_row["title"], v_row["transcript_text"] or "", notes_str, v_row["duration_seconds"])
    questions = generated.get("questions", [])

    with db.conn() as c:
        c.execute("DELETE FROM quizzes WHERE video_id = ?", (video_id,))
        cur = c.execute(
            "INSERT INTO quizzes (video_id, title, questions) VALUES (?, ?, ?)",
            (video_id, generated.get("title", f"Quick Quiz: {v_row['title']}"), db.jdump(questions)),
        )
        quiz_id = cur.lastrowid

    return {"id": quiz_id, "video_id": video_id, "title": generated.get("title"), "questions": questions}


@app.post("/api/quiz/submit")
def submit_quiz(body: QuizSubmitIn, user: str = Depends(current_user)):
    with db.conn() as c:
        row = c.execute("SELECT * FROM quizzes WHERE id = ?", (body.quiz_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Quiz not found")

        questions = db.jload(row["questions"]) or []
        total = len(questions)
        correct_count = 0
        feedback = []

        for i, q in enumerate(questions):
            selected = body.answers[i] if i < len(body.answers) else -1
            is_correct = (selected == q.get("answer"))
            if is_correct:
                correct_count += 1
            feedback.append({
                "question_id": q.get("id", i + 1),
                "selected": selected,
                "correct_answer": q.get("answer"),
                "is_correct": is_correct,
                "explanation": q.get("explanation", ""),
            })

        c.execute(
            "INSERT INTO quiz_attempts (user_id, quiz_id, score, total_questions, answers) VALUES (?, ?, ?, ?, ?)",
            (user, body.quiz_id, correct_count, total, db.jdump(body.answers)),
        )

    score_percent = round((correct_count / total * 100)) if total > 0 else 0
    return {
        "quiz_id": body.quiz_id,
        "score": correct_count,
        "total": total,
        "percentage": score_percent,
        "feedback": feedback,
    }


# ---------- 5. Realistic Mock Interview Engine ----------
@app.post("/api/interview/start")
async def start_interview(body: StartIn, user: str = Depends(ai_limit)):
    questions = await ai.make_questions(body.role, body.topic, body.difficulty, body.num_questions)
    with db.conn() as c:
        cur = c.execute(
            """INSERT INTO interview_sessions (user_id, role, topic, difficulty, questions, status)
               VALUES (?, ?, ?, ?, ?, 'in_progress')""",
            (user, body.role, body.topic, body.difficulty, db.jdump(questions)),
        )
        session_id = cur.lastrowid
    return {"session_id": session_id, "questions": questions}


@app.post("/api/interview/{session_id}/answer")
async def answer_interview_question(
    session_id: int, body: AnswerIn, user: str = Depends(ai_limit)
):
    with db.conn() as c:
        sess = c.execute(
            "SELECT * FROM interview_sessions WHERE id = ? AND user_id = ?",
            (session_id, user),
        ).fetchone()
        if not sess:
            raise HTTPException(404, "Session not found")
        if sess["status"] == "finished":
            raise HTTPException(409, "Interview already finished")

        questions = db.jload(sess["questions"]) or []
        if body.question_index < 0 or body.question_index >= len(questions):
            raise HTTPException(422, "Question index out of range")
        question = questions[body.question_index]

    fb = await ai.evaluate_answer(sess["role"], sess["topic"], question, body.answer)

    with db.conn() as c:
        c.execute(
            """INSERT INTO interview_answers (session_id, question_index, answer, feedback, rating)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(session_id, question_index) DO UPDATE SET
                 answer = excluded.answer,
                 feedback = excluded.feedback,
                 rating = excluded.rating,
                 created_at = CURRENT_TIMESTAMP""",
            (session_id, body.question_index, body.answer, db.jdump(fb), fb["rating"]),
        )

    return {"question_index": body.question_index, "feedback": fb}


@app.post("/api/interview/{session_id}/finish")
def finish_interview(session_id: int, user: str = Depends(current_user)):
    with db.conn() as c:
        sess = c.execute(
            "SELECT * FROM interview_sessions WHERE id = ? AND user_id = ?",
            (session_id, user),
        ).fetchone()
        if not sess:
            raise HTTPException(404, "Session not found")

        answers = c.execute(
            "SELECT * FROM interview_answers WHERE session_id = ? ORDER BY question_index ASC",
            (session_id,),
        ).fetchall()

        if not answers:
            raise HTTPException(409, "Answer at least one question before finishing.")

        ratings = [r["rating"] for r in answers]
        avg = round(sum(ratings) / len(ratings), 1)

        all_strengths = []
        all_improvements = []
        for a in answers:
            fb = db.jload(a["feedback"]) or {}
            all_strengths.extend(fb.get("strengths", []))
        rubric_practice = []
        for a in answers:
            fb = db.jload(a["feedback"]) or {}
            for k in ("relevance", "clarity", "depth"):
                if fb.get(k, 5) < 4 and k not in rubric_practice:
                    rubric_practice.append(k)

        practice_areas = rubric_practice if rubric_practice else (list(dict.fromkeys(all_improvements))[:3] or ["Deepen trade-off analysis"])

        summary = {
            "overall_summary": f"Completed mock interview for {sess['role']}. Demonstrated solid technical foundation with clear potential for senior evaluation.",
            "top_strengths": list(dict.fromkeys(all_strengths))[:3] or ["Direct answers", "Clear communication"],
            "practice_areas": practice_areas,
            "recommended_topics": [sess["role"], sess["topic"] or "System Architecture & Design", "Edge-Case Testing"],
            "average_rating": avg,
            "answered": len(answers),
            "total_questions": len(db.jload(sess["questions"]) or []),
        }

        c.execute(
            "UPDATE interview_sessions SET status = 'finished', summary = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?",
            (db.jdump(summary), session_id),
        )

    return {"status": "finished", "summary": summary}


@app.get("/api/interview/sessions")
def list_interview_sessions(user: str = Depends(current_user)):
    with db.conn() as c:
        rows = c.execute(
            """SELECT s.id, s.role, s.topic, s.difficulty, s.status, s.created_at,
                      COUNT(a.id) AS answered, AVG(a.rating) AS avg_rating
               FROM interview_sessions s
               LEFT JOIN interview_answers a ON s.id = a.session_id
               WHERE s.user_id = ?
               GROUP BY s.id
               ORDER BY s.id DESC
               LIMIT 25""",
            (user,),
        ).fetchall()

        return {
            "items": [
                {
                    "id": r["id"],
                    "role": r["role"],
                    "topic": r["topic"],
                    "difficulty": r["difficulty"],
                    "status": r["status"],
                    "created_at": r["created_at"],
                    "answered": r["answered"],
                    "avg_rating": round(r["avg_rating"], 1) if r["avg_rating"] else None,
                }
                for r in rows
            ]
        }


@app.get("/api/interview/{session_id}")
def get_interview_detail(session_id: int, user: str = Depends(current_user)):
    with db.conn() as c:
        sess = c.execute(
            "SELECT * FROM interview_sessions WHERE id = ? AND user_id = ?",
            (session_id, user),
        ).fetchone()
        if not sess:
            raise HTTPException(404, "Session not found")

        answers = c.execute(
            "SELECT question_index, answer, feedback FROM interview_answers WHERE session_id = ? ORDER BY question_index ASC",
            (session_id,),
        ).fetchall()

        return {
            "session_id": sess["id"],
            "role": sess["role"],
            "topic": sess["topic"],
            "difficulty": sess["difficulty"],
            "status": sess["status"],
            "created_at": sess["created_at"],
            "questions": db.jload(sess["questions"]),
            "answers": [
                {
                    "question_index": a["question_index"],
                    "answer": a["answer"],
                    "feedback": db.jload(a["feedback"]),
                }
                for a in answers
            ],
            "summary": db.jload(sess["summary"]),
        }


# ---------- Static Frontend Serving (Unified Single Localhost) ----------
DIST_DIR = Path(os.getenv("FRONTEND_DIST", str(Path(__file__).resolve().parent.parent.parent / "dist")))
ASSETS_DIR = DIST_DIR / "assets"
if not ASSETS_DIR.is_dir():
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")


@app.get("/")
def serve_root():
    index_file = DIST_DIR / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)
    return HTMLResponse(
        "<html><body style='font-family:sans-serif;padding:40px;background:#0e1222;color:#f2f4ff;text-align:center;'>"
        "<h1>LearnSphere AI Unified Server Running</h1>"
        "<p>Frontend bundle (<code>dist/index.html</code>) not found.</p>"
        "<p>Run <code>npm run build</code> to generate the frontend assets.</p>"
        "<p><a href='/docs' style='color:#6c5ce7;'>Open API Documentation (/docs)</a></p>"
        "</body></html>",
        status_code=200,
    )


@app.get("/{full_path:path}")
def serve_frontend(full_path: str):
    if full_path == "api" or full_path.startswith("api/"):
        raise HTTPException(404, "API route not found")
    target = DIST_DIR / full_path
    if target.is_file():
        return FileResponse(target)
    index_file = DIST_DIR / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)
    raise HTTPException(404, "Page not found")


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    print("\n" + "=" * 60)
    print("  LearnSphere AI -- Unified Localhost Server")
    print(f"  -> Application (Frontend + Backend): http://{host}:{port}")
    print(f"  -> API Documentation: http://{host}:{port}/docs")
    print("=" * 60 + "\n")
    import_target = "backend.app.main:app" if (Path.cwd() / "backend").is_dir() else "main:app"
    uvicorn.run(import_target, host=host, port=port, reload=True)


