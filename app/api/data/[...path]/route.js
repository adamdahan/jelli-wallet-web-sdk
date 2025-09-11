// Server-side proxy to the Firebase Data API to avoid browser CORS issues.
// Forwards requests to the configured backend base and streams JSON back.

const DEFAULT_BASE = process.env.DATA_API_BASE || 'https://jelli-firebase-backend-api-dev-158816bcad75.herokuapp.com';
const AUTH_BEARER = process.env.DATA_API_BEARER || 'jwt-demo';

function targetUrl(req, params) {
  const path = Array.isArray(params?.path) ? params.path.join('/') : '';
  const search = new URL(req.url).search || '';
  return `${DEFAULT_BASE.replace(/\/$/, '')}/${path}${search}`;
}

async function forward(method, req, ctx) {
  const url = targetUrl(req, ctx.params);
  const init = { method, headers: { 'Accept': 'application/json' } };
  if (AUTH_BEARER) init.headers['Authorization'] = `Bearer ${AUTH_BEARER}`;
  // Copy content-type and body for methods with bodies
  if (method !== 'GET' && method !== 'HEAD') {
    const ct = req.headers.get('content-type');
    if (ct) init.headers['Content-Type'] = ct;
    init.body = await req.arrayBuffer();
  }
  try {
    const hdrs = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k, k.toLowerCase() === 'authorization' ? '[REDACTED]' : v]));
    console.log(`[DATA PROXY] → ${method} ${url}`, hdrs);
  } catch {}
  const res = await fetch(url, init);
  const text = await res.text();
  try {
    console.log(`[DATA PROXY] ← ${res.status} ${method} ${url} :: ${text.slice(0, 500)}`);
  } catch {}
  return new Response(text, { status: res.status, headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' } });
}

export async function GET(req, ctx) { return forward('GET', req, ctx); }
export async function PUT(req, ctx) { return forward('PUT', req, ctx); }
export async function POST(req, ctx) { return forward('POST', req, ctx); }
export async function PATCH(req, ctx) { return forward('PATCH', req, ctx); }
export async function DELETE(req, ctx) { return forward('DELETE', req, ctx); }
