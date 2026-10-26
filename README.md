---
title: LearnSphere AI
emoji: 🎓
colorFrom: indigo
colorTo: purple
sdk: docker
pinned: false
app_port: 7860
---

# LearnSphere AI: API, Deployment, and Sample Data

This document covers only the API, deployment, and sample data present in the source archive. The API details below are based on `LearnSphere/backend/app/main.py`, `backend/app/ai.py`, and `backend/app/db.py`; sample content is primarily defined in `LearnSphere/src/App.tsx`.

## 1. API documentation

The backend is a FastAPI application (`LearnSphere/backend/app/main.py`), titled **LearnSphere AI API**, version `2.0`. API routes use the `/api` prefix and return JSON. When running the backend locally, FastAPI's interactive API page is normally available at `http://127.0.0.1:8000/docs` and its OpenAPI schema at `/openapi.json`.

### Identity and request rules

- Except for `GET /api/health`, every route requires the `X-User-Id` request header. It is an anonymous device/browser identifier, not an account or login. It must contain 8–64 characters from `A-Z`, `a-z`, `0-9`, `_`, or `-`.
- AI routes (`POST /api/chat`, interview start, answer, finish) are rate-limited per user ID. The default is 40 AI requests per rolling 10-minute window; `RATE_LIMIT_PER_10MIN` changes that limit. This counter is held in process memory.
- Request validation errors use HTTP `422`; their body has the form `{"error":"..."}`. Other handled API errors also use an `error` string. Missing/invalid identity is `400`; a session belonging to a different identity is reported as `404`.
- AI-powered routes require `GEMINI_API_KEY`; without it they return an AI configuration error. The backend calls Gemini, with `GEMINI_MODELS` (comma-separated) or the single-model fallback `GEMINI_MODEL` (default `gemini-2.5-flash`).

### Routes

| Method and path | Identity required | Purpose / body | Success response |
|---|---|---|---|
| `GET /api/health` | No | Check API and AI configuration. | `{"ok":true,"aiConfigured":boolean,"model":string|null}` |
| `POST /api/chat` | Yes; AI limit | Tutor question. JSON: `{"question":"...","context":"...","lessonTime":0}`. `question` is 1–4,000 chars, `context` up to 20,000 chars, `lessonTime` 0–100,000 (defaults: empty context and 0). | `{"answer":"...","mode":"live-ai"}`. Successful questions and answers are saved to history. |
| `GET /api/history` | Yes | Read latest chat history for this identity. | `{"items":[{"question":"...","answer":"...","created_at":"..."}]}`; maximum 30, newest first. |
| `POST /api/interview/start` | Yes; AI limit | Generate an interview. JSON: `{"role":"...","topic":"...","difficulty":"intermediate","num_questions":5}`. `role` 2–80 chars; `topic` up to 120; difficulty is `beginner`, `intermediate`, or `advanced`; count is 1, 3, 5, or 7 (default 5). | `{"session_id":number,"role":"...","topic":"...","difficulty":"...","questions":["..."]}` |
| `POST /api/interview/{sid}/answer` | Yes; AI limit | Evaluate one answer. JSON: `{"question_index":0,"answer":"..."}`. Index is zero-based (0–20); answer 1–4,000 chars. | `{"question_index":0,"feedback":{...}}`. Feedback contains `relevance`, `clarity`, `depth` (scores 1–5), calculated `rating`, `strengths`, `improvements`, and `model_answer_outline`. |
| `POST /api/interview/{sid}/finish` | Yes; AI limit | Finish a session after at least one answer. No body required. | Session detail with questions, saved answers and feedback, status, and summary. Summary includes `overall_summary`, `top_strengths`, `practice_areas`, `recommended_topics`, `average_rating`, `answered`, and `total_questions`. A finished session can be fetched again. |
| `GET /api/interview/sessions` | Yes | List this identity's recent interview sessions. | `{"items":[...]}`; maximum 20, newest first. Rows include role, topic, difficulty, status, creation time, answer count, and average rating. |
| `GET /api/interview/{sid}` | Yes | Fetch one session owned by this identity. | Session detail: `session_id`, role, topic, difficulty, status, creation time, questions, answers and summary. |
| `GET /api/stats` | Yes | Read activity totals for this identity. | `questions_asked`, `interviews_started`, `interviews_finished`, `answers_reviewed`, `average_rating`, `focus_areas`. |
| `DELETE /api/me/data` | Yes | Delete this identity's chat history and interview sessions (answers cascade with their session). | `{"ok":true}` |

**Example chat request** (replace the ID with an allowed 8–64 character identifier):

```http
POST /api/chat
Content-Type: application/json
X-User-Id: demo-user-01

{"question":"What is supervised learning?","context":"","lessonTime":0}
```

Other notable statuses include `409` when finishing an interview with no saved answers or answering an already finished interview, `422` for invalid fields or an out-of-range question index, and `429` when the AI request limit is reached. Upstream AI failures are returned as an `error` message with an appropriate `502`, `503`, or `429` status.

