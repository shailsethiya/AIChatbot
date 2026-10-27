const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
  const h = { 'Content-Type': 'application/json', ...headers };
  if (auth) {
    const t = getToken();
    if (t) h.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;
  if (!res.ok) {
    const msg = data?.message || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload, auth: false }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload, auth: false }),
  me: () => request('/auth/me'),
  listChats: () => request('/chat'),
  getChat: (id) => request(`/chat/${id}`),
  createChat: () => request('/chat', { method: 'POST' }),
  deleteChat: (id) => request(`/chat/${id}`, { method: 'DELETE' }),
  renameChat: (id, title) => request(`/chat/${id}`, { method: 'PATCH', body: { title } }),
};

// SSE streaming via fetch — parses "event:" + "data:" lines and dispatches to handlers.
async function readSSE(res, handlers) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let event = 'message';
      let data = '';
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      let parsed;
      try { parsed = JSON.parse(data); } catch { parsed = { raw: data }; }
      handlers[event]?.(parsed);
    }
  }
}

export async function streamMessage({ chatId, message, signal, onMeta, onDelta, onDone, onError }) {
  const path = chatId ? `/chat/${chatId}/stream` : '/chat/stream';
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message }),
    signal,
  });

  if (!res.ok || !res.body) {
    let msg = `Stream failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.message) msg = j.message;
    } catch (_) { /* ignore */ }
    onError?.(new Error(msg));
    return;
  }

  await readSSE(res, {
    meta: (d) => onMeta?.(d),
    delta: (d) => onDelta?.(d),
    done: (d) => onDone?.(d),
    error: (d) => onError?.(new Error(d.message || 'stream error')),
  });
}

export async function streamAgent({ message, signal, onStep, onToolCalls, onToolResult, onDone, onError }) {
  const token = getToken();
  const res = await fetch(`${BASE}/agent/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message }),
    signal,
  });

  if (!res.ok || !res.body) {
    let msg = `Agent failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.message) msg = j.message;
    } catch (_) { /* ignore */ }
    onError?.(new Error(msg));
    return;
  }

  await readSSE(res, {
    step: (d) => onStep?.(d),
    tool_calls: (d) => onToolCalls?.(d),
    tool_result: (d) => onToolResult?.(d),
    done: (d) => onDone?.(d),
    error: (d) => onError?.(new Error(d.message || 'agent error')),
  });
}
