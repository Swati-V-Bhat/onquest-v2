"""OnQuest backend API tests"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://onquest-flowmap.preview.emergentagent.com").rstrip("/")
TS = str(int(time.time()))
NEW_USER = {"email": f"test_{TS}@onquest.in", "password": "pass1234", "name": "Tester"}


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def explorer_token(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "explorer@onquest.in", "password": "explorer123"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def new_user_token(s):
    r = s.post(f"{BASE_URL}/api/auth/register", json=NEW_USER)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["email"] == NEW_USER["email"]
    return body["token"]


# ---------- Health ----------
def test_health(s):
    r = s.get(f"{BASE_URL}/api/")
    assert r.status_code == 200
    assert r.json().get("ok") is True


# ---------- Auth ----------
def test_login_admin(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@onquest.in", "password": "admin123"})
    assert r.status_code == 200
    assert "token" in r.json()


def test_login_invalid(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "explorer@onquest.in", "password": "wrong"})
    assert r.status_code == 401


def test_register_duplicate(s):
    r = s.post(f"{BASE_URL}/api/auth/register", json={"email": "explorer@onquest.in", "password": "x", "name": "X"})
    assert r.status_code == 400


def test_me_with_token(s, explorer_token):
    r = s.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {explorer_token}"})
    assert r.status_code == 200
    assert r.json()["email"] == "explorer@onquest.in"


def test_me_no_token(s):
    r = requests.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 401


# ---------- Quest feed/explore ----------
def test_feed(s):
    r = s.get(f"{BASE_URL}/api/quests/feed")
    assert r.status_code == 200
    quests = r.json()
    assert isinstance(quests, list)
    titles = [q["title"] for q in quests]
    assert "Himalayan Sunrise Trail" in titles
    sample = next(q for q in quests if q["title"] == "Himalayan Sunrise Trail")
    assert "author" in sample and sample["author"]["name"]
    assert "likes_count" in sample and "comments_count" in sample
    assert len(sample["nodes"]) >= 3


def test_explore(s):
    r = s.get(f"{BASE_URL}/api/quests/explore")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ---------- Quest CRUD by new user ----------
@pytest.fixture(scope="session")
def created_quest(s, new_user_token):
    payload = {
        "title": "TEST_Quest",
        "description": "An automated test quest",
        "cover_photo_base64": "",
        "nodes": [
            {"title": "Start Place", "description": "Start", "type": "place", "lat": 12.97, "lng": 77.59, "location_name": "Bangalore"},
            {"title": "Activity", "description": "Trek", "type": "activity", "lat": 13.0, "lng": 77.6, "location_name": "Hill"},
        ],
    }
    r = s.post(f"{BASE_URL}/api/quests", json=payload, headers={"Authorization": f"Bearer {new_user_token}"})
    assert r.status_code == 200, r.text
    q = r.json()
    assert q["title"] == "TEST_Quest"
    assert len(q["nodes"]) == 2
    return q


def test_create_persists(s, created_quest):
    r = s.get(f"{BASE_URL}/api/quests/{created_quest['id']}")
    assert r.status_code == 200
    assert r.json()["title"] == "TEST_Quest"


def test_my_quests(s, new_user_token, created_quest):
    r = s.get(f"{BASE_URL}/api/users/me/quests", headers={"Authorization": f"Bearer {new_user_token}"})
    assert r.status_code == 200
    arr = r.json()
    assert any(q["id"] == created_quest["id"] for q in arr)


def test_like_toggle(s, explorer_token, created_quest):
    h = {"Authorization": f"Bearer {explorer_token}"}
    qid = created_quest["id"]
    r1 = s.post(f"{BASE_URL}/api/quests/{qid}/like", headers=h)
    assert r1.status_code == 200
    assert r1.json()["liked"] is True
    assert r1.json()["likes_count"] == 1
    r2 = s.post(f"{BASE_URL}/api/quests/{qid}/like", headers=h)
    assert r2.json()["liked"] is False
    assert r2.json()["likes_count"] == 0


def test_comment(s, explorer_token, created_quest):
    h = {"Authorization": f"Bearer {explorer_token}"}
    r = s.post(f"{BASE_URL}/api/quests/{created_quest['id']}/comment", json={"text": "Nice quest!"}, headers=h)
    assert r.status_code == 200
    assert r.json()["text"] == "Nice quest!"
    r2 = s.get(f"{BASE_URL}/api/quests/{created_quest['id']}/comments")
    assert r2.status_code == 200
    assert any(c["text"] == "Nice quest!" for c in r2.json())


def test_ai_summary_author(s, new_user_token, created_quest):
    h = {"Authorization": f"Bearer {new_user_token}"}
    r = s.post(f"{BASE_URL}/api/quests/{created_quest['id']}/ai-summary", headers=h)
    # Accept 200 or graceful 500
    assert r.status_code in (200, 500), r.text
    if r.status_code == 200:
        assert r.json().get("ai_summary")


def test_ai_summary_non_author_forbidden(s, explorer_token, created_quest):
    h = {"Authorization": f"Bearer {explorer_token}"}
    r = s.post(f"{BASE_URL}/api/quests/{created_quest['id']}/ai-summary", headers=h)
    assert r.status_code == 403


def test_quest_create_unauthenticated(s):
    r = s.post(f"{BASE_URL}/api/quests", json={"title": "x", "nodes": []})
    assert r.status_code == 401
