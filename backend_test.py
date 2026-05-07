"""
Backend tests for Draft Quest + Edit/Delete API endpoints.
Tests against the production backend URL from frontend/.env (EXPO_PUBLIC_BACKEND_URL) + /api.
"""
import os
import sys
import json
import requests
from pathlib import Path

# Read backend URL from frontend/.env
FRONTEND_ENV = Path("/app/frontend/.env")
BACKEND_URL = None
for line in FRONTEND_ENV.read_text().splitlines():
    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
        BACKEND_URL = line.split("=", 1)[1].strip().strip('"')
        break
assert BACKEND_URL, "Could not find EXPO_PUBLIC_BACKEND_URL in /app/frontend/.env"
API = BACKEND_URL.rstrip("/") + "/api"
print(f"Using API base: {API}")

USER_A_EMAIL = "aarav.sharma@onquest.in"
USER_A_PASS = "Quest@123"
USER_B_EMAIL = "diya.patel@onquest.in"  # Note: not in seeded list per credentials file, fall back to admin
USER_B_PASS = "Quest@123"

# Per credentials file, diya.patel is not seeded. Use priya.iyer instead.
USER_B_EMAIL = "priya.iyer@onquest.in"

results = []  # list of (name, ok, detail)


def record(name, ok, detail=""):
    results.append((name, ok, detail))
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name} :: {detail[:240]}")


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    r.raise_for_status()
    data = r.json()
    return data["token"], data["user"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def main():
    # ---- 1. Login two users ----
    try:
        token_a, user_a = login(USER_A_EMAIL, USER_A_PASS)
        record("1a. Login user A (aarav.sharma)", True, f"id={user_a['id']}")
    except Exception as e:
        record("1a. Login user A", False, str(e))
        return

    try:
        token_b, user_b = login(USER_B_EMAIL, USER_B_PASS)
        record("1b. Login user B (priya.iyer)", True, f"id={user_b['id']}")
    except Exception as e:
        record("1b. Login user B", False, str(e))
        return

    # ---- 2. Create draft as user A ----
    draft_payload = {
        "title": "My Hidden Goa Draft",
        "description": "A test draft quest for backend verification",
        "tags": ["beach", "draft-test"],
        "days": [
            {
                "title": "Day 1 - Arrival",
                "description": "Land at Dabolim and head to Anjuna",
                "date": "2026-01-15",
                "entries": [
                    {
                        "kind": "place",
                        "title": "Anjuna Beach",
                        "description": "Sunset at Anjuna",
                        "location_name": "Anjuna, Goa",
                        "time": "Evening",
                        "cost": "Free",
                        "rating": 4,
                        "notes": "Carry sunglasses",
                    }
                ],
            }
        ],
        "status": "draft",
    }
    try:
        r = requests.post(f"{API}/quests", json=draft_payload, headers=auth_headers(token_a), timeout=30)
        if r.status_code != 200:
            record("2. POST /quests draft", False, f"HTTP {r.status_code}: {r.text[:200]}")
            return
        draft = r.json()
        draft_id = draft["id"]
        ok = draft.get("status") == "draft" and draft.get("title") == draft_payload["title"]
        record("2. POST /quests with status=draft", ok,
               f"id={draft_id} status={draft.get('status')} title={draft.get('title')}")
    except Exception as e:
        record("2. POST /quests draft", False, str(e))
        return

    # ---- 3. POST /quests without status -> default published ----
    pub_payload = {
        "title": "Sanity Published Quest A",
        "description": "Default-status sanity check",
        "tags": ["sanity"],
        "days": [
            {
                "title": "Day 1",
                "entries": [{"kind": "place", "title": "Test Spot", "location_name": "Mumbai"}],
            }
        ],
    }
    try:
        r = requests.post(f"{API}/quests", json=pub_payload, headers=auth_headers(token_a), timeout=30)
        ok = r.status_code == 200 and r.json().get("status") == "published"
        published_quest_id = r.json().get("id") if r.status_code == 200 else None
        record("3. POST /quests without status defaults to published", ok,
               f"HTTP {r.status_code} status={r.json().get('status') if r.ok else r.text[:120]}")
    except Exception as e:
        record("3. POST /quests no status", False, str(e))
        return

    # ---- 4. GET /quests/feed as user B - draft NOT in feed ----
    try:
        r = requests.get(f"{API}/quests/feed?limit=200", headers=auth_headers(token_b), timeout=30)
        ids = [q["id"] for q in r.json()]
        ok = r.status_code == 200 and draft_id not in ids
        record("4. Feed (user B) excludes draft", ok, f"HTTP {r.status_code} count={len(ids)} draft_in={draft_id in ids}")
    except Exception as e:
        record("4. Feed user B", False, str(e))

    # ---- 5. GET /quests/feed as user A (author) - still NOT in feed ----
    try:
        r = requests.get(f"{API}/quests/feed?limit=200", headers=auth_headers(token_a), timeout=30)
        ids = [q["id"] for q in r.json()]
        ok = r.status_code == 200 and draft_id not in ids
        record("5. Feed (author A) excludes own draft", ok,
               f"HTTP {r.status_code} count={len(ids)} draft_in={draft_id in ids}")
    except Exception as e:
        record("5. Feed user A", False, str(e))

    # ---- 6. GET /quests/explore - draft NOT in explore ----
    try:
        r = requests.get(f"{API}/quests/explore?limit=200", timeout=30)
        ids = [q["id"] for q in r.json()]
        ok = r.status_code == 200 and draft_id not in ids
        record("6. Explore excludes draft", ok, f"HTTP {r.status_code} count={len(ids)} draft_in={draft_id in ids}")
    except Exception as e:
        record("6. Explore", False, str(e))

    # ---- 7. GET /users/me/quests as author - draft NOT here ----
    try:
        r = requests.get(f"{API}/users/me/quests", headers=auth_headers(token_a), timeout=30)
        ids = [q["id"] for q in r.json()]
        ok = r.status_code == 200 and draft_id not in ids
        record("7. /users/me/quests (author) excludes draft", ok,
               f"HTTP {r.status_code} count={len(ids)} draft_in={draft_id in ids}")
    except Exception as e:
        record("7. /users/me/quests", False, str(e))

    # ---- 8. GET /users/{user_a_id} - draft NOT in returned quests ----
    try:
        r = requests.get(f"{API}/users/{user_a['id']}", timeout=30)
        body = r.json()
        ids = [q["id"] for q in body.get("quests", [])]
        ok = r.status_code == 200 and draft_id not in ids
        record("8. /users/{id} excludes draft", ok,
               f"HTTP {r.status_code} count={len(ids)} draft_in={draft_id in ids}")
    except Exception as e:
        record("8. /users/{id}", False, str(e))

    # ---- 9. GET /users/me/drafts as author - draft IS present ----
    try:
        r = requests.get(f"{API}/users/me/drafts", headers=auth_headers(token_a), timeout=30)
        ids = [q["id"] for q in r.json()]
        ok = r.status_code == 200 and draft_id in ids
        record("9. /users/me/drafts (author) includes draft", ok,
               f"HTTP {r.status_code} count={len(ids)} draft_in={draft_id in ids}")
    except Exception as e:
        record("9. /users/me/drafts (A)", False, str(e))

    # ---- 10. GET /users/me/drafts as user B - should NOT contain user A's draft ----
    try:
        r = requests.get(f"{API}/users/me/drafts", headers=auth_headers(token_b), timeout=30)
        ids = [q["id"] for q in r.json()]
        ok = r.status_code == 200 and draft_id not in ids
        record("10. /users/me/drafts (user B) excludes A's draft", ok,
               f"HTTP {r.status_code} count={len(ids)} draft_in={draft_id in ids}")
    except Exception as e:
        record("10. /users/me/drafts (B)", False, str(e))

    # ---- 11. PUT /quests/{draft_id} as user A - update title ----
    try:
        r = requests.put(f"{API}/quests/{draft_id}",
                         json={"title": "Updated Draft Title"},
                         headers=auth_headers(token_a), timeout=30)
        if r.status_code != 200:
            record("11. PUT update draft title (owner)", False, f"HTTP {r.status_code}: {r.text[:200]}")
        else:
            body = r.json()
            ok = body.get("title") == "Updated Draft Title" and body.get("updated_at")
            record("11. PUT update draft title (owner)", ok,
                   f"title={body.get('title')} updated_at={body.get('updated_at')}")
    except Exception as e:
        record("11. PUT draft title", False, str(e))

    # ---- 12. PUT /quests/{draft_id} as user B - 403 ----
    try:
        r = requests.put(f"{API}/quests/{draft_id}",
                         json={"title": "Hacked!"},
                         headers=auth_headers(token_b), timeout=30)
        ok = r.status_code == 403
        record("12. PUT by non-owner returns 403", ok, f"HTTP {r.status_code}: {r.text[:120]}")
    except Exception as e:
        record("12. PUT non-owner", False, str(e))

    # ---- 13. PUT /quests/{draft_id} as user A status=published ----
    try:
        r = requests.put(f"{API}/quests/{draft_id}",
                         json={"status": "published"},
                         headers=auth_headers(token_a), timeout=30)
        ok = r.status_code == 200 and r.json().get("status") == "published"
        record("13. PUT draft -> status=published", ok,
               f"HTTP {r.status_code} status={r.json().get('status') if r.ok else r.text[:120]}")
    except Exception as e:
        record("13. PUT publish draft", False, str(e))

    # ---- 14. GET /quests/feed (user B) - now-published quest IS in feed ----
    try:
        r = requests.get(f"{API}/quests/feed?limit=200", headers=auth_headers(token_b), timeout=30)
        ids = [q["id"] for q in r.json()]
        ok = r.status_code == 200 and draft_id in ids
        record("14. After publish, feed (B) includes the quest", ok,
               f"HTTP {r.status_code} count={len(ids)} present={draft_id in ids}")
    except Exception as e:
        record("14. Feed after publish", False, str(e))

    # ---- 15. GET /users/me/drafts (A) - now should NOT contain it ----
    try:
        r = requests.get(f"{API}/users/me/drafts", headers=auth_headers(token_a), timeout=30)
        ids = [q["id"] for q in r.json()]
        ok = r.status_code == 200 and draft_id not in ids
        record("15. After publish, drafts (A) excludes it", ok,
               f"HTTP {r.status_code} count={len(ids)} present={draft_id in ids}")
    except Exception as e:
        record("15. Drafts after publish", False, str(e))

    # ---- 16. DELETE /quests/{quest_id} as user B - 403 ----
    try:
        r = requests.delete(f"{API}/quests/{draft_id}", headers=auth_headers(token_b), timeout=30)
        ok = r.status_code == 403
        record("16. DELETE by non-owner returns 403", ok, f"HTTP {r.status_code}: {r.text[:120]}")
    except Exception as e:
        record("16. DELETE non-owner", False, str(e))

    # ---- 17. DELETE /quests/{quest_id} as user A - 200 ok ----
    try:
        r = requests.delete(f"{API}/quests/{draft_id}", headers=auth_headers(token_a), timeout=30)
        ok = r.status_code == 200 and r.json().get("ok") is True
        record("17. DELETE by owner returns ok=true", ok, f"HTTP {r.status_code}: {r.text[:120]}")
    except Exception as e:
        record("17. DELETE owner", False, str(e))

    # ---- 18. GET /quests/{quest_id} after delete - 404 ----
    try:
        r = requests.get(f"{API}/quests/{draft_id}", timeout=30)
        ok = r.status_code == 404
        record("18. GET deleted quest returns 404", ok, f"HTTP {r.status_code}")
    except Exception as e:
        record("18. GET deleted", False, str(e))

    # ---- 19. PUT /quests/{nonexistent} - 404 ----
    try:
        r = requests.put(f"{API}/quests/00000000-0000-0000-0000-000000000000",
                         json={"title": "x"}, headers=auth_headers(token_a), timeout=30)
        ok = r.status_code == 404
        record("19. PUT nonexistent quest returns 404", ok, f"HTTP {r.status_code}")
    except Exception as e:
        record("19. PUT nonexistent", False, str(e))

    # ---- 20. DELETE /quests/{nonexistent} - 404 ----
    try:
        r = requests.delete(f"{API}/quests/00000000-0000-0000-0000-000000000000",
                            headers=auth_headers(token_a), timeout=30)
        ok = r.status_code == 404
        record("20. DELETE nonexistent quest returns 404", ok, f"HTTP {r.status_code}")
    except Exception as e:
        record("20. DELETE nonexistent", False, str(e))

    # ============= SANITY (existing flows) =============
    # S1: POST /quests default status
    sanity_quest_id = None
    try:
        r = requests.post(f"{API}/quests", json={
            "title": "Sanity Default Quest",
            "description": "Sanity check quest",
            "tags": ["sanity"],
            "days": [{"title": "Day 1", "entries": [{"kind": "place", "title": "Stop A", "location_name": "Mumbai"}]}],
        }, headers=auth_headers(token_a), timeout=30)
        ok = r.status_code == 200 and r.json().get("status") == "published"
        sanity_quest_id = r.json().get("id") if r.ok else None
        record("S1. POST /quests default published", ok, f"HTTP {r.status_code}")
    except Exception as e:
        record("S1. POST /quests default", False, str(e))

    # S2: GET /quests/{id}
    if sanity_quest_id:
        try:
            r = requests.get(f"{API}/quests/{sanity_quest_id}", timeout=30)
            ok = r.status_code == 200 and r.json().get("id") == sanity_quest_id
            record("S2. GET /quests/{id}", ok, f"HTTP {r.status_code}")
        except Exception as e:
            record("S2. GET /quests/{id}", False, str(e))

        # S3: POST /quests/{id}/like
        try:
            r = requests.post(f"{API}/quests/{sanity_quest_id}/like",
                              headers=auth_headers(token_b), timeout=30)
            body = r.json() if r.ok else {}
            ok = r.status_code == 200 and body.get("liked") is True and body.get("likes_count", 0) >= 1
            record("S3. POST /quests/{id}/like", ok, f"HTTP {r.status_code} body={body}")
        except Exception as e:
            record("S3. like", False, str(e))

        # S4: POST /quests/{id}/comment
        try:
            r = requests.post(f"{API}/quests/{sanity_quest_id}/comment",
                              json={"text": "Looks awesome!"},
                              headers=auth_headers(token_b), timeout=30)
            ok = r.status_code == 200 and r.json().get("text") == "Looks awesome!"
            record("S4. POST /quests/{id}/comment", ok, f"HTTP {r.status_code}")
        except Exception as e:
            record("S4. comment", False, str(e))

    # S5: GET /quests/feed
    try:
        r = requests.get(f"{API}/quests/feed", headers=auth_headers(token_a), timeout=30)
        ok = r.status_code == 200 and isinstance(r.json(), list)
        record("S5. GET /quests/feed", ok, f"HTTP {r.status_code} items={len(r.json()) if r.ok else 0}")
    except Exception as e:
        record("S5. feed", False, str(e))

    # S6: GET /users/me/quests
    try:
        r = requests.get(f"{API}/users/me/quests", headers=auth_headers(token_a), timeout=30)
        ok = r.status_code == 200 and isinstance(r.json(), list)
        record("S6. GET /users/me/quests", ok, f"HTTP {r.status_code} items={len(r.json()) if r.ok else 0}")
    except Exception as e:
        record("S6. me/quests", False, str(e))

    # S7: GET /popular-destinations
    try:
        r = requests.get(f"{API}/popular-destinations", timeout=30)
        ok = r.status_code == 200 and isinstance(r.json(), list)
        record("S7. GET /popular-destinations", ok, f"HTTP {r.status_code} items={len(r.json()) if r.ok else 0}")
    except Exception as e:
        record("S7. popular-destinations", False, str(e))

    # Cleanup sanity quests
    for qid in [published_quest_id, sanity_quest_id]:
        if qid:
            try:
                requests.delete(f"{API}/quests/{qid}", headers=auth_headers(token_a), timeout=15)
            except Exception:
                pass

    # ===== Summary =====
    total = len(results)
    passed = sum(1 for _, ok, _ in results if ok)
    print("\n" + "=" * 70)
    print(f"RESULTS: {passed}/{total} passed")
    print("=" * 70)
    for name, ok, detail in results:
        if not ok:
            print(f"FAILED: {name} -> {detail}")
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
