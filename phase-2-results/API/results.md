# API Test Results

Automated suite: `backend/accounts/tests.py`, `backend/notes/tests.py`.
Run: `cd backend && uv run manage.py test accounts notes -v 2`

**19/19 passed**, against real Neon Postgres (not a mock/in-memory DB —
Django spins up and tears down a real `test_neondb` database for the
run; see `DATABASE/findings.md` for the one issue found in that
teardown).

Full breakdown in `../TEST_MATRIX.md`. Coverage:

- Registration: hashing, duplicate-username rejection, password
  validator enforcement
- Login/logout/session: correct credentials, wrong credentials,
  `/me/` authentication requirement
- Notes CRUD: all five operations
- Authorization: the five IDOR-adjacent tests — this is the section
  that matters most given the project's authorization requirement, and
  it's exhaustively covered (read/update/delete/list all denied
  cross-user, and the "doesn't exist" vs "not yours" responses are
  identical)

**Not covered by this suite** (candidates for you to add, since Phase
2.3 says "write as much of these yourself as practical"):
- Concurrent modification of the same note (two PATCHes racing)
- Pagination/large note-count behavior (there is currently no pagination
  on `GET /api/notes/` at all — every note loads in one response, which
  is itself worth testing once a user has, say, 10,000 notes)
- Frontend-level tests (this suite is backend-only)
