// ?? (nullish coalescing), not || — an intentionally empty string means
// "same origin, call /api/... directly" (the Docker/nginx setup), which
// || would incorrectly treat as unset and override with the dev default.
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

// The CSRF token used to be read straight off the csrftoken cookie via
// document.cookie. That broke in production: frontend and backend are
// genuinely different domains on Railway (not same-origin like Docker,
// not same-site like localhost:5173/:8000 in dev), and a cookie set by
// one domain is invisible to JS running on another — the browser still
// *sends* the cookie on requests fine (that's why login itself worked),
// it just can't be *read* cross-domain. Fixed by having the backend hand
// the token over directly in the response body instead (CsrfView), kept
// here in memory. Login rotates the token server-side, so it's refreshed
// again right after a successful login — see AuthContext.jsx.
let csrfToken = null;

/** Turns a DRF validation-error body ({field: [msg, ...]} or {detail: "..."})
 * into one readable string for the UI. */
function messageFromErrorBody(data) {
  if (!data) return 'Request failed.';
  if (data.detail) return data.detail;
  const parts = Object.entries(data).map(([field, msgs]) => {
    const text = Array.isArray(msgs) ? msgs.join(' ') : String(msgs);
    return field === 'non_field_errors' ? text : `${field}: ${text}`;
  });
  return parts.join(' ') || 'Request failed.';
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  // Django's CSRF middleware protects every unsafe method, even ones that
  // don't require login (e.g. register) — see accounts/views.CsrfView.
  if (method !== 'GET') {
    headers['X-CSRFToken'] = csrfToken;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    credentials: 'include', // send/receive the session + csrftoken cookies cross-origin
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    // empty/non-JSON body — leave data as null
  }

  if (!res.ok) {
    throw new ApiError(messageFromErrorBody(data), res.status, data);
  }
  return data;
}

export const api = {
  getCsrfCookie: async () => {
    const data = await request('/api/auth/csrf/');
    csrfToken = data.csrfToken;
    return data;
  },
  getUserCount: () => request('/api/auth/user-count/'),
  register: (username, password) =>
    request('/api/auth/register/', { method: 'POST', body: { username, password } }),
  login: (username, password) =>
    request('/api/auth/login/', { method: 'POST', body: { username, password } }),
  logout: () => request('/api/auth/logout/', { method: 'POST' }),
  me: () => request('/api/auth/me/'),

  listNotes: () => request('/api/notes/'),
  createNote: (note) => request('/api/notes/', { method: 'POST', body: note }),
  updateNote: (id, note) => request(`/api/notes/${id}/`, { method: 'PATCH', body: note }),
  deleteNote: (id) => request(`/api/notes/${id}/`, { method: 'DELETE' }),

  getPhase2Dashboard: () => request('/api/dashboard/phase2/'),
};
