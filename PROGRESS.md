# PROGRESS.md

Live checklist of what has actually been done — by the user, personally,
and verified. Nothing gets checked off just because Claude wrote code for
it.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done & verified

## Phase 0 — Setup & Understanding

- [~] Documentation structure created
- [ ] Phase 1 → 2 → 3 roadmap explained and understood
- [ ] Architecture explained and understood

## Phase 1 — Application Engineering

> **2026-09-10 — Speedrun note:** at the user's explicit request (time
> constraint, prior MERN-notes experience), Claude built Phase 1 in one
> pass instead of the concept-by-concept cycle — see `docs/decisions.md`
> for the choices made along the way. Everything below is marked `[~]`
> (code exists, functionally verified by Claude via curl/build, running
> live against real MongoDB) rather than `[x]` — per this file's own rule,
> `[x]` only happens once the user has personally run it and can explain
> it back. Converting `[~]` → `[x]` is literally 1.9 below.

### 1.1 Git
- [x] `git init`
- [x] First commit
- [x] `.gitignore` created

### 1.2 Dev Environment
- [~] uv-managed Python environment created (`backend/pyproject.toml` + `.venv`)
- [~] Django + DRF installed
- [~] Database reachable (Neon Postgres — originally MongoDB Atlas, see docs/decisions.md)
- [~] Node.js / npm / Vite / React set up

### 1.3–1.4 Django + DRF Fundamentals
- [~] Django project created (`backend/config/`)
- [~] Django apps created (`accounts`, `notes`)
- [~] Views + URLs working (`/api/auth/*`, `/api/notes/*`)
- [~] DRF serializers/API views working

### 1.5 Database
> **2026-09-11 — migrated off MongoDB to PostgreSQL (Neon)**, on branch
> `postgres-migration`, at the user's direction after they identified
> Django's ORM/migrations/admin as fundamentally relational. Full
> reasoning in `docs/decisions.md`; original MongoDB entries kept there,
> marked superseded, not deleted.
- [~] Database connection from Django working (`config/settings.py` DATABASES, real `Note` ORM model)
- [~] Integration approach (and the migration's reasoning) explained in docs/decisions.md

### 1.6 React Fundamentals
- [~] Vite React app created (`frontend/`, JavaScript — see docs/decisions.md)
- [~] Components rendering (Login, Register, Notes sidebar + editor)
- [~] API calls to Django working (`frontend/src/api/client.js`)

### 1.7 Authentication
- [~] Auth strategy chosen and explained (session cookie — see docs/decisions.md)
- [~] Register endpoint
- [~] Login endpoint
- [~] Logout endpoint
- [~] Current user endpoint
- [~] Protected backend endpoints (`IsAuthenticated` default)
- [~] Protected frontend routes (`ProtectedRoute`)

### 1.8 Notes CRUD
- [~] Create note (backend + frontend)
- [~] List notes (backend + frontend)
- [~] Read single note (backend)
- [~] Update note (backend + frontend)
- [~] Delete note (backend + frontend)
- [~] Authorization: user can only access own notes (curl-verified: alice/bob isolation, 404 not 403)

### 1.9 Phase 1 Verification — THE ACTUAL NEXT STEP
- [ ] User has personally run the app (both servers, register/login/CRUD in the browser)
- [ ] User has read through backend + frontend code with Claude and can explain each piece
- [ ] Manual verification of full auth + CRUD + isolation, by the user
- [ ] User can explain architecture back without help

## Phase 2 — Security + Performance Engineering

> **2026-09-11 — Scoped speedrun exception** (see `docs/decisions.md`
> conversation context and `phase-2-results/README.md`): at the user's
> explicit request, Claude executed most of Phase 2 autonomously —
> automated tests, scripted security probing, Locust/k6 load testing,
> reliability checks, and a results dashboard. Two things were
> deliberately kept out and remain the user's own work: **manual Burp
> Suite exploration** (a GUI tool Claude cannot drive — this is not
> optional, it's the one piece of Phase 2 that can't be automated around)
> and **Docker/DevOps**, which stayed in Phase 3 as originally planned.
> Everything below is `[~]`, not `[x]`, for the same reason as Phase 1's
> speedrun — code and results exist and are verified, but the user
> hasn't personally worked through them yet.

- [ ] HTTP fundamentals understood
- [ ] **Burp Suite proxy set up against local app — still genuinely outstanding, not automatable**
- [~] Auth/authorization tested (IDOR check on notes) — exhaustively covered by automated tests (`phase-2-results/TEST_MATRIX.md`, tests Z-01–Z-05), not yet by the user's own Burp exploration
- [~] CSRF/CORS/security headers tested — scripted probe done (`phase-2-results/SECURITY/findings.md`); 2 open findings (no rate limiting, DEBUG=True)
- [~] Vulnerabilities found, documented — found and documented; **not yet fixed** (see findings list); retest pending the fix
- [~] Automated test suite written — 19 tests, all passing, but written by Claude, not the user (spec said "write as much yourself as practical")
- [ ] Performance fundamentals understood (throughput, p50/p95/p99, etc.) — results exist, concepts not yet explained/taught
- [~] Locust tests: 10 → 50 → 100 done and analyzed; 500/1,000+ deferred (see `phase-2-results/DEFERRED_TESTS.md` — needs a production WSGI server first, not the dev server)
- [~] k6 tests written and compared to Locust
- [x] JMeter — deliberately not used; Locust+k6 already met the comparison goal (see DEFERRED_TESTS.md)
- [~] Bottlenecks found and documented — real one found (auth latency under concurrency), root-caused, in `docs/performance.md`

## Phase 3 — DevOps / Production Engineering

- [ ] Git workflow (branches, PRs) in use
- [ ] `.env` / environment variable management in place, secrets never
      committed
- [ ] Backend Dockerfile written by user
- [ ] Frontend Dockerfile written by user
- [ ] Docker Compose (React + Django + MongoDB) written by user
- [ ] GitHub Actions CI pipeline (install → test → build)
- [ ] CD pipeline (build images → deploy)
- [ ] Nginx reverse proxy configured
- [ ] Logging in place (and verified nothing sensitive is logged)
- [ ] Monitoring in place

## Capstone

- [ ] User can answer architecture/auth/REST/security/performance/DevOps
      interview questions without AI assistance
