# Deferred Tests

Not attempted, and why — none of these are "skipped because they're hard,"
each has a specific, named reason. Updated 2026-09-14 after reproducing
Phase 2 against the Docker/Compose stack (Phase 3) — item 2 below moved
from "not started" to "partially done," items 4 and 7 are new/revised.

| # | Item | Why deferred | What it would take | What we'd learn |
|---|------|-------------|---------------------|------------------|
| 1 | **Manual Burp Suite exploration** | Burp is a GUI proxy tool — Claude cannot drive it. This is explicitly the user's hands-on task per the project's own learning rules. | Install Burp Community, configure the browser proxy, walk through Proxy/Repeater/Intruder against the running app. | The actual skill (reading raw HTTP traffic, manually crafting requests) that the scripted `security_probe.py` deliberately can't teach. |
| 2 | **CI (GitHub Actions) / CD (actual deployment)** | Docker + Compose are now built, tested, and verified end-to-end (this pass) — but the pipeline that would run tests on every push and actually deploy the images is separate Phase 3 work, not yet done. | GitHub Actions workflow: install → test (against a throwaway Postgres service, not Neon) → build images → (CD) push/deploy. | CI pass/fail gating, build reproducibility outside this machine, a real deployment target. |
| 3 | **JMeter** | Locust + k6 already deliver the load-testing and tool-comparison learning goals. The original spec itself says not to use JMeter "simply to say we used three tools." | Install JMeter, build a Test Plan/Thread Group GUI config, run headless. | Marginal beyond what Locust/k6 already showed, for this app's scale. |
| 4 | **Load testing beyond 100 concurrent users (500 / 1,000 / 10,000)** | Now tested against a properly-tuned production WSGI server (gunicorn, gthread, 3x20), not just the dev server — but 100 users is still the ceiling explored so far. | Re-run the same Locust/k6 scripts at higher stages against the Docker stack (or a real deployment, once Phase 3 has one). | Where the tuned config's real ceiling is, and whether the still-unresolved auth-latency variance (see #7) sharpens or smooths out at higher concurrency. |
| 5 | **`test_neondb` cleanup** (DB-02) | `DROP DATABASE` is a destructive action — correctly blocked by the coding agent's own safety classifier, and rightly so; this isn't something to force through. | Run manually: see the command below. | N/A — this is cleanup, not a test. |
| 6 | **Live-triggering a real DEBUG=True 500 to re-screenshot SEC-04b** | The evidence already exists (Phase 1's actual MongoDB failure produced this exact page) — deliberately breaking currently-working code just to re-manufacture a screenshot would be introducing a real failure for a cosmetic reason. Now doubly moot: the Docker build runs DEBUG=False, confirmed live. | N/A — not planned. | N/A |
| 7 | **Isolating the residual auth-latency variance between dev server and Docker** | Found honestly, not resolved: retuning gunicorn's worker/thread config fixed the severe concurrency-slot regression (confirmed with direct evidence), but a *second*, smaller, non-monotonic gap between auth latency in dev vs. Docker remains unexplained (worse in Docker at 50 users, better at 100). The original "PBKDF2 is CPU-bound and GIL-serializes" theory is now uncertain (CPython's hashlib typically releases the GIL for this). Chasing it further now would mean guessing at Neon pool contention, Docker Desktop networking under sustained load, or run-to-run noise on a shared free-tier database — none isolated as the actual cause. | Re-run the comparison against a local, non-shared Postgres (removes Neon's shared-load variance as a variable) or with Neon's Postgres-level query stats/logs visible. | Whether this is environment noise, a real Neon-side contention effect, or something about the request path still worth root-causing — currently genuinely unknown, reported as such rather than guessed at. |

## Cleanup command for #5, when you want it

```bash
cd backend
uv run manage.py dbshell
# then, inside the psql prompt:
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'test_neondb' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS test_neondb;
```
