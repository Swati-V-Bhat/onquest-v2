#!/usr/bin/env python3
"""Test suite for Save Quest (bookmark) endpoints + regression on existing quest CRUD."""
import os
import sys
import requests
import json

BASE = "https://onquest-flowmap.preview.emergentagent.com/api"

USER_A_EMAIL = "aarav.sharma@onquest.in"
USER_B_EMAIL = "priya.iyer@onquest.in"
PASSWORD = "Quest@123"

results = []
def record(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    results.append((name, ok, detail))
    print(f"[{status}] {name}" + (f" :: {detail}" if detail else ""))

def login(email, password):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=20)
    r.raise_for_status()
    j = r.json()
    return j["token"], j["user"]

def auth(token):
    return {"Authorization": f"Bearer {token}"}


def main():
    # ---- 1. login both users
    tokenA, userA = login(USER_A_EMAIL, PASSWORD)
    tokenB, userB = login(USER_B_EMAIL, PASSWORD)
    record("Login A", bool(tokenA) and bool(userA.get("id")), f"id={userA.get('id')}")
    record("Login B", bool(tokenB) and bool(userB.get("id")), f"id={userB.get('id')}")

    # ---- Fetch feed for A and find a quest authored by B
    r = requests.get(f"{BASE}/quests/feed?limit=50", headers=auth(tokenA), timeout=30)
    record("GET /quests/feed (A)", r.status_code == 200, f"http={r.status_code}")
    feed = r.json()
    qB = None
    for q in feed:
        if q.get("author", {}).get("id") == userB["id"]:
            qB = q
            break
    if not qB:
        # alternative: query /users/{userB.id} for a quest
        r2 = requests.get(f"{BASE}/users/{userB['id']}", timeout=30)
        if r2.status_code == 200:
            quests = r2.json().get("quests", [])
            if quests:
                qB = quests[0]
    record("Found a B-authored quest", qB is not None, f"qB.id={qB.get('id') if qB else None}")
    if not qB:
        print("Cannot continue without a B-authored quest")
        sys.exit(1)

    qB_id = qB["id"]

    # ---- 2. A saves B's quest
    r = requests.post(f"{BASE}/quests/{qB_id}/save", headers=auth(tokenA), timeout=20)
    ok = r.status_code == 200 and r.json().get("saved") is True
    record("A: POST /quests/{qB}/save -> {saved:true}", ok, f"http={r.status_code} body={r.text[:120]}")

    # idempotent second call
    r = requests.post(f"{BASE}/quests/{qB_id}/save", headers=auth(tokenA), timeout=20)
    ok = r.status_code == 200 and r.json().get("saved") is True
    record("A: POST /quests/{qB}/save AGAIN -> idempotent", ok, f"http={r.status_code}")

    # GET /api/users/me/saved
    r = requests.get(f"{BASE}/users/me/saved", headers=auth(tokenA), timeout=20)
    saved_list = r.json() if r.status_code == 200 else []
    contains = any(q.get("id") == qB_id for q in saved_list)
    record("A: GET /users/me/saved contains qB", r.status_code == 200 and contains,
           f"http={r.status_code} len={len(saved_list)}")
    # verify summary projection (no days, no comments) and saved_at present
    if contains:
        target = next(q for q in saved_list if q["id"] == qB_id)
        has_saved_at = "saved_at" in target and bool(target.get("saved_at"))
        no_days = "days" not in target
        no_comments = "comments" not in target
        record("A: saved item has saved_at", has_saved_at, f"saved_at={target.get('saved_at')}")
        record("A: saved item summary projection (no days/comments)", no_days and no_comments,
               f"days_key={ 'days' in target}, comments_key={'comments' in target}")

    # GET /api/users/me/saved-ids contains qB
    r = requests.get(f"{BASE}/users/me/saved-ids", headers=auth(tokenA), timeout=20)
    ids = r.json() if r.status_code == 200 else []
    record("A: GET /users/me/saved-ids contains qB", r.status_code == 200 and qB_id in ids,
           f"http={r.status_code} ids_len={len(ids)}")

    # ---- 3. B does NOT see qB in their saved-ids
    r = requests.get(f"{BASE}/users/me/saved-ids", headers=auth(tokenB), timeout=20)
    ids_b = r.json() if r.status_code == 200 else []
    record("B: GET /users/me/saved-ids does NOT contain qB", r.status_code == 200 and qB_id not in ids_b,
           f"http={r.status_code}")

    # ---- 4. A tries to save own quest
    r = requests.get(f"{BASE}/users/me/quests", headers=auth(tokenA), timeout=20)
    a_quests = r.json() if r.status_code == 200 else []
    if a_quests:
        ownId = a_quests[0]["id"]
        r = requests.post(f"{BASE}/quests/{ownId}/save", headers=auth(tokenA), timeout=20)
        ok = r.status_code == 400 and "own quest" in r.text.lower()
        record("A: save own quest -> 400 'Cannot save your own quest'",
               ok, f"http={r.status_code} body={r.text[:120]}")
    else:
        record("A: save own quest -> 400", False, "A has no quests to test with")

    # ---- 5. Create a draft as A, then B tries to save it
    draft_payload = {
        "title": "Test draft for save-quest endpoint",
        "description": "do not publish",
        "status": "draft",
        "days": [],
        "nodes": [],
    }
    r = requests.post(f"{BASE}/quests", headers=auth(tokenA), json=draft_payload, timeout=20)
    draft = r.json() if r.status_code == 200 else None
    record("A: create draft quest", r.status_code == 200 and draft and draft.get("status") == "draft",
           f"http={r.status_code} status={draft.get('status') if draft else None}")
    draftId = draft["id"] if draft else None

    if draftId:
        r = requests.post(f"{BASE}/quests/{draftId}/save", headers=auth(tokenB), timeout=20)
        ok = r.status_code == 400 and "draft" in r.text.lower()
        record("B: save A's draft -> 400 'Cannot save a draft quest'",
               ok, f"http={r.status_code} body={r.text[:120]}")

    # ---- 6. Nonexistent quest id -> 404
    fake = "00000000-0000-0000-0000-000000000000"
    r = requests.post(f"{BASE}/quests/{fake}/save", headers=auth(tokenA), timeout=20)
    record("A: save nonexistent quest -> 404", r.status_code == 404,
           f"http={r.status_code} body={r.text[:120]}")

    # ---- 7. A unsaves qB
    r = requests.delete(f"{BASE}/quests/{qB_id}/save", headers=auth(tokenA), timeout=20)
    ok = r.status_code == 200 and r.json().get("saved") is False
    record("A: DELETE /quests/{qB}/save -> {saved:false}", ok, f"http={r.status_code}")

    # verify saved-ids no longer has qB
    r = requests.get(f"{BASE}/users/me/saved-ids", headers=auth(tokenA), timeout=20)
    ids = r.json() if r.status_code == 200 else []
    record("A: after unsave, saved-ids does NOT contain qB", r.status_code == 200 and qB_id not in ids,
           f"http={r.status_code}")

    # DELETE again on non-saved -> no-op (saved:false)
    r = requests.delete(f"{BASE}/quests/{qB_id}/save", headers=auth(tokenA), timeout=20)
    ok = r.status_code == 200 and r.json().get("saved") is False
    record("A: DELETE on non-saved is no-op", ok, f"http={r.status_code}")

    # ---- 8. Cascade test: A saves qB again, B (owner) deletes qB, A's saved should not contain qB
    # We need a quest that is OWNED by B and that we are okay deleting.
    # Strategy: create a fresh published quest owned by B, A saves it, B deletes, A's saved list verified.
    pub_payload = {
        "title": "Cascade test quest by B",
        "description": "temp",
        "status": "published",
        "days": [],
        "nodes": [],
    }
    r = requests.post(f"{BASE}/quests", headers=auth(tokenB), json=pub_payload, timeout=20)
    bquest = r.json() if r.status_code == 200 else None
    record("B: create published quest for cascade test",
           r.status_code == 200 and bquest and bquest.get("status") == "published",
           f"http={r.status_code}")
    if bquest:
        bqid = bquest["id"]
        # A saves it
        r = requests.post(f"{BASE}/quests/{bqid}/save", headers=auth(tokenA), timeout=20)
        record("A: save B's fresh quest", r.status_code == 200 and r.json().get("saved") is True,
               f"http={r.status_code}")
        # verify in saved list
        r = requests.get(f"{BASE}/users/me/saved", headers=auth(tokenA), timeout=20)
        contains = any(q.get("id") == bqid for q in r.json())
        record("A: saved list contains B's fresh quest before delete", contains, "")
        # B deletes it
        r = requests.delete(f"{BASE}/quests/{bqid}", headers=auth(tokenB), timeout=20)
        record("B: DELETE own quest", r.status_code == 200, f"http={r.status_code}")
        # verify cascade: A's saved list no longer contains bqid
        r = requests.get(f"{BASE}/users/me/saved", headers=auth(tokenA), timeout=20)
        contains_after = any(q.get("id") == bqid for q in r.json())
        record("CASCADE: A's saved list no longer contains deleted quest",
               r.status_code == 200 and not contains_after, "")
        # also verify saved-ids cleared (saved_quests records actually deleted)
        r = requests.get(f"{BASE}/users/me/saved-ids", headers=auth(tokenA), timeout=20)
        record("CASCADE: A's saved-ids no longer contains deleted quest id",
               r.status_code == 200 and bqid not in r.json(), "")

    # ---- Regression: existing quest flows
    # POST /quests basic
    pq = {"title": "Regression basic quest", "description": "rg", "days": [], "nodes": []}
    r = requests.post(f"{BASE}/quests", headers=auth(tokenA), json=pq, timeout=20)
    created = r.json() if r.status_code == 200 else None
    record("Regression: POST /quests basic", r.status_code == 200 and created and created.get("status") == "published",
           f"http={r.status_code}")

    if created:
        cid = created["id"]
        # GET /quests/{id}
        r = requests.get(f"{BASE}/quests/{cid}", timeout=20)
        record("Regression: GET /quests/{id}", r.status_code == 200 and r.json().get("id") == cid,
               f"http={r.status_code}")
        # PUT
        r = requests.put(f"{BASE}/quests/{cid}", headers=auth(tokenA), json={"title": "Renamed regression quest"}, timeout=20)
        record("Regression: PUT /quests/{id}", r.status_code == 200 and r.json().get("title") == "Renamed regression quest",
               f"http={r.status_code}")
        # GET /quests/feed
        r = requests.get(f"{BASE}/quests/feed?limit=10", headers=auth(tokenA), timeout=20)
        record("Regression: GET /quests/feed", r.status_code == 200 and isinstance(r.json(), list),
               f"http={r.status_code}")
        # DELETE
        r = requests.delete(f"{BASE}/quests/{cid}", headers=auth(tokenA), timeout=20)
        record("Regression: DELETE /quests/{id}", r.status_code == 200, f"http={r.status_code}")

    # cleanup: delete the draft created earlier
    if draftId:
        r = requests.delete(f"{BASE}/quests/{draftId}", headers=auth(tokenA), timeout=20)

    # Summary
    print("\n===== SUMMARY =====")
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"{passed}/{total} passed")
    for name, ok, det in results:
        if not ok:
            print(f"  FAIL: {name} :: {det}")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
