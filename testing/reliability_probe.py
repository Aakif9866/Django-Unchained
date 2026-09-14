"""
Phase 2 reliability / failure-scenario checks — bounded, cheap, real.
Normal behavior is already covered by the automated test suite and load
tests; this focuses on abnormal input and edge-case robustness.
"""
import json
import os
import threading
import uuid
from datetime import datetime, timezone

import requests

BASE_URL = os.environ.get('TARGET_URL', 'http://127.0.0.1:8000')
RESULTS = []


def record(test_id, name, status_, severity, evidence, notes):
    RESULTS.append({
        'test_id': test_id, 'category': 'RELIABILITY', 'name': name,
        'status': status_, 'severity': severity, 'evidence': evidence,
        'notes': notes, 'timestamp': datetime.now(timezone.utc).isoformat(),
    })
    print(f'[{status_:4}] {test_id} — {name}  ({severity})')


def get_session():
    s = requests.Session()
    s.get(f'{BASE_URL}/api/auth/csrf/')
    return s


def main():
    # --- REL-01: malformed JSON body ---
    r = requests.post(
        f'{BASE_URL}/api/auth/register/',
        data='{not valid json',
        headers={'Content-Type': 'application/json'},
    )
    handled_gracefully = r.status_code == 400
    record(
        'REL-01', 'Malformed JSON body is rejected cleanly (400), not a 500',
        'PASS' if handled_gracefully else 'FAIL',
        'N/A' if handled_gracefully else 'MEDIUM',
        {'status_code': r.status_code, 'body': r.text[:300]},
        'DRF\'s JSON parser correctly turns unparseable input into a 400, '
        'not an unhandled exception.',
    )

    # --- REL-02: oversized field value ---
    s = get_session()
    csrf = s.cookies.get('csrftoken')
    s.post(f'{BASE_URL}/api/auth/register/', json={
        'username': 'reliability_probe_user', 'password': 'a-strong-password-9',
    }, headers={'X-CSRFToken': csrf})
    csrf = s.cookies.get('csrftoken')
    s.post(f'{BASE_URL}/api/auth/login/', json={
        'username': 'reliability_probe_user', 'password': 'a-strong-password-9',
    }, headers={'X-CSRFToken': csrf})
    csrf = s.cookies.get('csrftoken')
    huge_title = 'A' * 10000  # far past the model's max_length=200
    r = s.post(f'{BASE_URL}/api/notes/', json={'title': huge_title, 'content': ''},
               headers={'X-CSRFToken': csrf})
    record(
        'REL-02', 'Oversized field (10,000 chars into a 200 max_length) is validated, not crashed',
        'PASS' if r.status_code == 400 else 'FAIL',
        'N/A' if r.status_code == 400 else 'MEDIUM',
        {'status_code': r.status_code, 'body': r.text[:300]},
        'ModelSerializer enforces the model\'s max_length before it ever '
        'reaches the database — confirms validation happens at the API '
        'layer, not just as a DB constraint error leaking through.',
    )

    # --- REL-03: concurrent duplicate-username registration (race condition) ---
    # Username must be fresh every run — this hits a persistent shared
    # Neon database, not a throwaway per-run one. A hardcoded username
    # was already taken by the first run's winner on every rerun since,
    # making all 5 attempts correctly return 400 without ever exercising
    # the actual race (caught by checking the raw evidence, not just the
    # PASS/FAIL label — see docs/security.md's SEC-01 note for the same
    # lesson elsewhere in this project).
    race_username = f'race_condition_target_{uuid.uuid4().hex[:8]}'
    results = []

    def try_register():
        sess = get_session()
        csrf_ = sess.cookies.get('csrftoken')
        resp = sess.post(f'{BASE_URL}/api/auth/register/', json={
            'username': race_username, 'password': 'a-strong-password-9',
        }, headers={'X-CSRFToken': csrf_})
        results.append(resp.status_code)

    threads = [threading.Thread(target=try_register) for _ in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    success_count = results.count(201)
    record(
        'REL-03', 'Concurrent identical-username registrations: exactly one wins',
        'PASS' if success_count == 1 else 'FAIL',
        'N/A' if success_count == 1 else 'HIGH',
        {'status_codes': results, 'successful_registrations': success_count},
        f'5 simultaneous registration requests for the same username -> '
        f'{success_count} succeeded (201), rest should be 400 (duplicate). '
        'A count other than exactly 1 would mean a real race condition — '
        'either two accounts sharing a username (data integrity break) or '
        'the unique constraint rejecting the legitimate first request too.',
    )

    out_path = '../phase-2-results/RAW_RESULTS/reliability_probe_results.json'
    with open(out_path, 'w') as f:
        json.dump(RESULTS, f, indent=2, default=str)
    print(f'\nWrote {len(RESULTS)} results to {out_path}')


if __name__ == '__main__':
    main()
