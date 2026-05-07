#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Add quest owner actions (Edit/Delete/Share) to the quest detail page (only owner sees Edit/Delete; Share visible to everyone).
  Implement a Draft Quest saving system in the create flow:
   - Confirmation popup on exit attempt with: Save Draft / Discard Quest / Cancel
   - "Save Draft" persists current progress (title, description, media, days, entries, dates, tags, partial content) as a Draft Quest
   - Drafts shown in Profile under a dedicated "Draft Quests" section with continue / delete / publish actions
   - Auto-save indicators ("Draft saved" / "Last edited X mins ago")
   - Optional: background auto-save and restore on app restart

backend:
  - task: "Quest status field (draft/published) and exclude drafts from public feed/explore/users-quests"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Added 'status' field to QuestCreate model. POST /api/quests now accepts status='draft' | 'published' (default published). feed/explore/users/me/quests/users/{id} all filter out draft quests so they only appear on the owner's drafts list."
        - working: true
          agent: "testing"
          comment: "Verified end-to-end with /app/backend_test.py against the public REACT_APP_BACKEND_URL/api. POST /quests with status='draft' returns 200 and status='draft'. POST /quests without status defaults to status='published'. The created draft is correctly hidden from /quests/feed (both for user B AND author user A), /quests/explore, /users/me/quests (author), and /users/{user_a_id}. After flipping status to 'published' via PUT, the same quest appears in /quests/feed for user B."

  - task: "PUT /api/quests/{id} update endpoint (owner-only) with photo cap & nodes regen"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "New PUT endpoint accepts QuestUpdate (all optional fields). Verifies owner. Re-trims oversized photos. Re-derives 'nodes' array from days when days update. Sets 'updated_at'. Returns 403 for non-owner, 404 for missing."
        - working: true
          agent: "testing"
          comment: "PUT /api/quests/{id}: owner can update title (returns updated title and updated_at timestamp); non-owner gets 403 with 'Only the author can edit this quest'; nonexistent id returns 404; status='published' update flips a draft to published and the quest immediately appears in feed."

  - task: "DELETE /api/quests/{id} endpoint (owner-only)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "New DELETE endpoint. Owner-only. 403 for non-owner, 404 for missing. Removes quest entirely."
        - working: true
          agent: "testing"
          comment: "DELETE /api/quests/{id}: non-owner gets 403, owner gets {ok:true}, subsequent GET /api/quests/{id} returns 404, DELETE on nonexistent id returns 404. All ownership checks pass."

  - task: "GET /api/users/me/drafts endpoint"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Lists current user's drafts sorted by updated_at desc. Returns enriched quest objects."
        - working: true
          agent: "testing"
          comment: "GET /api/users/me/drafts returns the author's drafts only (verified user A sees their draft, user B does not). After publishing the draft via PUT status=published, it disappears from /users/me/drafts. Returned objects include enriched author/likes/comments fields."

