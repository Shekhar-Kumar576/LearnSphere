import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient
try:
    from app import db
    from app.main import app
except ImportError:
    from backend.app import db
    from backend.app.main import app

H = {"X-User-Id": "test-student-9999"}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", str(tmp_path / "test_app.db"))
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    with TestClient(app) as c:
        yield c


def test_courses_listing(client):
    courses = client.get("/api/courses").json()
    assert len(courses) >= 1
    assert courses[0]["title"] == "My Teaching Course"

    # Initially no preloaded ML videos exist; the system is clean for instructor uploads
    videos = client.get("/api/videos").json()
    assert isinstance(videos, list)


def test_video_upload_and_auto_quiz(client):
    fake_video = io.BytesIO(b"fake video data content" * 1000)
    files = {"file": ("my_lecture_module_1.mp4", fake_video, "video/mp4")}
    data = {"title": "Module 1: Introduction & Architecture", "course_id": 1, "duration": 145.5}

    res = client.post("/api/videos/upload", files=files, data=data, headers=H)
    assert res.status_code == 200
    v = res.json()
    assert v["title"] == "Module 1: Introduction & Architecture"
    assert v["duration_display"] == "02:26"
    video_id = v["id"]

    # Verify quiz was automatically generated for this video
    quiz_res = client.get(f"/api/quiz/video/{video_id}")
    assert quiz_res.status_code == 200
    quiz = quiz_res.json()
    assert len(quiz["questions"]) >= 2
    assert quiz["video_id"] == video_id


def test_resource_upload_and_download(client):
    fake_doc = io.BytesIO(b"Slide 1: Core System Principles and Architecture.\nSlide 2: Implementation Details.")
    files = {"file": ("lecture_slides.txt", fake_doc, "text/plain")}
    data = {"title": "Lecture Slides & Reference Notes", "course_id": 1}

    res = client.post("/api/resources/upload", files=files, data=data, headers=H)
    assert res.status_code == 200
    r = res.json()
    assert r["title"] == "Lecture Slides & Reference Notes"
    res_id = r["id"]

    # Verify resource appears in list
    res_list = client.get("/api/resources").json()
    assert any(x["id"] == res_id for x in res_list)

    # Test download endpoint
    dl = client.get(f"/api/resources/download/{res_id}")
    assert dl.status_code == 200
    assert b"Core System Principles" in dl.content


def test_quiz_submission_scoring(client):
    # Upload video to test realistic quiz flow
    fake_video = io.BytesIO(b"fake video content" * 500)
    files = {"file": ("lecture_test.mp4", fake_video, "video/mp4")}
    data = {"title": "Assessment Test Video", "course_id": 1, "duration": 90}
    v_res = client.post("/api/videos/upload", files=files, data=data, headers=H).json()
    v_id = v_res["id"]

    quiz = client.get(f"/api/quiz/video/{v_id}").json()
    quiz_id = quiz["id"]
    correct_answers = [q["answer"] for q in quiz["questions"]]

    # Submit with all correct answers
    sub = client.post("/api/quiz/submit", json={"quiz_id": quiz_id, "answers": correct_answers}, headers=H)
    assert sub.status_code == 200
    result = sub.json()
    assert result["score"] == len(correct_answers)
    assert result["percentage"] == 100

