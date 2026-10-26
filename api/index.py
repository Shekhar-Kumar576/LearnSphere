"""Vercel Python Function entrypoint for the LearnSphere FastAPI backend."""
from backend.app.main import app

# Vercel detects the exported ASGI app and serves the /api/* routes through it.
