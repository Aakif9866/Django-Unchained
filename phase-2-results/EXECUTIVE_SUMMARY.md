# Phase 2 Executive Summary

**Updated 2026-09-14** — reproduced against the Docker/Compose stack
built in Phase 3 (`phase-3-devops-production`), not just the dev server.
Original run: 2026-09-11, dev server only. What changed and why is
tracked inline below, not hidden.

## Overall assessment

The application is **functionally solid and correctly authorized** —
every authentication and cross-user-isolation test passed, including
under true multi-process concurrency (Docker/gunicorn), which is a
stronger test than the dev server's threading ever was. Two of the
original four security findings are now **resolved for the deployment
path** (the `DEBUG=True` disclosure risks — confirmed absent once
actually running with `DEBUG=False`, as the Docker build does). Two
remain open and are target-independent (no rate limiting, no CSP).
Performance investigation this pass found and fixed one severe,
well-evidenced regression (gunicorn's default worker class), and
surfaced one smaller, honestly-unresolved variance that further
investigation is deferred on rather than guessed at.

| Area | Status | Why |
|------|--------|-----|
| Security | **AT RISK** | 1 HIGH, 1 MEDIUM finding remain, both target-independent. 2 findings resolved by the Docker build's `DEBUG=False`. |
| Performance | **OK, with a known regression found+fixed and one open question** | 0% failures at every stage, every environment. gunicorn's default sync workers caused a severe concurrency regression — found, root-caused, and fixed with gthread workers. A separate, smaller auth-latency variance vs. the dev server remains genuinely unexplained. |
| Reliability | **OK** | All malformed-input, oversized-field, and race-condition tests passed — the race condition test now verified under TRUE multi-process parallelism, not just threads. |
| Scalability | **UNKNOWN beyond 100 users** | Not tested further yet — see `DEFERRED_TESTS.md` #4 |
| Database | **OK, with a minor test-infra issue** | Real FK/index behavior correct, reconfirmed. Test teardown against Neon's pooled connection still needs a config fix (DB-02). |
| DevOps | **OK, with findings** | Docker + Compose built, tested, and verified end-to-end this pass — two real bugs found and fixed during the build (see below). CI/CD still not done. |

## Test statistics

| | |
|---|---|
| Total tests | 32 |
| Passed | 28 |
| Failed | 2 |
| Info (documented, not failures) | 2 |
| Blocked | 0 |
| Deferred | 7 |
| Critical | 0 |
| High | 1 |
| Medium | 1 |
| Low | 1 |

## Top findings

| ID | Category | Finding | Severity | Status |
|----|----------|---------|----------|--------|
| SEC-05 | Security | No rate limiting on login — unlimited brute-force attempts | HIGH | Open |
| SEC-03c | Security | No Content-Security-Policy header | MEDIUM | Open |
| DEVOPS-1 | DevOps | gunicorn default sync workers caused severe concurrency regression under load | (found & fixed) | Resolved — see `PERFORMANCE/results.md` |
| DEVOPS-2 | DevOps | Non-root Docker user couldn't create `staticfiles/` at runtime (directory ownership) | (found & fixed) | Resolved — see `README.md`'s Docker section |
| DB-02 | Database | Test DB teardown fails against Neon's pooled connection | LOW | Open |
| SEC-04a/04b | Security | `DEBUG=True` info disclosure | — | **Resolved** for the Docker build (`DEBUG=False`), N/A for local dev by design |

## What surprised us (this pass)

- **The original performance hypothesis was half right, in a way that mattered.** "Multiple worker processes fix CPU-bound password-hashing contention" was the plan — but gunicorn's *default* worker class (`sync`) turned out to cause a far more severe problem first: only 3 concurrent request slots for the whole backend, regardless of what's CPU- vs I/O-bound. Found by noticing that even a zero-DB-work endpoint (`/api/auth/csrf/`) degraded to 22-second p95 latency, which no CPU-bound hashing theory could explain — that pointed straight at request-slot queueing instead.
- **Fixing the queueing problem didn't fully validate the original theory.** After the fix, auth latency vs. notes CRUD, compared across dev-server and Docker, doesn't move in a single consistent direction (worse in Docker at 50 users, better at 100). Reported as genuinely unresolved — see `DEFERRED_TESTS.md` #7 — rather than forcing a tidy explanation onto noisy data.
- **A second real Docker bug**, independent of performance: a non-root container user couldn't create its own `staticfiles/` directory, because `WORKDIR` creates that directory as `root` before a later `COPY --chown` step runs — chown only applied to copied files, not the pre-existing directory.
- **The reliability test suite caught its own bug.** A rerun of the concurrent-registration race test initially showed a false "FAIL" — traced to a hardcoded test username already claimed by a previous run against the shared Neon database, not a real race condition. Fixed by generating a fresh username per run.

## Most important fixes made this pass

- `backend/entrypoint.sh`: `--worker-class gthread --threads 20` (was: default sync workers) — the concurrency-slot fix.
- `backend/Dockerfile`: explicit `chown appuser:appuser /app` after the build-stage copy.
- `docker-compose.yml`: read-only volume mount for `phase-2-results/` so the dashboard endpoint can actually find its data file inside the container (the backend image's build context never included anything outside `backend/`).
- `testing/reliability_probe.py`: fresh UUID-suffixed username per run, not a hardcoded one.

## What remains

- The user's own hands-on Burp Suite session.
- SEC-05 (rate limiting) and SEC-03c (CSP) — still open, unchanged.
- The unresolved auth-latency variance (`DEFERRED_TESTS.md` #7).
- CI/CD — not started.

## Recommended Phase 3 focus, updated

Docker is done and genuinely load-tested, not just "it starts." Next:
GitHub Actions CI (tests against a throwaway Postgres, not Neon — sidesteps
DB-02 entirely for CI), then a real CD target. The gunicorn worker/thread
tuning found here should travel into whatever CI/CD config gets built,
not be forgotten as a one-off local fix.
