# LearnSphere AI

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Frontend: React + Vite](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-blue)](https://react.dev/)
[![Backend: FastAPI](https://img.shields.io/badge/Backend-FastAPI-ff69b4)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)

AI-powered interactive learning assistant with mock interview extension, unified on a single localhost link.

---

## 📚 Overview

LearnSphere AI is a full-stack web application that provides:

- **Teaching Video Upload & Streaming** - Upload, manage, and stream teaching videos
- **AI-Grounded Learning Chat** - Ask questions about videos and lecture notes, get AI answers with timestamps
- **Auto AI Quiz Generator** - Generate multiple-choice quizzes from video content
- **Realistic Mock Interview Engine** - Conduct technical interviews with calibrated evaluation
- **Resource Center** - Upload and download lecture notes, PPTs, PDFs with AI text extraction
- **Multi-Account Support** - Google account switching with role persistence

The entire app runs on **one localhost**: `http://127.0.0.1:8000` (frontend + backend unified).

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript 5.7, Vite 8, Tailwind CSS v4 |
| **Backend** | FastAPI, Uvicorn, SQLite |
| **AI/ML** | Gemini API / OpenAI API / Edge TTS / XTTS (voice cloning) |
| **Media** | pypdf, python-pptx, custom MP4 parser, ffmpeg |
| **Testing** | pytest + TestClient |
| **Deployment** | Docker (multi-stage), Vercel |

---

## 🚀 Quick Start (Hackathon Ready)

### For Windows Users (Recommended) - Simple One-Click Launch

1. **Double-click `run.bat`** in the LearnSphere folder
2. The script will:
   - Check Python and Node.js installation
   - Prompt you for your Gemini API key (get one free at https://aistudio.google.com/app/apikey)
   - Install dependencies automatically if needed
   - Start the application
3. Browser will open automatically at `http://127.0.0.1:8000`
4. **Important**: Keep the command window open while using the app

### Alternative: Manual Setup

#### Prerequisites

- **Node.js** >= 20 (with npm)
- **Python** >= 3.11

#### Step 1: Install Dependencies

```bash
# Frontend dependencies
npm install

# Backend dependencies
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
pip install -r backend/requirements.txt
```

#### Step 2: Set Environment Variables

Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey) or [OpenAI Platform](https://platform.openai.com/api-keys).

```bash
# Set your API key (or run in demo mode without one)
set GEMINI_API_KEY="your_gemini_api_key_here"
# OR
set OPENAI_API_KEY="your_openai_api_key_here"
```

#### Step 3: Run the Application

```bash
# Terminal 1: Start backend
cd backend
call .venv\Scripts\activate
uvicorn backend.app.main:app --reload --port 8000

# Terminal 2: Start frontend
cd ..
npm run dev
```

#### Step 4: Access the Application

Open your browser to:
```
http://127.0.0.1:8000
```

API Documentation available at: `http://127.0.0.1:8000/docs`

---

## 🔐 API Documentation

The backend is a **FastAPI** application. When running locally, the interactive API docs are available at:

```
http://127.0.0.1:8000/docs
```

### Authentication

- All routes require the `X-User-Id` header except `GET /api/health`
- This is an **anonymous device/browser identifier** (not an account/login)
- Must contain 8–64 characters from `A-Z`, `a-z`, `0-9`, `_`, or `-`
- AI routes are rate-limited per user ID (default: 50 requests per 10-minute window)

### Key Routes

| Method | Path | Identity | Purpose |
|--------|------|----------|---------|
| `GET` | `/api/health` | No | Check API and AI configuration |
| `POST` | `/api/chat` | Yes (AI limit) | Tutor question with video/notes context |
| `GET` | `/api/history` | Yes | Read chat history |
| `POST` | `/api/interview/start` | Yes (AI limit) | Generate mock interview |
| `POST` | `/api/interview/{sid}/answer` | Yes (AI limit) | Evaluate answer |
| `POST` | `/api/interview/{sid}/finish` | Yes (AI limit) | Finish interview |
| `GET` | `/api/interview/sessions` | Yes | List interview sessions |
| `GET` | `/api/interview/{sid}` | Yes | Fetch one session |
| `GET` | `/api/stats` | Yes | Read activity totals |
| `DELETE` | `/api/me/data` | Yes | Delete all personal data |

### Example Chat Request

```http
POST /api/chat
Content-Type: application/json
X-User-Id: demo-user-01

{"question":"What is supervised learning?","context":"","lessonTime":0}
```

### Status Codes

- `200` - Success
- `400` - Missing/invalid identity header
- `422` - Request validation error
- `429` - AI request limit reached
- `409` - Conflict (e.g., finishing interview with no answers)
- `502` / `503` - AI provider errors

---

## 📦 Deployment

### Local (Development)

Follow the "Quick Start" steps above. Ensure your API key is set in the environment.

### Docker

```bash
docker build -t learnsphere-ai .
docker run -p 8000:8000 -e GEMINI_API_KEY=YOUR_KEY learnsphere-ai
```

### Vercel

1. Two configuration files are included:
   - `LearnSphere/vercel.json` - Vite frontend + FastAPI backend with proper routing
   - Repository-level `vercel.json` - Conflicting config (choose one project root)

2. **Before deployment**, choose one Vercel project/configuration and ensure:
   - `/api/*` routes to FastAPI
   - Non-API paths route to the Vite frontend

3. **Environment variables** to set in Vercel:
   - `GEMINI_API_KEY` (required)
   - `GEMINI_MODELS` (optional, comma-separated)
   - Other env vars as needed (see table below)

⚠️ **Note**: Vercel's filesystem is ephemeral. The default SQLite storage is **not durable** - activity history may reset on redeployment. No hosted persistent database is included.

---

## 🗂️ Project Structure

```
LearnSphere/
├── src/                    # Frontend React source
│   ├── App.tsx            # Main application component
│   ├── Interview.tsx      # Mock interview interface
│   ├── LoginPage.tsx      # Authentication interface
│   ├── api.ts             # API client wrapper
│   └── index.css          # Global styles (Tailwind + custom)
├── backend/                # FastAPI backend
│   ├── app/               # App routes, AI, DB, media utils
│   │   ├── main.py       # FastAPI application
│   │   ├── ai.py         # AI integration (Gemini/OpenAI)
│   │   ├── db.py         # SQLite database layer
│   │   └── media_utils.py # Media processing utilities
│   ├── requirements.txt   # Python dependencies
│   └── tests/             # pytest test suite
├── package.json            # Node.js dependencies
├── vite.config.ts         # Vite configuration
├── tsconfig.json          # TypeScript configuration
├── vercel.json            # Vercel deployment config
├── Dockerfile             # Production Docker image
├── run.bat                # Windows one-click launcher
├── README.md              # This file
└── dist/                  # Built frontend (generated)
```

---

## 🔧 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | *(required)* | Gemini API key for AI features |
| `OPENAI_API_KEY` | *(optional)* | OpenAI API key (alternative to Gemini) |
| `GEMINI_MODELS` | `gemini-2.5-flash,gemini-2.0-flash` | Comma-separated model priority list |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Single model if `GEMINI_MODELS` is absent |
| `RATE_LIMIT_PER_10MIN` | `50` | AI requests per 10-minute window per user |
| `CORS_ORIGINS` | *empty (allows all)* | Comma-separated allowed origins |
| `DATABASE_PATH` | `./data/app.db` | SQLite database file path |
| `FRONTEND_DIST` | `./dist` | Frontend build directory |
| `HOST` | `127.0.0.1` | Server bind host |
| `PORT` | `8000` | Server bind port |
| `VERCEL` | *unset* | Set when deploying to Vercel (changes DB path) |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License**. See the `LICENSE` file for details.

---

## 📧 Contact

For questions, issues, or contributions, please open an issue in the repository or contact the maintainers.

---

**LearnSphere AI** — AI-Powered Interactive Learning Assistant with Mock Interview Extension. Built with React, FastAPI, and Gemini/OpenAI.