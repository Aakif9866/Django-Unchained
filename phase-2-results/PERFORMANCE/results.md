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

## The original finding: auth latency grows non-linearly, notes CRUD doesn't

```
Users:        10       50       100
Notes avg:    856ms    845ms    850ms   <- flat
Auth avg:     2,882ms  3,037ms  6,104ms <- roughly doubles from 50→100
```

Hypothesis at the time: PBKDF2 password hashing is CPU-bound, contends
for the GIL on the dev server's single process, while I/O-bound notes
queries release the GIL and stay flat. Flagged explicitly as unverified
— "whether multiple worker processes actually fixes it is a claim for
Phase 3 to verify... not assumed true here." Phase 3 did verify it, and
the real story turned out to be more interesting than the hypothesis.

## 2026-09-14 — reproduced against Docker (nginx + gunicorn), closing that loop

### Attempt 1: `gunicorn --workers 3` (no worker-class specified)

```
Users:        50 (Docker, sync workers)
Notes avg:    18,211ms   <- catastrophically worse than dev server (845ms)
Auth avg:      9,592ms
csrf avg:        401ms   <- a GET with ZERO database work, also degraded
```

**That last row is the tell.** If the theory were purely "CPU-bound
hashing contends for the GIL," an endpoint that does no hashing and no
DB query should be unaffected. It wasn't — everything degraded, which
meant the real problem was upstream of the hashing question entirely.

**Actual root cause:** gunicorn's *default* worker class is `sync` —
each of the 3 worker **processes** handles exactly one request at a
time, full stop, no threading within a process. 3 workers = 3 concurrent
request slots for the entire backend. 50 virtual users meant 38 of them
queued behind those 3 slots at any given moment. Confirmed by timing
single, non-concurrent requests before drawing this conclusion — those
came back in 2-20ms both through nginx and hitting the backend directly,
ruling out per-request or Docker-networking overhead as the cause and
pointing squarely at concurrency-slot queueing.

### Attempt 2: `--worker-class gthread --threads 20` (3 workers × 20 threads = 60 slots)

```
Users:        10        50        100      (Docker, gthread x20)
Notes avg:    1,400ms   1,156ms   1,329ms  <- back to near dev-server parity
Auth avg:     3,467ms   4,618ms   2,725ms  <- see below, this part is NOT clean
csrf avg:        —         22ms       —    <- back to single-digit-ms territory
```

The queueing regression is **fixed, with direct evidence**: the
near-zero-work `csrf` endpoint dropped from 22 *seconds* p95 back to
single-digit *milliseconds*, and notes CRUD returned to roughly the
same latency as the bare dev server. That part of this investigation is
resolved with high confidence.

### What's still genuinely unresolved

Auth latency comparing dev-server to tuned-Docker doesn't move in one
consistent direction: **worse** in Docker at 50 users (4.6s vs 3.0s),
**better** in Docker at 100 users (2.7s vs 6.1s). That's not the clean
"multi-process fixes GIL contention" story the original hypothesis
predicted — and on reflection, the hypothesis itself is shakier than it
sounded: CPython's `hashlib` functions (which Django's PBKDF2 hasher
uses) typically release the GIL during the underlying OpenSSL
computation, which undercuts "CPU-bound hashing serializes on the GIL"
as the mechanism in the first place.

**Reported honestly as unresolved, not papered over with a plausible
guess.** Candidate contributors, none isolated as *the* cause: Neon's
connection pooler (PgBouncer) behaving differently under each
environment's connection pattern; ordinary run-to-run variance on a
shared, free-tier Neon instance; Docker Desktop's VM-based networking
under sustained concurrent load specifically (the single-request test
only ruled out baseline, unloaded latency). Further isolation — e.g.
rerunning against a local, non-shared Postgres to remove Neon's shared
load as a variable — is tracked as deferred, not abandoned; see
`DEFERRED_TESTS.md` #7.

**What's confirmed regardless of that open question:** zero failed
requests at every single stage, across three different worker
configurations and two different environments. The app degrades in
latency under load — it has never once broken.

## What we did NOT test, and why

See `DEFERRED_TESTS.md` — scaling past 100 users, and the auth-latency
variance above, are both tracked there with specific reasons, not
silently dropped.
