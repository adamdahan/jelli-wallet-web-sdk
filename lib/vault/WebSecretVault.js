// Lightweight web "secret vault" backed by localStorage for encrypted blobs only.
// Never store plaintext. For daily unlock, we store password-encrypted seed JSON.

const SEED_KEY = (walletId) => `encrypted_seed_${walletId}`;
const MNEM_KEY = (walletId) => `encrypted_mnemonic_${walletId}`;
const ACTIVE_WALLET_KEY = 'jelli_active_wallet_id';

function safeGet(key) {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function safeSet(key, value) {
  if (typeof window === 'undefined') return false;
  try { window.localStorage.setItem(key, value); return true; } catch { return false; }
}

function safeRemove(key) {
  if (typeof window === 'undefined') return false;
  try { window.localStorage.removeItem(key); return true; } catch { return false; }
}

export const WebSecretVault = {
  // Encrypted seed JSON (stringified object via serializePasswordEncryptedData)
  storeEncryptedSeed(walletId, jsonString) {
    return safeSet(SEED_KEY(walletId), jsonString);
  },
  getEncryptedSeed(walletId) {
    const raw = safeGet(SEED_KEY(walletId));
    return raw || null;
  },
  deleteEncryptedSeed(walletId) {
    return safeRemove(SEED_KEY(walletId));
  },

  // Optional encrypted mnemonic JSON
  storeEncryptedMnemonic(walletId, jsonString) {
    return safeSet(MNEM_KEY(walletId), jsonString);
  },
  getEncryptedMnemonic(walletId) {
    return safeGet(MNEM_KEY(walletId));
  },
  deleteEncryptedMnemonic(walletId) {
    return safeRemove(MNEM_KEY(walletId));
  },

  setActiveWalletId(walletId) {
    return safeSet(ACTIVE_WALLET_KEY, walletId);
  },
  getActiveWalletId() {
    return safeGet(ACTIVE_WALLET_KEY);
  },
  clearActiveWalletId() {
    return safeRemove(ACTIVE_WALLET_KEY);
  },
};

export default WebSecretVault;

