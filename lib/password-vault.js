import { encryptSeedWithPassword, decryptSeedWithPassword, serializePasswordEncryptedData, deserializePasswordEncryptedData } from '@iheartsolana/jelli-core/dist/utils/passwordCrypto';
import { WebSecretVault } from './vault/WebSecretVault';

export function storePasswordEncryptedSeed(walletId, seedBytes, password) {
  const encrypted = encryptSeedWithPassword(Buffer.from(seedBytes), password, walletId);
  const json = JSON.stringify(serializePasswordEncryptedData(encrypted));
  WebSecretVault.storeEncryptedSeed(walletId, json);
  WebSecretVault.setActiveWalletId(walletId);
}

export function loadAndDecryptSeed(walletId, password) {
  const raw = WebSecretVault.getEncryptedSeed(walletId);
  if (!raw) throw new Error('No encrypted seed found');
  const parsed = JSON.parse(raw);
  const encryptedData = deserializePasswordEncryptedData(parsed);
  const seed = decryptSeedWithPassword(encryptedData, password, walletId);
  return seed; // Buffer
}

export function nukeLocalWallet(walletId) {
  WebSecretVault.deleteEncryptedSeed(walletId);
  WebSecretVault.deleteEncryptedMnemonic(walletId);
  const active = WebSecretVault.getActiveWalletId();
  if (active === walletId) WebSecretVault.clearActiveWalletId();
}

