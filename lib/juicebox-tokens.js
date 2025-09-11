// Per-realm JWT vending via the Juicebox backend
// IMPORTANT: Do not expose tenant signing secrets in the browser.
// This helper calls your backend to mint a JWT per realm and caches them.

import { JUICEBOX_CONFIG } from './juicebox-config.js';

const tokenCache = new Map(); // key: realmId (hex) -> token (string)

/**
 * Fetch a JWT for a single realm from your backend.
 * Mirrors the mobile SDK's onboardingServices.getJuiceboxAuthentication.
 */
async function fetchRealmToken(backendUrl, realmId, { email, source = 'google_auth', appName = 'Jelli Wallet' }) {
  const res = await fetch(`${backendUrl.replace(/\/$/, '')}/create-jwt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ realmId, email, source, appName }),
    mode: 'cors',
  });
  if (res.status !== 200) {
    const text = await res.text().catch(() => '');
    throw new Error(`JWT creation failed for realm ${realmId}: ${res.status} ${text}`);
  }
  return res.text();
}

/**
 * Install a global auth token provider compatible with juicebox-sdk (web/WASM).
 * The SDK calls: window.JuiceboxGetAuthToken(realmIdUint8) => Promise<string> (JWT)
 */
export function installJuiceboxAuthProvider({ backendUrl = JUICEBOX_CONFIG.backendUrl, email }) {
  if (!email) throw new Error('installJuiceboxAuthProvider requires an email');
  if (typeof window === 'undefined') return;

  // Provide tokens on-demand and cache by realm id hex
  window.JuiceboxGetAuthToken = async (realmIdUint8) => {
    try {
      const u8 = realmIdUint8 instanceof Uint8Array ? realmIdUint8 : new Uint8Array(realmIdUint8 || []);
      const hex = Array.from(u8).map((b) => b.toString(16).padStart(2, '0')).join('');
      if (tokenCache.has(hex)) return tokenCache.get(hex);
      const token = await fetchRealmToken(backendUrl, hex, { email });
      tokenCache.set(hex, token);
      return token;
    } catch (e) {
      console.error('JuiceboxGetAuthToken error', e);
      throw e;
    }
  };
}

/**
 * Pre-warm and return a full authentication map for all realms.
 * This is optional; the web SDK only needs the global callback.
 */
export async function getAuthenticationMap({ backendUrl = JUICEBOX_CONFIG.backendUrl, email, realms = JUICEBOX_CONFIG.realms }) {
  const out = {};
  for (const r of realms) {
    const token = tokenCache.get(r.id) || (await fetchRealmToken(backendUrl, r.id, { email }));
    tokenCache.set(r.id, token);
    out[r.id] = token;
  }
  return out;
}
