"""
Backend regression tests for Draft Quest + Edit/Delete API endpoints
PLUS performance-optimization regression checks:
  - Summary projection on list endpoints (no `days`, `comments`, `ai_summary`)
  - Full payload on detail endpoint
  - Cache invalidation on create/delete
  - popular-destinations 2nd call cache hit
  - GZip Content-Encoding on large responses

Tests against the public backend URL from frontend/.env (EXPO_PUBLIC_BACKEND_URL) + /api.
"""
import os
import sys
import json
import time
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
USER_B_EMAIL = "priya.iyer@onquest.in"  # diya.patel not seeded; falls back to priya.iyer
USER_B_PASS = "Quest@123"

results = []  # list of (name, ok, detail)


def record(name, ok, detail=""):
    results.append((name, ok, detail))
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name} :: {detail[:280]}")


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    r.raise_for_status()
    data = r.json()
    return data["token"], data["user"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


SUMMARY_KEYS_FORBIDDEN = ["days", "comments", "ai_summary"]


def assert_list_is_summary(items, label):
    """Verify each item in a list-style endpoint response uses the summary projection."""
    if not isinstance(items, list):
        return False, f"not a list: {type(items).__name__}"
    if not items:
        return True, "empty list (no items to validate)"
    offenders = []
    for it in items[:20]:  # spot-check up to 20 items
        bad = [k for k in SUMMARY_KEYS_FORBIDDEN if k in it]
        if bad:
            offenders.append({"id": it.get("id", "?")[:8], "has": bad})
    if offenders:
        return False, f"items leak full-payload keys: {offenders[:5]}"
    # nodes must NOT have base64 photos (only summary keys)
    allowed_node_keys = {"title", "lat", "lng", "location_name", "type"}
    for it in items[:5]:
        for n in (it.get("nodes") or [])[:3]:
            extra = [k for k in n.keys() if k not in allowed_node_keys]
            if extra:
                return False, f"node has non-summary keys {extra} on item {it.get('id','?')[:8]}"
    return True, f"{label}: {len(items)} items, none leak {SUMMARY_KEYS_FORBIDDEN}"


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

    # ---- 1c. GET /auth/me ----
    try:
        r = requests.get(f"{API}/auth/me", headers=auth_headers(token_a), timeout=20)
        ok = r.status_code == 200 and r.json().get("id") == user_a["id"] and r.json().get("email") == USER_A_EMAIL
        record("1c. GET /auth/me returns current user", ok, f"HTTP {r.status_code} id_match={r.ok and r.json().get('id')==user_a['id']}")
    except Exception as e:
        record("1c. GET /auth/me", False, str(e))

    # ---- 1d. POST /auth/register (new throwaway user) + login it ----
    new_email = f"regtest+{int(time.time())}@onquest.in"
    new_pass = "RegTest@456"
    try:
        r = requests.post(f"{API}/auth/register",
                          json={"email": new_email, "password": new_pass, "name": "Reg Test"}, timeout=30)
        ok = r.status_code == 200 and r.json().get("token") and r.json().get("user", {}).get("email") == new_email
        record("1d. POST /auth/register new user", ok, f"HTTP {r.status_code}")
    except Exception as e:
        record("1d. POST /auth/register", False, str(e))
    # duplicate registration should 400
    try:
        r = requests.post(f"{API}/auth/register",
                          json={"email": new_email, "password": new_pass, "name": "Reg Test"}, timeout=20)
        ok = r.status_code == 400
        record("1e. duplicate /auth/register returns 400", ok, f"HTTP {r.status_code}")
    except Exception as e:
        record("1e. duplicate register", False, str(e))
    # invalid login
    try:
        r = requests.post(f"{API}/auth/login",
                          json={"email": USER_A_EMAIL, "password": "wrong-pass"}, timeout=20)
        ok = r.status_code == 401
        record("1f. /auth/login wrong pass returns 401", ok, f"HTTP {r.status_code}")
    except Exception as e:
        record("1f. wrong login", False, str(e))

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
    published_quest_id = None
    try:
        r = requests.post(f"{API}/quests", json=pub_payload, headers=auth_headers(token_a), timeout=30)
        ok = r.status_code == 200 and r.json().get("status") == "published"
        published_quest_id = r.json().get("id") if r.status_code == 200 else None
        record("3. POST /quests without status defaults to published", ok,
               f"HTTP {r.status_code} status={r.json().get('status') if r.ok else r.text[:120]}")
    except Exception as e:
        record("3. POST /quests no status", False, str(e))
        return

    # ---- 4. GET /quests/feed as user B - draft NOT in feed + summary projection ----
    try:
        r = requests.get(f"{API}/quests/feed?limit=200", headers=auth_headers(token_b), timeout=30)
        body = r.json()
        ids = [q["id"] for q in body]
        ok_draft = r.status_code == 200 and draft_id not in ids
        ok_proj, proj_detail = assert_list_is_summary(body, "feed")
        record("4. Feed (user B) excludes draft", ok_draft, f"HTTP {r.status_code} count={len(ids)} draft_in={draft_id in ids}")
        record("4b. Feed uses summary projection (no days/comments/ai_summary)", ok_proj, proj_detail)
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

    # ---- 6. GET /quests/explore - draft NOT in explore + summary projection ----
    try:
        r = requests.get(f"{API}/quests/explore?limit=200", timeout=30)
        body = r.json()
        ids = [q["id"] for q in body]
        ok_draft = r.status_code == 200 and draft_id not in ids
        ok_proj, proj_detail = assert_list_is_summary(body, "explore")
        record("6. Explore excludes draft", ok_draft, f"HTTP {r.status_code} count={len(ids)} draft_in={draft_id in ids}")
        record("6b. Explore uses summary projection", ok_proj, proj_detail)
    except Exception as e:
        record("6. Explore", False, str(e))

    # ---- 7. GET /users/me/quests as author - draft NOT here + summary projection ----
    try:
        r = requests.get(f"{API}/users/me/quests", headers=auth_headers(token_a), timeout=30)
        body = r.json()
        ids = [q["id"] for q in body]
        ok = r.status_code == 200 and draft_id not in ids
        ok_proj, proj_detail = assert_list_is_summary(body, "users/me/quests")
        record("7. /users/me/quests (author) excludes draft", ok,
               f"HTTP {r.status_code} count={len(ids)} draft_in={draft_id in ids}")
        record("7b. /users/me/quests uses summary projection", ok_proj, proj_detail)
    except Exception as e:
        record("7. /users/me/quests", False, str(e))

    # ---- 8. GET /users/{user_a_id} - draft NOT in returned quests + summary projection ----
    try:
        r = requests.get(f"{API}/users/{user_a['id']}", timeout=30)
        body = r.json()
        quests_list = body.get("quests", [])
        ids = [q["id"] for q in quests_list]
        ok = r.status_code == 200 and draft_id not in ids
        ok_proj, proj_detail = assert_list_is_summary(quests_list, "users/{id}.quests")
        record("8. /users/{id} excludes draft", ok,
               f"HTTP {r.status_code} count={len(ids)} draft_in={draft_id in ids}")
        record("8b. /users/{id}.quests uses summary projection", ok_proj, proj_detail)
    except Exception as e:
        record("8. /users/{id}", False, str(e))

    # ---- 9. GET /users/me/drafts as author - draft IS present + summary projection ----
    try:
        r = requests.get(f"{API}/users/me/drafts", headers=auth_headers(token_a), timeout=30)
        body = r.json()
        ids = [q["id"] for q in body]
        ok = r.status_code == 200 and draft_id in ids
        ok_proj, proj_detail = assert_list_is_summary(body, "users/me/drafts")
        record("9. /users/me/drafts (author) includes draft", ok,
               f"HTTP {r.status_code} count={len(ids)} draft_in={draft_id in ids}")
        record("9b. /users/me/drafts uses summary projection", ok_proj, proj_detail)
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

    # ---- 10b. GET /quests/{draft_id} - FULL payload check (days/comments/ai_summary keys present) ----
    try:
        r = requests.get(f"{API}/quests/{draft_id}", timeout=30)
        body = r.json() if r.ok else {}
        ok_status = r.status_code == 200
        has_days = "days" in body
        has_comments = "comments" in body
        has_ai = "ai_summary" in body
        ok = ok_status and has_days and has_comments and has_ai
        record("10b. GET /quests/{id} returns FULL payload (days, comments, ai_summary)", ok,
               f"HTTP {r.status_code} days={has_days} comments={has_comments} ai_summary={has_ai}")
    except Exception as e:
        record("10b. GET /quests/{id} full payload", False, str(e))

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

    # S2: GET /quests/{id} full payload
    if sanity_quest_id:
        try:
            r = requests.get(f"{API}/quests/{sanity_quest_id}", timeout=30)
            body = r.json()
            ok = r.status_code == 200 and body.get("id") == sanity_quest_id and "days" in body and "comments" in body
            record("S2. GET /quests/{id} (detail) full payload", ok,
                   f"HTTP {r.status_code} days_in={'days' in body} comments_in={'comments' in body}")
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

        # S4b: GET /quests/{id}/comments
        try:
            r = requests.get(f"{API}/quests/{sanity_quest_id}/comments", timeout=20)
            ok = r.status_code == 200 and isinstance(r.json(), list) and len(r.json()) >= 1
            record("S4b. GET /quests/{id}/comments", ok, f"HTTP {r.status_code} n={len(r.json()) if r.ok else 0}")
        except Exception as e:
            record("S4b. GET comments", False, str(e))

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

    # =========================================================
    # PERFORMANCE OPTIMIZATION REGRESSION CHECKS
    # =========================================================
    print("\n" + "=" * 70)
    print("PERF OPTIMIZATION REGRESSION CHECKS")
    print("=" * 70)

    # P1: /search - summary projection
    try:
        r = requests.get(f"{API}/search?q=goa&limit=20", timeout=30)
        body = r.json() if r.ok else []
        ok_proj, proj_detail = assert_list_is_summary(body, "search")
        record("P1. /search?q= uses summary projection", r.ok and ok_proj,
               f"HTTP {r.status_code} {proj_detail}")
    except Exception as e:
        record("P1. /search", False, str(e))

    # P2: /recommendations - summary projection
    try:
        r = requests.get(f"{API}/recommendations?limit=10", timeout=30)
        body = r.json() if r.ok else []
        ok_proj, proj_detail = assert_list_is_summary(body, "recommendations")
        record("P2. /recommendations uses summary projection", r.ok and ok_proj,
               f"HTTP {r.status_code} {proj_detail}")
    except Exception as e:
        record("P2. /recommendations", False, str(e))

    # P3: Cache bust on CREATE — new published quest appears in /quests/explore within 1s
    cache_test_id = None
    try:
        unique_title = f"PerfTest Explore Cache {int(time.time())}"
        # warm the cache first
        requests.get(f"{API}/quests/explore?limit=200", timeout=30)
        # create published
        r = requests.post(f"{API}/quests", json={
            "title": unique_title,
            "description": "perf cache-bust test",
            "tags": ["perftest"],
            "days": [{"title": "D1", "entries": [{"kind": "place", "title": "Spot", "location_name": "Jaipur"}]}],
        }, headers=auth_headers(token_a), timeout=30)
        cache_test_id = r.json().get("id") if r.ok else None
        time.sleep(0.4)
        r2 = requests.get(f"{API}/quests/explore?limit=200", timeout=30)
        ids2 = [q["id"] for q in r2.json()] if r2.ok else []
        ok = cache_test_id is not None and cache_test_id in ids2
        record("P3. Create busts explore cache (new quest visible within 1s)", ok,
               f"created_id={cache_test_id} in_explore={cache_test_id in ids2} explore_size={len(ids2)}")
    except Exception as e:
        record("P3. cache bust on create", False, str(e))

    # P4: Cache bust on DELETE — quest gone from /quests/explore after delete
    if cache_test_id:
        try:
            # warm again
            requests.get(f"{API}/quests/explore?limit=200", timeout=30)
            rd = requests.delete(f"{API}/quests/{cache_test_id}", headers=auth_headers(token_a), timeout=20)
            time.sleep(0.4)
            r3 = requests.get(f"{API}/quests/explore?limit=200", timeout=30)
            ids3 = [q["id"] for q in r3.json()] if r3.ok else []
            ok = rd.ok and cache_test_id not in ids3
            record("P4. Delete busts explore cache (quest disappears within 1s)", ok,
                   f"delete_status={rd.status_code} still_in_explore={cache_test_id in ids3}")
        except Exception as e:
            record("P4. cache bust on delete", False, str(e))

    # P5: /popular-destinations 2nd call faster than 1st (in-process 5min cache)
    try:
        # Bust by creating+deleting? No — we want a cold path then warm. Issue: previous tests may
        # already have warmed it. Force a cold start by busting via a quest create+delete (which
        # invalidates pop:* cache), then measure.
        bust_payload = {
            "title": f"Bust pop cache {int(time.time())}",
            "description": "tmp",
            "tags": [],
            "days": [{"title": "D1", "entries": [{"kind": "place", "title": "x", "location_name": "Delhi"}]}],
        }
        cr = requests.post(f"{API}/quests", json=bust_payload, headers=auth_headers(token_a), timeout=20)
        tmp_id = cr.json().get("id") if cr.ok else None
        # First call after bust = cold
        t0 = time.time()
        r1 = requests.get(f"{API}/popular-destinations?limit=20", timeout=60)
        cold_ms = (time.time() - t0) * 1000
        # Second call should hit cache
        t1 = time.time()
        r2 = requests.get(f"{API}/popular-destinations?limit=20", timeout=30)
        warm_ms = (time.time() - t1) * 1000
        ok = r1.ok and r2.ok and warm_ms < cold_ms
        record("P5. /popular-destinations 2nd call faster (cache hit)", ok,
               f"cold={cold_ms:.0f}ms warm={warm_ms:.0f}ms ratio={cold_ms/max(warm_ms,1):.2f}x")
        if tmp_id:
            try:
                requests.delete(f"{API}/quests/{tmp_id}", headers=auth_headers(token_a), timeout=15)
            except Exception:
                pass
    except Exception as e:
        record("P5. popular-destinations cache", False, str(e))

    # P6: GZip Content-Encoding when Accept-Encoding includes gzip on a large list response.
    # Use raw urllib3 (requests auto-decodes & strips Content-Encoding); fall back to inspecting
    # raw response via stream=True + no auto-decompress.
    try:
        sess = requests.Session()
        # Disable automatic decoding so we can read the original Content-Encoding header
        r = sess.get(f"{API}/quests/explore?limit=200",
                     headers={"Accept-Encoding": "gzip"}, timeout=30, stream=True)
        enc = r.headers.get("Content-Encoding", "").lower()
        clen = r.headers.get("Content-Length") or "?"
        # Read & discard body
        body_bytes = r.raw.read()
        ok = r.status_code == 200 and "gzip" in enc and len(body_bytes) > 0
        record("P6. GZip Content-Encoding on /quests/explore", ok,
               f"HTTP {r.status_code} Content-Encoding='{enc}' Content-Length={clen} body_bytes={len(body_bytes)}")
    except Exception as e:
        record("P6. gzip header", False, str(e))

    # P7: AI-summary endpoint - 200 or graceful 5xx (depends on Emergent LLM key)
    if sanity_quest_id:
        try:
            r = requests.post(f"{API}/quests/{sanity_quest_id}/ai-summary",
                              headers=auth_headers(token_a), timeout=120)
            # We accept 200 (LLM worked) or 500/502/503 (LLM service issue) as "graceful"
            graceful_5xx = r.status_code in (500, 502, 503, 504) and isinstance(r.json().get("detail", None), str)
            ok = r.status_code == 200 or graceful_5xx
            tag = "OK" if r.status_code == 200 else (f"graceful-{r.status_code}" if graceful_5xx else "BAD")
            record("P7. POST /quests/{id}/ai-summary (200 or graceful 5xx)", ok,
                   f"HTTP {r.status_code} [{tag}] body={str(r.text)[:160]}")
        except Exception as e:
            record("P7. ai-summary", False, str(e))

    # P8: /leaderboard reachable
    try:
        r = requests.get(f"{API}/leaderboard?limit=20", timeout=30)
        ok = r.status_code == 200 and isinstance(r.json(), list)
        record("P8. GET /leaderboard", ok, f"HTTP {r.status_code} items={len(r.json()) if r.ok else 0}")
    except Exception as e:
        record("P8. leaderboard", False, str(e))

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
