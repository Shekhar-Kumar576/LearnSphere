"""SQLite storage: courses, videos, resources, quizzes, chat history, and mock-interview sessions."""
import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

def _resolve_db_path() -> str:
    custom = os.getenv("DATABASE_PATH")
    if custom:
        return custom
    if os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
        return "/tmp/learnsphere.db"
    try:
        Path("./data").mkdir(parents=True, exist_ok=True)
        return "./data/app.db"
    except OSError:
        return "/tmp/learnsphere.db"

DB_PATH = _resolve_db_path()

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',  -- 'student' or 'teacher'
  avatar_url TEXT DEFAULT '',
  provider TEXT NOT NULL DEFAULT 'email', -- 'email' or 'google'
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  instructor TEXT DEFAULT 'Instructor',
  thumbnail TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  duration_seconds REAL NOT NULL DEFAULT 0,
  duration_display TEXT NOT NULL DEFAULT '00:00',
  file_size INTEGER NOT NULL DEFAULT 0,
  transcript_text TEXT DEFAULT '',
  ai_summary TEXT DEFAULT '',
  lesson_topic TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  video_id INTEGER REFERENCES videos(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,           -- 'pdf', 'pptx', 'ppt', 'docx', 'notes'
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  extracted_text TEXT DEFAULT '',
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quizzes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  questions TEXT NOT NULL,          -- JSON list of { id, question, options: [], answer: int, explanation: str }
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  answers TEXT NOT NULL,            -- JSON list of selected option indices
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  video_id INTEGER REFERENCES videos(id) ON DELETE SET NULL,
  lesson_time REAL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interview_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL,
  questions TEXT NOT NULL,          -- JSON list of question strings
  status TEXT NOT NULL DEFAULT 'in_progress',
  summary TEXT,                     -- JSON, filled on finish
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS interview_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  question_index INTEGER NOT NULL,
  answer TEXT NOT NULL,
  feedback TEXT NOT NULL,           -- JSON
  rating REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, question_index)
);

CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_history(user_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_sess_user ON interview_sessions(user_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_videos_course ON videos(course_id);
CREATE INDEX IF NOT EXISTS idx_res_course ON resources(course_id);
CREATE INDEX IF NOT EXISTS idx_quiz_video ON quizzes(video_id);
"""


@contextmanager
def conn():
    c = sqlite3.connect(DB_PATH, timeout=10)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys = ON")
    try:
        yield c
        c.commit()
    finally:
        c.close()


def seed_defaults(c: sqlite3.Connection):
    """Seed default courses if database is newly initialized."""
    row = c.execute("SELECT COUNT(*) as cnt FROM courses").fetchone()
    if row and row["cnt"] == 0:
        c.execute(
            """INSERT INTO courses (id, title, description, instructor, thumbnail) 
               VALUES (1, 'Machine Learning Foundations', 'Deep dive into core ML principles, gradient descent, and neural architectures.', 'Dr. Sarah Chen', '/photo.jpg')"""
        )
        c.execute(
            """INSERT INTO courses (id, title, description, instructor, thumbnail) 
               VALUES (2, 'Python Programming Fundamentals', 'Master Python syntax, object-oriented design, data pipelines, and async workflows.', 'Prof. Alex Rivera', '/photo.jpg')"""
        )
        c.execute(
            """INSERT INTO courses (id, title, description, instructor, thumbnail) 
               VALUES (3, 'Generative AI and RAG', 'Hands-on guide to LLMs, embeddings, vector databases, and retrieval augmented generation.', 'AI Research Group', '/photo.jpg')"""
        )


def init_db() -> None:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    with conn() as c:
        c.executescript(SCHEMA)
        # Idempotent migration for lesson_topic column
        try:
            c.execute("ALTER TABLE videos ADD COLUMN lesson_topic TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass
        seed_defaults(c)


def jdump(v) -> str:
    return json.dumps(v, ensure_ascii=False)


def jload(s):
    return json.loads(s) if s else None


# ── User Account & Auth Operations ───────────────────────────────────────────
import hashlib
import secrets


def hash_password(password: str) -> str:
    """Secure PBKDF2 password hasher with 100,000 iterations and unique random salt."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
    return f"{salt}:{key.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    """Verify raw password against stored salt:hash."""
    if not hashed or ":" not in hashed:
        return False
    salt, stored_key = hashed.split(":", 1)
    new_key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
    return secrets.compare_digest(new_key.hex(), stored_key)


def get_user_by_email(email: str):
    """Retrieve user dictionary by case-insensitive email address."""
    clean_email = email.strip().lower()
    with conn() as c:
        row = c.execute("SELECT * FROM users WHERE LOWER(email) = ?", (clean_email,)).fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: int):
    """Retrieve user dictionary by integer primary key."""
    with conn() as c:
        row = c.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None


def create_user(email: str, password: str, name: str, role: str = "student", avatar_url: str = ""):
    """Create a new user account with hashed password."""
    clean_email = email.strip().lower()
    pw_hash = hash_password(password)
    with conn() as c:
        cur = c.execute(
            """INSERT INTO users (email, password_hash, name, role, avatar_url, provider)
               VALUES (?, ?, ?, ?, ?, 'email')""",
            (clean_email, pw_hash, name.strip(), role, avatar_url),
        )
        user_id = cur.lastrowid
        row = c.execute("SELECT id, email, name, role, avatar_url, provider, created_at FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row)


def upsert_google_user(email: str, name: str, role: str = "student", avatar_url: str = ""):
    """Find or create a user signed in via Google OAuth."""
    clean_email = email.strip().lower()
    with conn() as c:
        existing = c.execute("SELECT * FROM users WHERE LOWER(email) = ?", (clean_email,)).fetchone()
        if existing:
            # Role is IMMUTABLE once registered in the database! Never update role for existing accounts.
            c.execute(
                "UPDATE users SET name = COALESCE(NULLIF(?, ''), name), avatar_url = COALESCE(NULLIF(?, ''), avatar_url) WHERE id = ?",
                (name, avatar_url, existing["id"]),
            )
            row = c.execute("SELECT id, email, name, role, avatar_url, provider, created_at FROM users WHERE id = ?", (existing["id"],)).fetchone()
            return dict(row)

        cur = c.execute(
            """INSERT INTO users (email, password_hash, name, role, avatar_url, provider)
               VALUES (?, '', ?, ?, ?, 'google')""",
            (clean_email, name.strip() or "Google User", role, avatar_url),
        )
        user_id = cur.lastrowid
        row = c.execute("SELECT id, email, name, role, avatar_url, provider, created_at FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row)

