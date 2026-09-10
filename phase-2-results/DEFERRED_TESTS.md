# Deferred Tests

Not attempted, and why — none of these are "skipped because they're hard,"
each has a specific, named reason.

| # | Item | Why deferred | What it would take | What we'd learn |
|---|------|-------------|---------------------|------------------|
| 1 | **Manual Burp Suite exploration** | Burp is a GUI proxy tool — Claude cannot drive it. This is explicitly the user's hands-on task per the project's own learning rules. | Install Burp Community, configure the browser proxy, walk through Proxy/Repeater/Intruder against the running app. | The actual skill (reading raw HTTP traffic, manually crafting requests) that the scripted `security_probe.py` deliberately can't teach. |
| 2 | **Docker / CI-CD / DevOps testing** | Explicitly Phase 3 scope by the project's own plan. The app isn't containerized yet — testing container behavior now would test something that doesn't exist. | Phase 3.4 onward: Dockerfiles, Compose, GitHub Actions. | Build/image size, container startup behavior, CI pass/fail gating — all real Phase 3 material. |
| 3 | **JMeter** | Locust + k6 already deliver the load-testing and tool-comparison learning goals. The original spec itself says not to use JMeter "simply to say we used three tools." | Install JMeter, build a Test Plan/Thread Group GUI config, run headless. | Marginal beyond what Locust/k6 already showed, for this app's scale. |
| 4 | **Load testing beyond 100 concurrent users (500 / 1,000 / 10,000)** | The bottleneck found at 100 users (auth latency) is a property of `manage.py runserver` — Django's own dev server, explicitly not meant for load. Pushing further now would mostly re-measure the dev server's ceiling, not the app's real capacity. | Re-run the same Locust/k6 scripts against a production WSGI server (Gunicorn, multiple workers) once Phase 3 containerizes the app. | Whether the GIL-serialization bottleneck actually goes away with multiple worker processes, as hypothesized in `dashboard-data.json`'s bottleneck analysis. |
| 5 | **`test_neondb` cleanup** (DB-02) | `DROP DATABASE` is a destructive action — correctly blocked by the coding agent's own safety classifier, and rightly so; this isn't something to force through. | Run manually: see the command below. | N/A — this is cleanup, not a test. |
| 6 | **Live-triggering a real DEBUG=True 500 to re-screenshot SEC-04b** | The evidence already exists (Phase 1's actual MongoDB failure produced this exact page) — deliberately breaking currently-working code just to re-manufacture a screenshot would be introducing a real failure for a cosmetic reason. | N/A — not planned. | N/A |

## Cleanup command for #5, when you want it

```bash
cd backend
uv run manage.py dbshell
# then, inside the psql prompt:
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'test_neondb' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS test_neondb;
```
