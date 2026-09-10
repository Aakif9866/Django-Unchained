# Phase 2 Executive Summary

## Overall assessment

The application is **functionally solid and correctly authorized** —
every authentication and cross-user-isolation test passed, including
under concurrent load. It is **not deployment-ready from a security
config standpoint**: two HIGH findings (`DEBUG=True`, no login rate
limiting) are exactly the kind of thing that's fine in dev and dangerous
in production. Performance is good at the scale tested, with one real,
explained bottleneck (auth latency under concurrency) that needs
re-verification once the app is behind a real WSGI server, not the dev
one.

| Area | Status | Why |
|------|--------|-----|
| Security | **AT RISK** | 2 HIGH findings, both configuration-fixable, neither currently fixed |
| Performance | **OK, with a known bottleneck** | 0% failures through 100 concurrent users; auth latency degrades non-linearly, root-caused |
| Reliability | **OK** | All malformed-input, oversized-field, and race-condition tests passed |
| Scalability | **UNKNOWN beyond 100 users** | Not tested further — see reasoning in `DEFERRED_TESTS.md` |
| Database | **OK, with a minor test-infra issue** | Real FK/index behavior correct; test teardown against pooled connection needs a config fix |
| DevOps | **NOT TESTED** | Explicitly Phase 3 scope — nothing to test yet |

## Test statistics

| | |
|---|---|
| Total tests | 32 |
| Passed | 26 |
| Failed | 4 |
| Info (documented, not failures) | 2 |
| Blocked | 0 |
| Deferred | 6 |
| Critical | 0 |
| High | 2 |
| Medium | 1 |
| Low | 1 |

## Top findings

| ID | Category | Finding | Severity | Status |
|----|----------|---------|----------|--------|
| SEC-05 | Security | No rate limiting on login — unlimited brute-force attempts | HIGH | Open |
| SEC-04b | Security | `DEBUG=True` leaks full tracebacks on server errors | HIGH | Open |
| PERF-01 | Performance | Auth endpoints scale non-linearly under load (2.9s→6.1s, 10→100 users) | MEDIUM | Root-caused, needs re-test on production WSGI server |
| SEC-03c | Security | No Content-Security-Policy header | MEDIUM | Open |
| DB-02 | Database | Test DB teardown fails against Neon's pooled connection | LOW | Open |
| SEC-04a | Security | `DEBUG=True` 404 page reveals URL structure | LOW | Open (resolves with SEC-04b's fix) |

## What surprised us

- **The automated security probe's first run had two wrong conclusions**
  (a mislabeled CSRF test, a script bug hiding the real cookie-flag
  check) — both caught by re-investigating instead of trusting the
  PASS/FAIL label at face value. Documented in `SECURITY/findings.md`
  rather than quietly fixed and forgotten, because it's the actual
  lesson: automated tools report symptoms, understanding requires a
  human reading the evidence.
- **Zero failed requests at 100 concurrent users** on a single dev-server
  process — better resilience than expected, though "resilient" and
  "fast" turned out to be different questions (see the bottleneck).
- **Django auto-indexes ForeignKey columns** — the `owner_id` index we'd
  have had to hand-write against MongoDB came free with the Postgres
  migration.

## Most serious problems

1. `DEBUG=True` in a committed `.env.example`-adjacent config, if ever
   copied into a real deployment — HIGH, config-only fix.
2. No brute-force protection on login — HIGH, small code change
   (DRF throttling).

## Most important fixes (short-term)

- Add DRF rate throttling on `LoginView`.
- Add a `django-csp` policy.
- Point `manage.py test`/`migrate` at Neon's non-pooled connection
  string.

## What remains

- The user's own hands-on Burp Suite session (not replicated here by
  design).
- Re-measuring the auth-latency bottleneck against a real WSGI server
  once Phase 3 containerizes the app.
- `DEBUG=False` + everything else in `SEC-04a`/`SEC-04b`, before any
  real deployment.

## Recommended Phase 3 focus

Given what Phase 2 found, Phase 3's Docker/CI work should specifically
include: a production WSGI server config (to re-test the auth
bottleneck), `DEBUG=False` wired through environment-based config
(not hand-toggled), and the Neon connection-string split (pooled vs
direct) as part of the deployment config from day one rather than
retrofitted later.