## 2. Deployment instructions

### Local development

The frontend package and Vite configuration are in `LearnSphere/`. The backend is FastAPI in `LearnSphere/backend/`. The Vite dev server proxies `/api` to `http://127.0.0.1:8000`.

1. Install Node.js and Python (the included README specifies Python 3.11 or newer).
2. In `LearnSphere/`, install frontend packages and start Vite:

   ```bash
   npm install
   npm run dev
   ```

3. In a second terminal, from the same `LearnSphere/` directory, create/activate a Python virtual environment and install backend requirements:

   ```bash
   python -m venv .venv
   # Windows PowerShell: .venv\Scripts\Activate.ps1
   # macOS/Linux: source .venv/bin/activate
   pip install -r requirements.txt
   pip install -r backend/requirements.txt
   ```

4. Set `GEMINI_API_KEY` in that backend terminal, then start the API:

   ```bash
   # Windows PowerShell
   $env:GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"
   # macOS/Linux
   export GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

   uvicorn backend.app.main:app --reload --port 8000
   ```

   Optional settings: `GEMINI_MODELS` (comma-separated model priority list), `GEMINI_MODEL` (single model if `GEMINI_MODELS` is absent), `RATE_LIMIT_PER_10MIN`, `CORS_ORIGINS` (comma-separated origins), `DATABASE_PATH` (SQLite file path), and `FRONTEND_DIST` (built frontend directory).

### Vercel configuration in the archive

The archive includes **two** configuration files:

- `LearnSphere/vercel.json` defines a Vite frontend service and a FastAPI backend service, routes `/api` and `/api/*` to the backend, and sends other paths to the frontend. Its backend entry point is `app.main:app`.
- The repository-level `vercel.json` also defines two services, but its catch-all rewrite sends **every** path to the backend. That conflicts with the nested configuration's frontend routing and with the intended static frontend behavior described in the backend comments.

Before deployment, choose one Vercel project root/configuration and ensure the deployed rewrites route `/api/*` to FastAPI and non-API paths to the Vite frontend. The checked-in configs do not establish a single unambiguous Vercel project-root choice; the original `LearnSphere/README.md` describes importing the folder containing `package.json` and `vercel.json` as the project root. Confirm the routes with the deployed app rather than assuming the repository-level catch-all is correct.

For the `LearnSphere/` configuration's two-service setup, the included project README instructs you to import the source into Vercel, use the Vite build (`npm run build`, output `dist`), then set these server-side environment variables in Vercel and redeploy:

- `GEMINI_API_KEY` — required for live AI.
- `GEMINI_MODELS` — optional comma-separated model list; the README example is `gemini-2.5-flash,gemini-2.0-flash`.
- If `GEMINI_MODELS` is omitted, `GEMINI_MODEL` is supported (defaults in code to `gemini-2.5-flash`).

Keep the Gemini key server-side; do not put it in a `VITE_` variable or frontend code. The backend selects `/tmp/learnsphere.db` when `VERCEL` is set, unless `DATABASE_PATH` overrides it. Vercel's filesystem is ephemeral, so this SQLite storage is not durable and activity history may reset. No hosted persistent database configuration is included in this archive.

## 3. Sample dataset used in the project

There is **no separate downloadable dataset, CSV/JSON seed file, SQL seed script, or database dump** in the archive. Instead, the prototype's sample learning content and quiz are embedded in the frontend source (`LearnSphere/src/App.tsx`). It is demo/course content, not a training dataset for an ML model.

Included sample content visible in the source:

- A supervised-learning lesson with a seven-entry illustrative transcript (timestamps 00:00 through 01:36) covering labelled examples, classification vs regression, and train/test data. The matching local lesson video assets are `LearnSphere/public/ml-lesson.mp4` and `.webm`.
- Three additional lesson entries with short in-code summaries/transcript notes: neural networks, gradient descent, and backpropagation. Their video IDs point to YouTube embeds; those videos are not packaged as local sample files.
- A fixed three-question supervised-learning quiz with answer options, correct-option indices, and explanations. Its questions cover labelled training data, house-price regression, and the purpose of a test set.
- The resource library displays three sample labels (“ML Foundations — Course Notes.pdf”, “Supervised Learning — Slides.pptx”, and “Key Terms — Study Notes.txt”). These are UI demo entries; matching PDF/PPTX/TXT files are not included in the archive. The document preview contains illustrative sample text in the frontend.
- The interface also contains starter activity/history examples. These are frontend demo state and should not be mistaken for persisted seed records.

Separately, the backend creates an empty SQLite database and schema on startup. It stores real chat questions/answers, interview sessions, and interview answers created during use; the archive contains no pre-populated rows. The schema is in `LearnSphere/backend/app/db.py` (`chat_history`, `interview_sessions`, and `interview_answers`).
