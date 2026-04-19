// ============================================================
// api.js — All API calls to the backend
// ============================================================

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

async function request(path, options = {}) {
  const { headers: optionHeaders, ...rest } = options;
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(optionHeaders || {})
      }
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const hint =
      raw === 'Load failed' || raw === 'Failed to fetch'
        ? `Cannot reach the API (${API_URL}). From the project root run npm run dev so both Vite (port 3000) and the backend (port 5000) are running. In dev, requests use the Vite proxy; if you set VITE_API_URL to a full URL, it must match where the API is listening.`
        : raw;
    throw new Error(hint);
  }

  const rawBody = await response.text();
  let data = {};
  if (rawBody) {
    try {
      data = JSON.parse(rawBody);
    } catch {
      if (!response.ok) {
        data = {
          message: rawBody.length > 280 ? `${rawBody.slice(0, 280)}…` : rawBody
        };
      } else {
        throw new Error('Server returned a non-JSON response');
      }
    }
  }

  if (!response.ok) {
    const fallback = `Request failed (${response.status} ${response.statusText || ''})`.trim();
    let msg =
      (typeof data.message === 'string' && data.message) ||
      (typeof data.error === 'string' && data.error) ||
      (typeof data === 'string' ? data : null) ||
      fallback;
    if (response.status === 403) {
      msg += ` Check that the backend is the service answering ${API_URL}. In local dev for this project, the frontend should proxy /api to http://127.0.0.1:5001.`;
    }
    throw new Error(msg);
  }
  return data;
}

function withAuth(token, options = {}) {
  return { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` } };
}

// ── Auth ─────────────────────────────────────────────────────
export function registerUser(payload)  { return request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }); }
export function loginUser(payload)     { return request('/auth/login',    { method: 'POST', body: JSON.stringify(payload) }); }
export function getCurrentUser(token)  { return request('/auth/me',       withAuth(token)); }

export function updateProfile(token, payload) {
  return request('/auth/profile', withAuth(token, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  }));
}

// ── Tasks ─────────────────────────────────────────────────────
export function getTasks(token)        { return request('/tasks',         withAuth(token)); }

/** Parse a natural-language command with Gemini (no save) */
export function previewTask(token, command) {
  return request('/tasks/preview', withAuth(token, {
    method: 'POST',
    body: JSON.stringify({ command })
  }));
}

/** Save task — pass optional parsedTask from preview to skip a second AI call */
export function parseTask(token, command, parsedTask) {
  return request('/tasks/parse', withAuth(token, {
    method: 'POST',
    body: JSON.stringify(parsedTask ? { command, parsedTask } : { command })
  }));
}

export function runTask(token, taskId) {
  return request(`/tasks/${encodeURIComponent(taskId)}/run`, withAuth(token, { method: 'POST' }));
}

export function patchTask(token, taskId, body) {
  return request(`/tasks/${encodeURIComponent(taskId)}`, withAuth(token, {
    method: 'PATCH',
    body: JSON.stringify(body)
  }));
}

export function deleteTask(token, taskId) {
  return request(`/tasks/${encodeURIComponent(taskId)}`, withAuth(token, { method: 'DELETE' }));
}

// ── Logs ──────────────────────────────────────────────────────
export function getLogs(token)         { return request('/logs',          withAuth(token)); }

// ── Gmail OAuth ───────────────────────────────────────────────
/** Returns { authUrl } — caller should do window.location.href = authUrl */
export function getGmailAuthUrl(token) { return request('/gmail/authurl', withAuth(token)); }

export function disconnectGmail(token) {
  return request('/gmail/disconnect', withAuth(token, { method: 'DELETE' }));
}
