# Performance Testing Log

## 2026-09-11 — Locust + k6, 10/50/100 concurrent users (see `phase-2-results/PERFORMANCE/results.md`)

Full test configuration, per-stage metrics (p50/p95, req/s, error rate),
and raw CSV/JSON evidence live in `phase-2-results/PERFORMANCE/results.md`
and `phase-2-results/RAW_RESULTS/`; not duplicated here.

**Headline result:** zero failed requests at every stage tested (10, 50,
100 concurrent users) — the app degrades gracefully rather than
crashing. **Bottleneck found and root-caused:** authentication endpoints
(register/login) scale non-linearly under concurrency (2.9s → 6.1s avg,
10→100 users) while notes CRUD stays flat (~850ms throughout) — caused by
CPU-bound PBKDF2 password hashing serializing under Python's GIL on
Django's single-process dev server. Notes queries are I/O-bound (waiting
on the network round-trip to Neon) and don't hit this limit.

**10,000 registered users ≠ 10,000 concurrent users, still true:**
everything above tested concurrent load, not total accounts — no claim
here about how many total users this app "supports."

## 2026-09-14 — answered (partially) against Docker/gunicorn

That "not yet answered" question got tested. Short version: the
question itself was slightly wrong. gunicorn's *default* worker class
caused a much bigger, unrelated regression first (found via a
near-zero-work endpoint degrading to 22s p95 — not explainable by any
CPU-bound-hashing theory), fixed with `--worker-class gthread --threads
20`. Once fixed, the original auth-vs-notes comparison came back noisy
rather than clean — worse than the dev server at 50 users, better at
100. Reported as genuinely unresolved rather than forced into a tidy
story. Full writeup, including the wrong turns: `phase-2-results/PERFORMANCE/results.md`.

---

## Template for future entries

```
### Test:
Tool (Locust / k6 / JMeter):
Virtual users / concurrency:
Duration:
Requests/sec:
Latency p50 / p95 / p99:
Error rate:
CPU / memory observed:
Bottleneck identified:
Change made:
Retest result:
```
