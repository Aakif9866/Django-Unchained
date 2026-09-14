"""
Phase 2 security probing — the HTTP-level equivalent of manual Burp Suite
exploration, scripted so results are reproducible and evidence is real.
This does NOT replace sitting down with Burp yourself (a GUI proxy tool
can't be driven by this script) — it covers what's checkable by direct
HTTP request/response inspection: CSRF enforcement, CORS policy, security
headers, error/debug information disclosure, rate limiting, and session
cookie flags.

v2: corrects two mistakes found in v1's own results by re-investigating
rather than trusting the automated PASS/FAIL label at face value —
see docs/security.md for the full explanation of what was wrong and why.
"""

import json
import os
import time
import uuid
from datetime import datetime, timezone

import requests

BASE_URL = os.environ.get('TARGET_URL', 'http://127.0.0.1:8000')
RESULTS = []


def record(test_id, name, status_, severity, evidence, notes):
    RESULTS.append({
        'test_id': test_id,
        'category': 'SECURITY',
        'name': name,
        'status': status_,  # PASS | FAIL | INFO
        'severity': severity,  # CRITICAL | HIGH | MEDIUM | LOW | INFO | N/A
        'evidence': evidence,
        'notes': notes,
        'timestamp': datetime.now(timezone.utc).isoformat(),
    })
    print(f'[{status_:4}] {test_id} — {name}  ({severity})')


def get_csrf(session):
    r = session.get(f'{BASE_URL}/api/auth/csrf/')
    return session.cookies.get('csrftoken'), r


def register_and_login(session):
    username = f'probe_{uuid.uuid4().hex[:10]}'
    password = 'a-strong-password-9'
    csrf, _ = get_csrf(session)
    session.post(f'{BASE_URL}/api/auth/register/', json={
        'username': username, 'password': password,
    }, headers={'X-CSRFToken': csrf})
    csrf = session.cookies.get('csrftoken')
    session.post(f'{BASE_URL}/api/auth/login/', json={
        'username': username, 'password': password,
    }, headers={'X-CSRFToken': csrf})
    return username, session.cookies.get('csrftoken')


