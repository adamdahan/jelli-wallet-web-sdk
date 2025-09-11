// PKCE utilities (browser)

export function base64UrlEncode(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
  return b64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function randomBytes(len) {
  const out = new Uint8Array(len);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(out);
  } else {
    // Fallback for non-browser contexts
    for (let i = 0; i < len; i++) out[i] = Math.floor(Math.random() * 256);
  }
  return out;
}

export function generateVerifier() {
  // 32 random bytes -> base64url string
  return base64UrlEncode(randomBytes(32));
}

export async function challengeS256(verifier) {
  const data = new TextEncoder().encode(verifier);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(new Uint8Array(digest));
  }
  // Node.js fallback (dev)
  const { createHash } = await import('crypto');
  const hash = createHash('sha256').update(Buffer.from(data)).digest();
  return base64UrlEncode(new Uint8Array(hash));
}

