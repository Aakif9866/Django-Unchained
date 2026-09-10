# Test Matrix

Every discrete pass/fail test executed, in one table. Load-test runs
(which produce metrics, not a single pass/fail) are in
`PERFORMANCE/results.md` instead. Raw evidence for every row lives in
`RAW_RESULTS/`.

## Automated API/Auth/CRUD/Authorization suite (`backend/accounts/tests.py`, `backend/notes/tests.py`)

Run with `uv run manage.py test accounts notes -v 2`, against real Neon Postgres.

| ID | Test | Status |
|----|------|--------|
| A-01 | Register creates user with hashed (not plaintext) password | PASS |
| A-02 | Register rejects duplicate username | PASS |
| A-03 | Register enforces Django's password validators | PASS |
| A-04 | Login with correct credentials succeeds | PASS |
| A-05 | Login with wrong password fails (401) | PASS |
| A-06 | `/api/auth/me/` requires authentication (403 when anonymous) | PASS |
| A-07 | `/api/auth/me/` returns current user when logged in | PASS |
| A-08 | Logout ends the session | PASS |
| N-01 | Create note | PASS |
| N-02 | List notes returns only the current user's notes | PASS |
| N-03 | Read single note | PASS |
| N-04 | Update note | PASS |
| N-05 | Delete note | PASS |
| N-06 | Notes endpoints require authentication | PASS |
| Z-01 | Other user cannot read a note they don't own (404) | PASS |
| Z-02 | Other user cannot update a note they don't own (404) | PASS |
| Z-03 | Other user cannot delete a note they don't own (404) | PASS |
| Z-04 | Other user's note absent from your own list | PASS |
| Z-05 | Nonexistent note ID and someone-else's note ID return identical 404 responses | PASS |

**19/19 PASS.** Suite took 148.3s — see `PERFORMANCE/results.md` for why.

## Security probes (`testing/security_probe.py`)

| ID | Test | Status | Severity |
|----|------|--------|----------|
| SEC-01 | Authenticated POST without CSRF token is rejected | PASS | N/A |
| SEC-01b | Anonymous POST (register) CSRF exposure ("login CSRF") | INFO | LOW |
| SEC-02 | CORS preflight from an untrusted origin is refused | PASS | N/A |
| SEC-03a | Baseline hardening headers present (nosniff, X-Frame-Options, Referrer-Policy, COOP) | PASS | N/A |
| SEC-03b | HSTS header absent (correct for dev) | INFO | INFO |
| SEC-03c | Content-Security-Policy header | **FAIL** | MEDIUM |
| SEC-04a | DEBUG=True technical 404 reveals URL structure | **FAIL** | LOW |
| SEC-04b | DEBUG=True full traceback disclosure on unhandled 500s | **FAIL** | HIGH |
| SEC-05 | Login endpoint resists rapid brute-force attempts | **FAIL** | HIGH |
| SEC-06 | Session cookie is HttpOnly | PASS | N/A |

**4 PASS, 2 INFO, 4 FAIL** (2 HIGH, 1 MEDIUM, 1 LOW).

## Reliability / failure-scenario probes (`testing/reliability_probe.py`)

| ID | Test | Status |
|----|------|--------|
| REL-01 | Malformed JSON body → clean 400, not a 500 | PASS |
| REL-02 | Oversized field (10,000 chars) rejected by validation, not the DB | PASS |
| REL-03 | 5 concurrent identical-username registrations → exactly 1 succeeds | PASS |

**3/3 PASS.**

## Database

| ID | Finding | Status | Severity |
|----|---------|--------|----------|
| DB-01 | `ForeignKey(owner)` auto-indexed, FK constraint enforced by Postgres | PASS | N/A |
| DB-02 | Test DB teardown fails against Neon's pooled connection (`ObjectInUse`) | ISSUE | LOW |

## Totals

| | Count |
|---|---|
| Total tests | 32 |
| Passed | 26 |
| Failed | 4 |
| Info (not pass/fail) | 2 |
| Blocked | 0 |
| Deferred | 6 (see `DEFERRED_TESTS.md`) |
| Critical findings | 0 |
| High findings | 2 |
| Medium findings | 1 |
| Low findings | 1 |

(SEC-01b is recorded as `INFO`/`ACCEPTED` — documented, by-design DRF
behavior, not counted as an open finding needing a fix. See
`SECURITY/findings.md`.)
