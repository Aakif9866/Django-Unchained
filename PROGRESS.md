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

### 1.1 Git
- [ ] `git init`
- [ ] First commit
- [ ] `.gitignore` created

### 1.2 Dev Environment
- [ ] Python virtual environment created
- [ ] Django + DRF installed
- [ ] MongoDB running locally
- [ ] Node.js / npm / Vite / React set up

### 1.3–1.4 Django + DRF Fundamentals
- [ ] Django project created
- [ ] Django app created
- [ ] First view + URL working
- [ ] DRF installed and first serializer/API view working

### 1.5 MongoDB
- [ ] MongoDB connection from Django working
- [ ] ODM/library choice explained and installed

### 1.6 React Fundamentals
- [ ] Vite React app created
- [ ] First component rendering
- [ ] First API call to Django working

### 1.7 Authentication
- [ ] Auth strategy chosen and explained (session vs JWT)
- [ ] Register endpoint
- [ ] Login endpoint
- [ ] Logout endpoint
- [ ] Current user endpoint
- [ ] Protected backend endpoints
- [ ] Protected frontend routes

### 1.8 Notes CRUD
- [ ] Create note (backend + frontend)
- [ ] List notes (backend + frontend)
- [ ] Read single note (backend + frontend)
- [ ] Update note (backend + frontend)
- [ ] Delete note (backend + frontend)
- [ ] Authorization: user can only access own notes

### 1.9 Phase 1 Verification
- [ ] Manual verification of full auth + CRUD + isolation
- [ ] User can explain architecture back without help

## Phase 2 — Security + Performance Engineering

- [ ] HTTP fundamentals understood
- [ ] Burp Suite proxy set up against local app
- [ ] Auth/authorization tested (IDOR check on notes)
- [ ] CSRF/CORS/security headers tested
- [ ] Vulnerabilities found, fixed, retested, documented
- [ ] Automated test suite written (auth + CRUD + authorization)
- [ ] Performance fundamentals understood (throughput, p50/p95/p99, etc.)
- [ ] Locust tests: 10 → 50 → 100 → 500 → 1,000+ users, analyzed
- [ ] k6 tests written and compared to Locust
- [ ] JMeter used (if it adds learning value) and compared
- [ ] Bottlenecks found and documented in docs/performance.md

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