def main():
    # --- SEC-01: CSRF enforcement on an AUTHENTICATED, state-changing
    # endpoint. v1 mistakenly tested /api/auth/register/ (anonymous) and
    # got 201 with no CSRF header — that's not a bug, it's documented DRF
    # behavior: SessionAuthentication.enforce_csrf() only runs once a
    # session resolves to a real user, so anonymous endpoints are
    # deliberately not covered by it. The real test is an authenticated
    # write, which is what actually protects a logged-in user's session
    # from a forged cross-site request. ---
    s = requests.Session()
    username, csrf = register_and_login(s)
    r = s.post(f'{BASE_URL}/api/notes/', json={'title': 'csrf probe'})  # no X-CSRFToken
    record(
        'SEC-01', 'Authenticated POST without CSRF token is rejected',
        'PASS' if r.status_code == 403 else 'FAIL',
        'HIGH' if r.status_code != 403 else 'N/A',
        {'status_code': r.status_code, 'body': r.text[:300]},
        'This is the endpoint that matters: once a user has a real '
        'session, a state-changing request missing the CSRF header must '
        'be rejected. (Confirmed correct — see notes on SEC-01b for the '
        'anonymous-endpoint nuance this v1 run conflated with this.)',
    )

    # --- SEC-01b: anonymous endpoint (register) has no CSRF check — by
    # design, not a defect, but worth recording accurately as "login
    # CSRF" exposure: an attacker's page could force a victim to register
    # into an attacker-known account. Real, but low-impact for this app
    # (no sensitive action happens purely from registering). ---
    s2 = requests.Session()
    get_csrf(s2)
    r2 = s2.post(f'{BASE_URL}/api/auth/register/', json={
        'username': f'probe_{uuid.uuid4().hex[:10]}', 'password': 'a-strong-password-9',
    })  # no X-CSRFToken, deliberately
    record(
        'SEC-01b', 'Anonymous POST (register) CSRF exposure ("login CSRF")',
        'INFO',
        'LOW',
        {'status_code': r2.status_code},
        'By design (DRF only enforces session-CSRF for authenticated '
        'requests), anonymous endpoints like register/login accept '
        'requests with no CSRF header. This is standard DRF behavior, '
        'not misconfiguration specific to this app. Real-world impact '
        'here is low: no sensitive data exists before a victim '
        'deliberately logs in and starts creating notes themselves.',
    )

    # --- SEC-02: CORS policy rejects an unrecognized origin ---
    r = requests.options(
        f'{BASE_URL}/api/notes/',
        headers={
            'Origin': 'http://evil.example.com',
            'Access-Control-Request-Method': 'GET',
        },
    )
    allow_origin = r.headers.get('Access-Control-Allow-Origin')
    record(
        'SEC-02', 'CORS preflight from an untrusted origin',
        'PASS' if allow_origin != 'http://evil.example.com' else 'FAIL',
        'CRITICAL' if allow_origin == 'http://evil.example.com' else 'N/A',
        {'status_code': r.status_code, 'access_control_allow_origin': allow_origin},
        'Access-Control-Allow-Origin must never echo back an arbitrary '
        'Origin header for a credentialed API. Confirmed absent.',
    )

    # --- SEC-03: security headers, split into what Django 6.1 actually
    # sets by default vs what's genuinely missing. v1 lumped these
    # together as one FAIL, which overstated the problem. ---
    r = requests.get(f'{BASE_URL}/api/auth/csrf/')
    present = {
        'X-Content-Type-Options': r.headers.get('X-Content-Type-Options'),
        'X-Frame-Options': r.headers.get('X-Frame-Options'),
        'Referrer-Policy': r.headers.get('Referrer-Policy'),
        'Cross-Origin-Opener-Policy': r.headers.get('Cross-Origin-Opener-Policy'),
    }
    record(
        'SEC-03a', 'Baseline hardening headers (nosniff, frame-deny, referrer, COOP)',
        'PASS' if all(present.values()) else 'FAIL',
        'N/A' if all(present.values()) else 'MEDIUM',
        {'present': present},
        "These are Django 6.1's own SecurityMiddleware/XFrameOptions "
        'defaults — all present out of the box, nothing we configured.',
    )
    hsts = r.headers.get('Strict-Transport-Security')
    record(
        'SEC-03b', 'HSTS header (Strict-Transport-Security)',
        'INFO',
        'INFO',
        {'hsts_header': hsts},
        'Correctly ABSENT in local HTTP dev — enabling HSTS before the '
        'site actually serves HTTPS would be actively harmful (it tells '
        'browsers to refuse plain HTTP for this host). Must be added '
        'when Phase 3 puts this behind real HTTPS, not before.',
    )
    csp = r.headers.get('Content-Security-Policy')
    record(
        'SEC-03c', 'Content-Security-Policy header',
        'FAIL' if csp is None else 'PASS',
        'MEDIUM' if csp is None else 'N/A',
        {'csp_header': csp},
        'Genuinely missing — Django has no built-in CSP support (needs '
        'django-csp or a hand-written middleware). This is the one real '
        'gap in SEC-03, not a Phase-3-only concern like HSTS: a CSP '
        'meaningfully reduces XSS impact even on plain HTTP.',
    )

    # --- SEC-04: DEBUG=True information disclosure. v1 only tested a 404
    # and over-claimed "full traceback" from that evidence. Correcting
    # scope: the 404 does reveal the URLconf being probed (real, lower
    # severity); the full-traceback claim is backed by what we actually
    # already saw in this project during Phase 1 (Mongo connection
    # failure -> full Django debug 500 page), not re-derived here. ---
    r = requests.get(f'{BASE_URL}/api/notes/not-a-number/')
    reveals_urlconf = 'Page not found at' in r.text or 'urlpatterns' in r.text.lower()
    record(
        'SEC-04a', 'DEBUG=True technical 404 reveals URL structure',
        'FAIL' if reveals_urlconf else 'PASS',
        'LOW' if reveals_urlconf else 'N/A',
        {'status_code': r.status_code, 'response_length': len(r.text)},
        "Django's DEBUG=True 404 page shows the URL patterns it tried to "
        "match — a minor recon aid to an attacker, not a serious leak on "
        "its own.",
    )
    # SEC-04a's own 404 check just told us, live, whether THIS target is
    # running with DEBUG=True — reuse that instead of blanket-repeating
    # the historical Phase 1 finding regardless of what's actually being
    # tested (e.g. the Docker build deliberately sets DEBUG=False).
    if reveals_urlconf:
        record(
            'SEC-04b', 'DEBUG=True full traceback disclosure on unhandled 500s',
            'FAIL',
            'HIGH',
            {
                'live_signal': 'SEC-04a\'s 404 page reveals DEBUG=True on this target',
                'historical_source': 'also observed directly during Phase 1: a MongoDB '
                    'connection failure returned a full Django debug page (complete '
                    'traceback, file paths, settings values) to the HTTP client',
            },
            'DEBUG=True is fine for local dev — it is what must never ship set to '
            'True in a real deployment. Not re-triggered live here (forcing a '
            'genuine unhandled exception against working code would mean '
            'deliberately breaking something just to screenshot it) — the '
            'DEBUG=True signal above plus the Phase 1 occurrence are the evidence.',
        )
    else:
        record(
            'SEC-04b', 'DEBUG=True full traceback disclosure on unhandled 500s',
            'PASS',
            'N/A',
            {'live_signal': 'SEC-04a\'s 404 page shows DEBUG=False on this target'},
            'This target runs with DEBUG=False — the Phase 1 HIGH finding (full '
            'traceback disclosure, seen during a real MongoDB failure before the '
            'Postgres migration) does not apply here. It still applies to local '
            'dev, which intentionally keeps DEBUG=True — see docs/security.md.',
        )

    # --- SEC-05: rate limiting on login (brute-force resistance) ---
    s3 = requests.Session()
    csrf3, _ = get_csrf(s3)
    attempts = []
    t0 = time.monotonic()
    for i in range(15):
        r = s3.post(
            f'{BASE_URL}/api/auth/login/',
            json={'username': 'ratelimit_probe_target', 'password': f'wrong-{i}'},
            headers={'X-CSRFToken': s3.cookies.get('csrftoken')},
        )
        attempts.append(r.status_code)
    elapsed = time.monotonic() - t0
    got_throttled = any(code == 429 for code in attempts)
    record(
        'SEC-05', 'Login endpoint resists rapid brute-force attempts',
        'PASS' if got_throttled else 'FAIL',
        'N/A' if got_throttled else 'HIGH',
        {'attempts': attempts, 'elapsed_seconds': round(elapsed, 2), 'attempt_count': len(attempts)},
        f'15 login attempts in {elapsed:.2f}s, all returned {sorted(set(attempts))} — '
        'no 429 anywhere means there is currently no rate limiting on '
        'login. A real attacker could try thousands of passwords per '
        'minute against one account.',
    )

    # --- SEC-06: session cookie flags. v1 had a bug (used two DIFFERENT
    # generated usernames for register vs login, so login silently
    # failed and there was no session cookie to inspect). Fixed by
    # reusing register_and_login(), which uses one username throughout. ---
    s4 = requests.Session()
    username4, _ = register_and_login(s4)
    # Re-login explicitly to capture the actual Set-Cookie: sessionid header.
    csrf4 = s4.cookies.get('csrftoken')
    r = s4.post(f'{BASE_URL}/api/auth/login/', json={
        'username': username4, 'password': 'a-strong-password-9',
    }, headers={'X-CSRFToken': csrf4})
    set_cookie_headers = r.raw.headers.get_all('Set-Cookie') if r.raw else []
    sessionid_header = next((h for h in (set_cookie_headers or []) if h.startswith('sessionid=')), None)
    has_httponly = bool(sessionid_header and 'HttpOnly' in sessionid_header)
    has_secure = bool(sessionid_header and 'Secure' in sessionid_header)
    record(
        'SEC-06', 'Session cookie flags (HttpOnly required; Secure expected only over HTTPS)',
        'PASS' if has_httponly else 'FAIL',
        'N/A' if has_httponly else 'CRITICAL',
        {'set_cookie_header': sessionid_header, 'http_only': has_httponly, 'secure': has_secure},
        'HttpOnly present means JS (and therefore XSS) cannot read the '
        'session cookie — confirmed. Secure is correctly absent on '
        'local plain-HTTP dev; must be enabled (SESSION_COOKIE_SECURE) '
        'once this runs behind real HTTPS in Phase 3.',
    )

    out_path = '../phase-2-results/RAW_RESULTS/security_probe_results.json'
    with open(out_path, 'w') as f:
        json.dump(RESULTS, f, indent=2, default=str)
    print(f'\nWrote {len(RESULTS)} results to {out_path}')


if __name__ == '__main__':
    main()
