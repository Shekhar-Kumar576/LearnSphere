# ── Stage 1: Build Frontend (Vite + React) ─────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ── Stage 2: Python Backend (FastAPI + SQLite) ─────────────────────
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies (ffmpeg for media handling)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Create standard Hugging Face user (UID 1000)
RUN useradd -m -u 1000 user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

# Install python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend application source and frontend dist
COPY backend/ ./backend/
COPY --from=frontend-builder /app/dist ./dist

# Create runtime data directories with permissions for Hugging Face non-root user
RUN mkdir -p /app/data/uploads && chown -R user:user /app
USER user

ENV PORT=7860
ENV FRONTEND_DIST=/app/dist
ENV DATABASE_PATH=/app/data/app.db

EXPOSE 7860

# Run FastAPI serving both UI and API
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
