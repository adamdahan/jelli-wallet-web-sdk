// Minimal Data API client mirroring mobile ApiClient shape

const DEFAULT_DATA_API_BASE = 'https://jelli-firebase-backend-api-dev-158816bcad75.herokuapp.com';

function baseUrl(config) {
  // In the browser, use the Next.js server proxy to avoid CORS
  if (typeof window !== 'undefined') return '/api/data';
  const chosen = config?.dataApiBase || DEFAULT_DATA_API_BASE;
  const b = String(chosen || '').replace(/\/$/, '');
  if (!b) throw new Error('Data API base URL not configured');
  return b;
}

function authHeaders(config) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  // Optional client-side bearer (when not using server proxy env)
  if (config?.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
  return headers;
}

function logReq(label, { method, url, headers, body }) {
  try {
    const safeHeaders = { ...(headers || {}) };
    if (safeHeaders.Authorization) safeHeaders.Authorization = '[REDACTED]';
    console.log(`[DATA] → ${label}`, { method, url, headers: safeHeaders, bodyPreview: typeof body === 'string' ? body.slice(0, 300) : undefined });
  } catch {}
}

async function logRes(label, res) {
  try {
    const text = await res.clone().text().catch(() => '');
    console.log(`[DATA] ← ${label}`, { status: res.status, bodyPreview: text.slice(0, 500) });
  } catch {}
}

export async function putBackup(config, { appId, uid, walletId, payload, idempotencyKey }) {
  if (!appId || !uid || !walletId) throw new Error('Missing appId/uid/walletId');
  const url = `${baseUrl(config)}/v1/apps/${encodeURIComponent(appId)}/backups/${encodeURIComponent(uid)}/wallets/${encodeURIComponent(walletId)}`;
  const headers = authHeaders(config);
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const reqInit = { method: 'PUT', headers, body: JSON.stringify(payload), mode: 'cors' };
  logReq('PUT backup', { method: 'PUT', url, headers, body: reqInit.body });
  const res = await fetch(url, reqInit);
  await logRes('PUT backup', res);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PUT backup failed (${res.status}): ${text}`);
  }
  return res.json().catch(() => ({}));
}

export async function listBackups(config, { appId, uid }) {
  if (!appId || !uid) throw new Error('Missing appId/uid');
  const url = `${baseUrl(config)}/v1/apps/${encodeURIComponent(appId)}/backups/${encodeURIComponent(uid)}/wallets`;
  const headers = authHeaders(config);
  logReq('LIST backups', { method: 'GET', url, headers });
  const res = await fetch(url, { method: 'GET', headers, mode: 'cors' });
  await logRes('LIST backups', res);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`List backups failed (${res.status}): ${text}`);
  }
  const data = await res.json().catch(() => ([]));
  return Array.isArray(data) ? data : (data?.items || []);
}

export async function getBackup(config, { appId, uid, walletId }) {
  if (!appId || !uid || !walletId) throw new Error('Missing appId/uid/walletId');
  const url = `${baseUrl(config)}/v1/apps/${encodeURIComponent(appId)}/backups/${encodeURIComponent(uid)}/wallets/${encodeURIComponent(walletId)}`;
  const headers = authHeaders(config);
  logReq('GET backup', { method: 'GET', url, headers });
  const res = await fetch(url, { method: 'GET', headers, mode: 'cors' });
  await logRes('GET backup', res);
  if (res.status === 404) return { exists: false, data: null };
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Get backup failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return { exists: true, data };
}

export const DEFAULTS = { DATA_API_BASE: DEFAULT_DATA_API_BASE };
