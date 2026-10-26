"""Vercel Python Function entrypoint for the LearnSphere FastAPI backend."""
import os
import sys

# Ensure project root is in sys.path so 'backend' can always be imported cleanly
_api_dir = os.path.dirname(os.path.abspath(__file__))
_root_dir = os.path.dirname(_api_dir)
if _root_dir not in sys.path:
    sys.path.insert(0, _root_dir)

from backend.app.main import app

# Vercel detects the exported ASGI app and serves the /api/* routes through it.
