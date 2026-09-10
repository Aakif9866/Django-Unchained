# Reliability & Failure-Scenario Results

Method: `testing/reliability_probe.py`, plus the failure/recovery signal
already embedded in the load tests. Normal-behavior coverage is the
automated test suite (`API/results.md`); this is specifically abnormal
input and edge cases.

| ID | Scenario | Result |
|----|----------|--------|
| REL-01 | Malformed JSON body (`{not valid json`) sent to `/api/auth/register/` | **PASS** — clean `400`, not a `500`. DRF's parser handles this correctly. |
| REL-02 | 10,000-character title against a 200-char `max_length` field | **PASS** — rejected with `400` by the serializer, before it ever reaches Postgres. |
| REL-03 | 5 simultaneous registration requests, identical username | **PASS** — exactly 1 succeeded (`201`), the rest correctly rejected as duplicates. A real concurrency race, resolved correctly by Postgres's `UNIQUE` constraint. |

## Failure → recovery, observed via the load tests

The load-testing stages (`PERFORMANCE/results.md`) are also a
reliability signal: **zero failed requests at 10, 50, or 100 concurrent
users.** The app slowed down under load (specifically on auth
endpoints) — it did not error, time out, or return corrupted data at any
stage tested. That's a genuinely good sign: the failure mode here is
"gets slower," not "falls over," at least up to 100 concurrent users on
a single dev-server process.

## What "recovery behavior" would mean here, and why it's not tested

The original Phase 2 plan asks about recovery from failure (e.g., "what
happens if the database briefly disconnects mid-request"). That's
meaningfully testable in a controlled way, but doing it *safely*
requires either:
- A local database we can deliberately stop/restart (not applicable —
  Neon is a managed cloud service; we can't simulate an outage of
  someone else's infrastructure on demand), or
- Fault injection at the network layer (e.g., temporarily blocking the
  outbound connection to Neon's host) — possible, but a genuinely
  invasive action against a shared resource, not attempted without it
  being an explicit, deliberate request.

Recorded as a gap, not silently skipped: a proper "what happens when the
database goes away" test is better suited to Phase 3, once the app runs
in Docker Compose alongside a *local* Postgres container that can safely
be stopped and started on command.
