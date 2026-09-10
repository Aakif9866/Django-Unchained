# Security Testing Log

Filled in during Phase 2.2 (Burp Suite) and onward. Only local, self-owned
instances of this application are tested.

## 2026-09-11 — Scoped automated pass (see `phase-2-results/SECURITY/findings.md`)

A scripted HTTP-level security probe (`testing/security_probe.py`) ran
against the local app as a compressed Phase 2 exercise — full findings,
evidence, and severities live in `phase-2-results/SECURITY/findings.md`
and `phase-2-results/EXECUTIVE_SUMMARY.md`; not duplicated here.

**Open findings:** no rate limiting on login (HIGH), `DEBUG=True`
traceback/URL-structure disclosure (HIGH + LOW), no Content-Security-Policy
(MEDIUM).

**Confirmed correct:** CSRF enforcement on authenticated writes, CORS
policy, baseline security headers, session cookie `HttpOnly` flag,
exhaustive cross-user authorization (IDOR) coverage.

**Important limitation of this pass:** this was scripted request/response
testing, explicitly **not** a substitute for manually exploring the app
with Burp Suite — a GUI proxy tool can't be automated this way, and
that hands-on exploration (Proxy, Repeater, Intruder against this app)
is still the user's own task, not yet done. Use the template below for
that session when it happens.

---

## Template

```
### Vulnerability:
Discovered:
How it works / why it exists:
Proof of exploitation (against local app):
Fix:
Retest result:
```

<!-- Findings from your own manual Burp Suite session go below -->
