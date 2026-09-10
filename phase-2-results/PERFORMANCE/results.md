# Performance & Load Testing Results

Target: local Django dev server (`manage.py runserver`, single process) →
real MongoDB-replacement, Postgres on Neon (network round-trip, not
localhost). This matters — see "the honest caveat" below.

## Automated test suite latency (a performance signal, not just correctness)

19 simple Django tests took **148.3 seconds** — each does 1-3 real
queries against Neon. That's a direct measurement of per-query network
round-trip cost from this location to Neon's `us-east-2` region, and it's
the same cost that shows up in the load tests below.

## Load test stages (Locust)

Simulated flow per virtual user: register → login → repeat(list, create,
read, update, delete) with 1-3s think-time between actions. Full raw
output: `RAW_RESULTS/locust_*users_stats.csv`.

| Users | Spawn rate | Duration | Requests | Failures | Req/s | Notes avg / p95 | Auth avg / p95 |
|-------|-----------|----------|----------|----------|-------|-------------------|-------------------|
| 10 | 2/s | 30s | 83 | **0 (0.00%)** | 3.10 | 856ms / 980ms | 2,882ms / 3,000ms |
| 50 | 5/s | 40s | 574 | **0 (0.00%)** | 14.43 | 845ms / 910ms | 3,037ms / 3,200ms |
| 100 | 10/s | 45s | 1,111 | **0 (0.00%)** | 24.75 | 850ms / 910ms | 6,104ms / 7,500ms |

**Zero failed requests at every stage.** The app did not crash or error
under load — it got slower, specifically on auth endpoints.

## k6 comparison run

50 VUs, staged 10s ramp-up → 20s sustained → 5s ramp-down, same user flow
condensed into one k6 script (`testing/k6_script.js`).

```
checks_succeeded: 100.00% (501/501)
http_req_failed:  0.00% (0/835)
http_req_duration: avg=1.42s  p90=3.25s  p95=3.97s  max=4.61s
throughput: 19.51 req/s
```

Independently confirms the Locust 50-user run's overall latency scale
(k6 measures whole-flow duration per request rather than splitting by
endpoint name the way Locust does, so it's not a line-for-line match —
it's a second tool landing in the same range, which is the point of
running both).

**Locust vs k6, as actually experienced building both:**

| | Locust | k6 |
|---|---|---|
| Scripting language | Python — easy to carry real state (note IDs) between requests using normal Python data structures | JavaScript — cookie jar API is more manual, but the whole flow is more explicit in one function |
| Built-in reporting | Per-named-request breakdown (as configured via `name=`) | Aggregate + configurable thresholds as a pass/fail gate (`http_req_failed: rate<0.01`) baked into the run itself |
| Setup cost | `uv add locust`, pure Python | Needed a separate binary (`brew install k6`) |
| Best fit here | Understanding *which* endpoint is slow | A single pass/fail signal suitable for a CI gate later |

## The bottleneck: auth latency grows non-linearly, notes CRUD doesn't

```
Users:        10       50       100
Notes avg:    856ms    845ms    850ms   <- flat
Auth avg:     2,882ms  3,037ms  6,104ms <- roughly doubles from 50→100
```

**Root cause:** password hashing (PBKDF2, used by both registration and
login) is CPU-bound work. Django's dev server processes requests in
threads within one Python process, and CPU-bound work in Python
contends for the GIL — concurrent hashing operations queue up behind
each other. Notes CRUD, by contrast, is I/O-bound (waiting on the
network round-trip to Neon), and Python releases the GIL while a thread
waits on I/O — so many notes requests can be genuinely in flight at
once, which is exactly why their latency stayed flat while concurrency
went from 10 to 100.

**The honest caveat, not glossed over:** this was measured against
`manage.py runserver`, which the Django docs themselves say is not for
production use. A real deployment runs multiple worker *processes*
(Gunicorn, uWSGI) — each with its own GIL — which would very plausibly
spread this hashing load across CPU cores instead of serializing it in
one process. Whether that actually fixes it is a claim for Phase 3 to
verify by re-running these same scripts against a containerized,
multi-worker deployment — not assumed true here.

## What we did NOT test, and why

See `DEFERRED_TESTS.md` — scaling past 100 users now would mostly
re-measure the dev server's known limits rather than the app's real
capacity.
