# Security Findings

Method: scripted HTTP-level probing (`testing/security_probe.py`) — the
equivalent of manual Burp Suite exploration for what's checkable by direct
request/response inspection, run against the live local app. This is
**not a substitute** for you personally exploring with Burp — a GUI proxy
tool can't be driven by a script, and reading raw traffic yourself is the
actual skill Phase 2 was designed to build. Consider this the automated
first pass; the hands-on Burp session is still yours to do.

Full evidence: `RAW_RESULTS/security_probe_results.json`.

**Updated 2026-09-14**: reproduced against the Docker/Compose stack
(`TARGET_URL=http://localhost:8080`). SEC-04a and SEC-04b (below) both
flipped from FAIL to PASS — `docker-compose.yml` sets `DEBUG=False`,
and this run confirms live that both the URL-structure leak and the
traceback-disclosure risk are actually absent once the app runs with
the config it's meant to ship with. Moved to "confirmed working" at the
bottom of this file; kept in the history here rather than deleted, same
policy as `docs/decisions.md` uses for superseded entries.

---

### Finding: No rate limiting on the login endpoint
**ID:** SEC-05 · **Severity:** HIGH · **Status:** OPEN · **Exploitable:** Yes

**Discovered:** 15 login attempts with wrong passwords, fired in quick
succession, all returned `401` — none returned `429 Too Many Requests`.

**Why it exists:** `LoginView` (`accounts/views.py`) has no throttling
configured. DRF ships throttle classes (`AnonRateThrottle`,
`ScopedRateThrottle`) but they're opt-in — nothing in `REST_FRAMEWORK`
settings enables them.

**Evidence:** `attempts: [401, 401, ...] × 15` in 12.25 seconds, no `429`
anywhere (`RAW_RESULTS/security_probe_results.json`, `SEC-05`).

**Impact:** Unlimited password-guessing against any known username. A
real attacker isn't limited to 15 attempts — nothing stops thousands per
minute.

**Fix:** Add a throttle class scoped to the login view (DRF's
`ScopedRateThrottle`, or a dedicated library like `django-axes` for
account lockout). Requires a code change.

**Retest required:** Yes, once implemented — rerun `security_probe.py`
and confirm a `429` appears after N attempts.

---

### Finding: `DEBUG=True` leaks full tracebacks on unhandled server errors
**ID:** SEC-04b · **Severity:** HIGH · **Status:** ✅ RESOLVED (2026-09-14, for the Docker build) · **Exploitable:** Yes if DEBUG=True ships

**Discovered:** Not re-triggered in this probe run (see below for why) —
this is backed by something we already saw happen for real, during Phase
1, before the Postgres migration: when the MongoDB connection failed
mid-request, the client received Django's full debug error page —
complete Python traceback, absolute file paths, and (depending on the
exception) settings values.

**Why it exists:** `backend/.env` has `DEBUG=True`, appropriate for local
development, catastrophic if ever deployed as-is.

**Evidence:** Historical — the actual MongoDB-era 500 page, described in
this project's own conversation history. Not re-manufactured here:
deliberately breaking currently-working code just to re-screenshot the
same already-proven behavior isn't worth introducing a real failure for.

**Impact:** Any unhandled exception in production would hand an attacker
your file structure, installed packages, and potentially secret values
that appear in a traceback's local variables.

**Fix:** `DEBUG=False` before any real deployment (Phase 3), with
`ALLOWED_HOSTS` set correctly and a custom 500 handler for a clean error
page.

**Retest result (2026-09-14):** `docker-compose.yml` sets `DEBUG=False`
for the containerized build. `security_probe.py` rerun live against it
(`TARGET_URL=http://localhost:8080`) confirms `SEC-04a`'s 404 check no
longer reveals the debug page at all — the live signal this finding
depends on. Local dev deliberately keeps `DEBUG=True` (developer
convenience, contained to a machine that never faces the internet) —
that's an accepted tradeoff now that the deployment path is proven to
run with it off.

---

### Finding: No Content-Security-Policy header
**ID:** SEC-03c · **Severity:** MEDIUM · **Status:** OPEN · **Exploitable:** No (defense-in-depth gap, not a standalone exploit)

**Discovered:** `Content-Security-Policy` absent from every response
checked; Django has no built-in CSP support.

**Impact:** If an XSS vector were ever found elsewhere (React's default
escaping is the main defense currently), a CSP would be the second layer
stopping injected scripts from executing or exfiltrating data. Its
absence doesn't create a vulnerability by itself, but removes a safety
net.

**Fix:** `django-csp`, configured with a policy scoped to this app's
actual script/style/connect origins. A code + config change.

---

### Finding: `DEBUG=True` technical 404 reveals attempted URL pattern
**ID:** SEC-04a · **Severity:** LOW · **Status:** ✅ RESOLVED (2026-09-14, for the Docker build)

**Discovered:** `GET /api/notes/not-a-number/` returned Django's styled
"Page not found" debug page, which lists the URL patterns Django tried
to match.

**Impact:** Minor reconnaissance aid to an attacker mapping the API's
shape. Same root cause and same fix as SEC-04b.

**Retest result (2026-09-14):** rerun against the Docker build
(`DEBUG=False`) — the same request now returns a plain 404 with no
Django styling and no URL pattern list. Confirmed live, not assumed.

---

### Documented, accepted: anonymous endpoints have no CSRF check ("login CSRF")
**ID:** SEC-01b · **Severity:** LOW · **Status:** ACCEPTED (by design, not a defect)

**Investigation note:** the first probe run of this script mistakenly
tested `/api/auth/register/` (an anonymous endpoint) for CSRF enforcement
and reported it as a HIGH-severity failure. That was wrong — re-checked
directly against an *authenticated* endpoint (`POST /api/notes/` while
logged in, no CSRF header) and confirmed it correctly returns `403 CSRF
Failed`. DRF's `SessionAuthentication.enforce_csrf()` only runs once a
session resolves to a real user by design — anonymous endpoints were
never covered by it, in this app or any DRF app. Recorded here as the
real, narrower, lower-severity thing it actually is: a theoretical "login
CSRF" (forcing a victim to register/log into an attacker-known account),
not a broken CSRF system. This is why automated output gets verified
before being reported — the first label was wrong, and would have stayed
wrong if not investigated instead of trusted.

---

## Confirmed working correctly (no action needed)

| ID | What was checked | Result |
|----|-------------------|--------|
| SEC-01 | Authenticated state-changing requests without CSRF token | Correctly rejected (403) |
| SEC-02 | CORS response to an untrusted `Origin` header | Never echoes it back |
| SEC-03a | Baseline headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cross-Origin-Opener-Policy`) | All present — Django 6.1 defaults, no config needed |
| SEC-03b | HSTS header | Correctly absent on plain HTTP dev (enabling it now would be actively wrong) |
| SEC-06 | Session cookie `HttpOnly` flag | Present, confirmed via raw `Set-Cookie` header |
| SEC-04a | Docker build (`DEBUG=False`) 404 page | No URL pattern list leaked — resolved 2026-09-14 |
| SEC-04b | Docker build (`DEBUG=False`) traceback risk | Confirmed absent via SEC-04a's live signal — resolved 2026-09-14 |

## Authorization (IDOR) — separately, exhaustively verified

Covered by the automated test suite (`TEST_MATRIX.md`, tests Z-01
through Z-05), not this script: a user can never read, update, delete,
or list another user's notes, and a real note ID that isn't yours
returns the exact same 404 as an ID that doesn't exist at all — an
attacker probing IDs gets no signal either way.
