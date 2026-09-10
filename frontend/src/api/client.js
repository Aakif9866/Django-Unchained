const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

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
    headers['X-CSRFToken'] = getCookie('csrftoken');
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
  getCsrfCookie: () => request('/api/auth/csrf/'),
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
