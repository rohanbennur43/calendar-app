# TODOS

## Multi-tab coordination via BroadcastChannel

**What:** Add tab coordination to prevent data loss when multiple browser tabs write to the same JSON file simultaneously.

**Why:** Currently, if two tabs are open, they can both read and write the same monthly JSON file at the same time, causing a race condition (two things happen at the same time and step on each other) where one tab's changes overwrite the other's. This results in silent data loss.

**Pros:**
- Prevents data corruption from concurrent writes
- Allows user to safely have multiple tabs open

**Cons:**
- Adds complexity (leader election, message passing between tabs)
- 45 min implementation effort
- May be overkill for personal tool where user is unlikely to multi-tab

**Context:**
The File System Access API doesn't provide file locking. The standard solution is BroadcastChannel API where tabs communicate and only one "leader" tab performs writes. Others send their changes to the leader. If the leader tab closes, remaining tabs elect a new leader.

Implementation approach:
1. On app load, join BroadcastChannel named 'job-tracker-sync'
2. Elect leader (first tab to respond to ping, or use timestamp-based election)
3. Non-leader tabs send save requests via channel
4. Leader tab writes to files, broadcasts confirmation
5. On leader close, trigger re-election

**Depends on:** None

**Blocked by:** None

**Trigger:** User reports data loss from having multiple tabs open. Until then, document "single tab only" in README.

---

## Blob URL cleanup to prevent memory leaks

**What:** Track blob URLs created for resume viewing and explicitly revoke them to free memory.

**Why:** Each time the user clicks a resume to view it, the app creates a blob URL via `URL.createObjectURL(file)`. These URLs stay in memory until explicitly revoked with `URL.revokeObjectURL(url)`. If the user opens 20 resumes over a session, that's 20-100MB of memory leaked.

**Pros:**
- Prevents memory accumulation during long sessions
- Improves tab stability if user views many resumes

**Cons:**
- Adds state tracking (array of active blob URLs)
- 25 min implementation effort
- Leak is minor for personal use (user will likely refresh page before it matters)

**Context:**
Blob URLs aren't garbage collected automatically. The pattern is:
1. Create blob URL: `const url = URL.createObjectURL(file)`
2. Use it (open in new tab, set as img src)
3. Revoke when done: `URL.revokeObjectURL(url)`

For resume viewing, we create the blob and open it in a new tab. We never revoke it. Over many resumes, this accumulates.

Implementation approach:
- Keep global array: `const activeBlobURLs = []`
- After creating blob URL, push to array
- On detail view close, revoke all blob URLs from that view and remove from array
- Optional: set 5-minute timeout to auto-revoke old URLs even if view stays open

**Depends on:** None

**Blocked by:** None

**Trigger:** If you notice the app tab using excessive memory (check Chrome Task Manager) after viewing many resumes in one session. Not urgent for V1.

---

## Comprehensive test coverage for edge cases

**What:** Add tests for edge cases and error paths not covered in V1 test suite.

**Why:** V1 tests cover core use case (resume interview scenario) and critical error paths (schema validation, permission expiry). Many edge cases are untested: hash collision detection, double-click Save prevention, multi-month streak boundary calculations, empty state variations.

**Pros:**
- Catches bugs before they reach production use
- Builds confidence in edge case handling
- Makes future refactoring safer

**Cons:**
- 1 day of effort for ~15-20 additional tests
- Some edge cases may never occur in practice (hash collision is astronomically rare)

**Context:**
V1 test suite (5 tests):
- ✅ E2E: Resume interview scenario (core use case)
- ✅ E2E: Log activity happy path
- ✅ E2E: Dashboard load happy path
- ✅ Unit: Schema validation (corrupted JSON)
- ✅ E2E: Permission expiry handling

Deferred to V2 (edge cases):
- Hash collision: Two different files produce same SHA-256 hash
- Double-click Save: User clicks Save button twice rapidly
- Multi-month streak: Streak calculation across month boundary (e.g., March 31 → April 1)
- File extension preservation: Verify .docx files don't get saved as .pdf
- Empty states: First day of new month, brand new app with no data
- Disk full during write: Partial write leaves corrupted JSON
- Resume file deleted externally: User manually deletes file from resumes/ folder

Implementation approach:
Create `test/edge-cases.test.js` with unit and E2E tests for each deferred case. Use test framework matching the project (detect in CLAUDE.md or package.json).

**Depends on:** V1 core test suite passing

**Blocked by:** None

**Trigger:** After V1 ships and you've used it for 1-2 weeks without major bugs in core flows. Then add edge case coverage before expanding features.
