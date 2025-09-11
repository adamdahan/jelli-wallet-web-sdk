// OAuth complete endpoint
const DEFAULT_BASE = process.env.OAUTH_API_BASE || '';
const API_KEY = process.env.OAUTH_API_KEY || '';

async function forwardToBackend(method, req) {
  if (!/^https?:\/\//i.test(DEFAULT_BASE)) {
    console.error('[OAUTH PROXY] ERROR: OAUTH_API_BASE environment variable is not configured or invalid:', DEFAULT_BASE);
    return new Response(JSON.stringify({ 
      error: 'OAUTH_API_BASE is not configured on the server',
      details: 'Please set the OAUTH_API_BASE environment variable to a valid URL',
      configured_value: DEFAULT_BASE || 'undefined'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const url = `${String(DEFAULT_BASE).replace(/\/$/, '')}/oauth/complete`;
  const init = { method, headers: { 'Accept': 'application/json' } };
  if (API_KEY) init.headers['X-Jelli-Api-Key'] = API_KEY;
  
  if (method !== 'GET' && method !== 'HEAD') {
    const ct = req.headers.get('content-type');
    if (ct) init.headers['Content-Type'] = ct;
    init.body = await req.arrayBuffer();
  }
  
  try {
    console.log(`[OAUTH PROXY] → ${method} ${url}`, { headers: Object.keys(init.headers || {}) });
  } catch {}
  
  const res = await fetch(url, init);
  const text = await res.text();
  
  try { 
    console.log(`[OAUTH PROXY] ← ${res.status} ${method} ${url} :: ${text.slice(0, 400)}`); 
  } catch {}
  
  return new Response(text, { 
    status: res.status, 
    headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' } 
  });
}

export async function POST(req) { return forwardToBackend('POST', req); }