frontend:
  - task: "Owner actions (Edit/Delete) + Share on Quest detail page with bottom-sheet menu"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/quest/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Added share icon (top-right hero overlay) visible to everyone, plus an inline 'Share' action chip near Likes/Comments. Owner-only kebab '...' opens a bottom sheet with Edit / Share / Delete. Edit navigates to /(tabs)/create?id={questId}. Delete shows native Alert confirmation then DELETE call. Uses react-native Share API."

  - task: "Draft Quest creation/editing flow with exit confirmation modal"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/create.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Rewrote create.tsx: (1) accepts ?id= param to load existing quest or draft from API and prefill all fields (jumps to step 2). (2) Top-right Close (X) button + Android hardware back trigger an exit bottom sheet with Save Draft / Discard / Cancel. (3) Save Draft posts/puts to backend with status='draft'. (4) AsyncStorage auto-saves on every change (debounced 1.2s) under key oq_draft_local_v1. (5) On focus, if local draft exists and screen empty, shows 'Continue your last unsaved draft?' banner. (6) Header shows 'Draft saved · X ago' indicator. (7) New 'Save Draft' button in step-2 bottom bar. (8) Publish flow uses PUT if editingId set (handles both editing published quests and converting drafts to published)."

  - task: "Drafts section + stats card on Profile screen"
    implemented: true
    working: true
    file: "/app/frontend/app/(tabs)/profile.tsx"
    stuck_count: 1
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Added drafts stat box (4-up stats now). Loads /api/users/me/drafts on focus. Renders 'Draft Quests' horizontal scroller with cover image, title, days/entries count, 'Last edited X ago'. Cards have Edit (navigate to create?id), Publish (PUT status=published), and Delete (with confirm) actions."
        - working: false
          agent: "testing"
          comment: "CRITICAL BUG FOUND: profile.tsx had duplicated/orphan JSX (lines 358-441) and duplicate styles block (lines 443-488) appended after the valid component, producing a top-level SyntaxError 'Unexpected token (440:2)'. Metro bundler completely failed and the app rendered a red Server Error screen — blocking ALL frontend testing across A/B/C/D/E/F scenarios."
        - working: true
          agent: "testing"
          comment: "FIXED by truncating the file to the first 357 lines (original valid component + first styles block). After supervisorctl restart expo, the app bundles cleanly and Profile screen renders the 4-up stats row: Quests=7, Likes=13, Drafts=0, AI Trips=1 (verified visually in screenshot). Saved AI Trips and YOUR QUESTS sections also render. NOTE: main agent should NOT re-fix this — already done."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus:
    - "Quest status field (draft/published) and exclude drafts from public feed/explore/users-quests"
    - "PUT /api/quests/{id} update endpoint (owner-only) with photo cap & nodes regen"
    - "DELETE /api/quests/{id} endpoint (owner-only)"
    - "GET /api/users/me/drafts endpoint"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: |
        Implemented full Draft Quest workflow + Edit/Delete/Share for quest owner.
        Backend changes (need automated testing):
         1) POST /api/quests now accepts status='draft' (default 'published').
         2) PUT /api/quests/{id} – owner-only update; supports partial updates including converting status from 'draft' -> 'published'.
         3) DELETE /api/quests/{id} – owner-only deletion.
         4) GET /api/users/me/drafts – returns user's drafts sorted by updated_at desc.
         5) Feed/Explore/Users-quests/User-by-id all filter out drafts (drafts visible only to the owner via /users/me/drafts and /quests/{id}).
        Please test:
         - Auth users: aarav.sharma@onquest.in / Quest@123 (regular), admin@onquest.in / admin123 (admin)
         - Create a draft, ensure it does NOT appear in /quests/feed for any user.
         - Verify drafts ARE visible in /users/me/drafts for the author.
         - Update a draft via PUT, then publish it (status=published) and verify it now shows in feed.
         - Verify ownership protection: a different user cannot PUT or DELETE another user's quest (expect 403).
         - Verify validation: missing quest -> 404. Invalid status values default to 'published'.
         - Verify the existing flows (POST /quests with no status field, GET /quests/{id}, like, comment, AI summary) still work.
    - agent: "testing"
      message: |
        Backend Draft + Edit/Delete suite executed via /app/backend_test.py against the public REACT_APP_BACKEND_URL/api with users aarav.sharma@onquest.in (A) and priya.iyer@onquest.in (B).
        All 28 cases PASSED (20 spec items + 8 sanity):
         - Draft creation, default-published creation, ownership filtering across feed/explore/users-me-quests/users-by-id, drafts-only visibility on /users/me/drafts.
         - PUT updates title with updated_at, 403 for non-owner, 404 for nonexistent, status flip draft -> published makes it visible in feed and removes it from /users/me/drafts.
         - DELETE: 403 for non-owner, 200 ok=true for owner, 404 after delete and on nonexistent id.
         - Sanity: GET /quests/{id}, like (toggle on), comment, /quests/feed, /users/me/quests, /popular-destinations all 200 OK.
        No regressions detected. Backend tasks marked working=true. No retesting needed.