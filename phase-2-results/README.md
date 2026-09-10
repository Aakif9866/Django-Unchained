# Phase 2 Results

Real, evidence-backed testing of the Notes app as it stood on
`phase-2-security-performance` — no fabricated numbers, no invented
scores. Where something wasn't tested, it's marked `DEFERRED` with a
reason, not silently omitted.

**Read `EXECUTIVE_SUMMARY.md` first.**

## Structure

```
EXECUTIVE_SUMMARY.md   ← start here
TEST_MATRIX.md         ← every discrete pass/fail test, one table
DEFERRED_TESTS.md       ← what wasn't tested and why

SECURITY/findings.md    ← 4 open findings (2 HIGH, 1 MEDIUM, 1 LOW), 4 confirmed-safe
PERFORMANCE/results.md  ← Locust (10/50/100 users) + k6, the real bottleneck found
API/results.md          ← 19/19 automated tests, what they cover and don't
DATABASE/findings.md    ← Postgres/Neon-specific findings
RELIABILITY/results.md  ← malformed input, oversized fields, race conditions

RAW_RESULTS/            ← every raw JSON/CSV a claim above is backed by
dashboard-data.json     ← single source of truth consumed by the in-app dashboard (/testing-dashboard)
```

## How this was produced

Scoped speedrun exception (see `PROGRESS.md`) — Claude executed this
autonomously at the user's explicit request, given the time constraint,
with two hard boundaries kept in place: Docker/DevOps stayed out (Phase
3 scope, untouched here), and manual Burp Suite exploration is
explicitly **not** replicated here — that's still the user's hands-on
task, tracked separately.

## Reproducing any of this

```bash
# Backend, from repo root
cd backend && uv run manage.py runserver 8000 &

# Automated test suite
cd backend && uv run manage.py test accounts notes -v 2

# Security + reliability probes (needs the server running)
cd testing && uv run security_probe.py
cd testing && uv run reliability_probe.py

# Load tests (needs the server running)
cd testing && uv run locust -f locustfile.py --host=http://127.0.0.1:8000 \
    --headless -u 50 -r 5 -t 40s --csv=../phase-2-results/RAW_RESULTS/locust_50users
cd testing && k6 run k6_script.js
```
