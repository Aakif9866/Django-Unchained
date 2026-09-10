// Phase 2 load test, k6 version — same user flow as locustfile.py, for a
// direct tool comparison rather than duplicate learning. See
// docs/performance.md for what differed between the two tools.
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 50 },
    { duration: '20s', target: 50 },
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'], // fail the run if >1% of requests error
  },
};

const BASE_URL = 'http://127.0.0.1:8000';

function getCsrf(jar) {
  const res = http.get(`${BASE_URL}/api/auth/csrf/`, { jar });
  const cookies = jar.cookiesForURL(BASE_URL);
  return cookies.csrftoken ? cookies.csrftoken[0] : null;
}

export default function () {
  const jar = http.cookieJar();
  const username = `k6_${__VU}_${__ITER}_${Date.now()}`;
  const password = 'a-strong-password-9';

  let csrf = getCsrf(jar);
  http.post(`${BASE_URL}/api/auth/register/`, JSON.stringify({ username, password }), {
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
    jar,
  });

  csrf = jar.cookiesForURL(BASE_URL).csrftoken[0];
  const loginRes = http.post(`${BASE_URL}/api/auth/login/`, JSON.stringify({ username, password }), {
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
    jar,
  });
  check(loginRes, { 'login succeeded': (r) => r.status === 200 });

  const listRes = http.get(`${BASE_URL}/api/notes/`, { jar });
  check(listRes, { 'list succeeded': (r) => r.status === 200 });

  csrf = jar.cookiesForURL(BASE_URL).csrftoken[0];
  const createRes = http.post(
    `${BASE_URL}/api/notes/`,
    JSON.stringify({ title: 'k6 note', content: 'load test' }),
    { headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf }, jar },
  );
  check(createRes, { 'create succeeded': (r) => r.status === 201 });

  sleep(Math.random() * 2 + 1); // 1-3s think time, matching the Locust wait_time
}
