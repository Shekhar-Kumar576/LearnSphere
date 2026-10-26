"""LearnSphere AI — Unified Localhost Launcher.

Hosts both frontend and backend on ONE single localhost link:
http://127.0.0.1:8000
"""
import os
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
DIST_INDEX = ROOT_DIR / "dist" / "index.html"


def ensure_frontend_built():
    if not DIST_INDEX.is_file():
        print("[*] Frontend build ('dist/') not found. Building frontend now...")
        npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
        try:
            subprocess.run([npm_cmd, "run", "build"], cwd=str(ROOT_DIR), check=True)
            print("[+] Frontend built successfully!")
        except Exception as e:
            print(f"[!] Warning: Could not run '{npm_cmd} run build': {e}")
            print("    If the page shows a 404, run 'npm run build' manually.")


def main():
    ensure_frontend_built()

    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    url = f"http://{host}:{port}"

    print("\n" + "=" * 65)
    print("  LearnSphere AI -- Unified Localhost Server")
    print(f"  -> Web Application (UI + API): {url}")
    print(f"  -> API Interactive Docs:       {url}/docs")
    print("=" * 65 + "\n")

    def open_browser():
        time.sleep(1.2)
        try:
            webbrowser.open(url)
        except Exception:
            pass

    import threading

    threading.Thread(target=open_browser, daemon=True).start()

    import uvicorn

    backend_app_dir = ROOT_DIR / "backend" / "app"
    if str(backend_app_dir) not in sys.path:
        sys.path.insert(0, str(backend_app_dir))

    from backend.app.main import app

    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
