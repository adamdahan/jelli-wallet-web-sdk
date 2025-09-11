// Safe local/session storage helpers for Next.js client components

const CONFIG_KEY = 'jelli-oauth-config';
const SESSION_KEY = 'jelli-oauth-session';

export function loadConfig() {
  const defaults = {
    baseUrl: '',
    apiKey: 'dev',
    returnUrl: '', // filled in by UI on client
    appId: '',
    dataApiBase: '',
  };
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
}

export function saveConfig(cfg) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

export function loadSession() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSession(state) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(SESSION_KEY);
}
