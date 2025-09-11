// API client for jelli-oauth-backend (proxied via /api/oauth to avoid CORS and localhost 404s)

function oauthBase() {
  if (typeof window !== 'undefined') return '/api';
  // Fallback to env on server if needed
  return process.env.OAUTH_API_BASE || '';
}

export async function getHealth(_baseUrl, opts = {}) {
  const res = await fetch(`${oauthBase()}/health`, { ...opts });
  return res;
}

export async function oauthStart({ baseUrl, apiKey, returnUrl, codeChallenge, method = 'S256', appInfo = { id: 'web-next', environment: 'development' } }) {
  // Use the correct OAuth start endpoint
  const url = `${oauthBase()}/oauth/start`;
  const headers = { 'Content-Type': 'application/json', ...(apiKey ? { 'X-Jelli-Api-Key': apiKey } : {}) };
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ codeChallenge, method, appInfo, returnUrl }) });
  if (!res.ok) throw new Error(`oauth/start ${res.status}`);
  return res.json();
}

export async function oauthComplete({ baseUrl, sessionId, codeVerifier }) {
  const url = `${oauthBase()}/oauth/complete`;
  const headers = { 'Content-Type': 'application/json' };
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ sessionId, codeVerifier }) });
  const text = await res.text();
  try {
    return { ok: res.ok, data: JSON.parse(text) };
  } catch {
    return { ok: res.ok, data: text };
  }
}

export async function oauthCancel({ baseUrl, sessionId }) {
  const url = `${oauthBase()}/oauth/cancel`;
  const headers = { 'Content-Type': 'application/json' };
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ sessionId }) });
  if (!res.ok) throw new Error(`oauth/cancel ${res.status}`);
  return true;
}
