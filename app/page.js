"use client";

import { useEffect, useState } from 'react';
import '../lib/crypto/init';
import { loadSession, saveSession, clearSession as clearSess, loadConfig } from '../lib/storage';
import { getUserIdentifier } from '../lib/auth-utils';
import { installJuiceboxAuthProvider } from '../lib/juicebox-tokens';
import { makeClient, recoverShare } from '../lib/juicebox';
import { recoverMnemonicFromBackup } from '../lib/seedless';
import { listBackups, getBackup } from '../lib/data-api';

export default function WalletDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    const s = loadSession();
    setDashboard(s?.dashboard || null);
    const discoveredEmail = s?.oauth?.profile?.email || s?.oauth?.data?.profile?.email || s?.oauth?.email || s?.dashboard?.email || '';
    setEmail(discoveredEmail);
  }, []);

  function nukeWallet() {
    const s = loadSession() || {};
    saveSession({ ...s, dashboard: null });
    setDashboard(null);
    setMsg('Wallet removed from this device. You can recover with your PIN.');
  }

  async function signOut() {
    clearSess();
    window.location.href = '/onboarding';
  }

  async function recover() {
    try {
      setBusy(true); setMsg('Recovering from Juicebox...');
      if (!email) throw new Error('Missing email (sign in again)');
      // Prefer backend backup if config is present; fallback to session cache
      let backup = null;
      const sFull = loadSession();
      try {
        const cfg = loadConfig();
        const appId = cfg.appId || process.env.NEXT_PUBLIC_APP_ID || '389qiFSo2VPmot3dj6vv';
        const uid = getUserIdentifier(sFull) || email;
        if (appId) {
          const items = await listBackups({ dataApiBase: cfg.dataApiBase }, { appId, uid });
          if (!items.length) throw new Error('No remote backups found for this user');
          const first = items[0];
          const got = await getBackup({ dataApiBase: cfg.dataApiBase }, { appId, uid, walletId: first.walletId || first.id || first });
          if (got.exists) {
            const d = got.data;
            backup = {
              encrypted: d.encryptedMnemonic,
              shareA: d.backendKeyShare,
              juiceboxKeyShareLength: d.juiceboxKeyShareLength,
            };
          }
        }
      } catch (e) {
        // ignore and fallback to session
      }
      if (!backup) backup = sFull?.backupCache;
      if (!backup) throw new Error('No backup found locally or remotely');
      installJuiceboxAuthProvider({ email });
      const { client } = await makeClient({ pin_hashing_mode: 'Standard2019' });
      const recoveredBytes = await recoverShare({ client, pin, info: 'jelli_key_share' });
      const encrypted = {
        ciphertext: new Uint8Array(backup.encrypted.ciphertext),
        nonce: new Uint8Array(backup.encrypted.nonce),
        authTag: new Uint8Array(backup.encrypted.authTag),
        algorithm: backup.encrypted.algorithm,
      };
      const shareA = new Uint8Array(backup.shareA);
      const mnemonic = await recoverMnemonicFromBackup({ encrypted, shareA, recoveredShareB: recoveredBytes, expectedShareLength: backup.juiceboxKeyShareLength, threshold: 2 });

      // Derive addresses quickly using WalletManager import (in-memory)
      const { WalletManager, HDWalletEngine, InMemoryWalletStore, InMemorySecretVault, ChainType } = await import('@iheartsolana/jelli-core');
      const engine = new HDWalletEngine();
      const store = new InMemoryWalletStore();
      const vault = new InMemorySecretVault();
      const manager = new WalletManager(engine, store, vault, [ChainType.Bitcoin, ChainType.Ethereum, ChainType.Solana, ChainType.Base]);
      const imported = await manager.importWallet('Recovered Jelli Wallet', mnemonic, 0);
      const wallet = imported.success ? imported.wallet : null;
      const accounts = wallet ? await manager.listAccounts(wallet.id) : [];

      const nextDash = {
        wallet: wallet ? { id: wallet.id, name: wallet.name } : null,
        accounts: accounts.map(a => ({ chainType: a.chainType, address: a.address, derivationPath: a.derivationPath })),
        email,
      };
      saveSession({ ...sFull, dashboard: nextDash });
      setDashboard(nextDash);
      setMsg('Recovered successfully.');
    } catch (e) {
      setMsg('Recovery failed: ' + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function unlockDaily() {
    try {
      setBusy(true); setMsg('Unlocking...');
      const { WebSecretVault } = await import('../lib/vault/WebSecretVault');
      const { loadAndDecryptSeed } = await import('../lib/password-vault');
      const wid = WebSecretVault.getActiveWalletId();
      if (!wid) throw new Error('No active wallet to unlock');
      const seed = loadAndDecryptSeed(wid, password); // Buffer
      // Derive addresses using WalletManager from seed via importWallet (through mnemonic) is different,
      // but to keep identical derivation, we can import via mnemonic cache in session. For simplicity, re-import via mnemonic is skipped here.
      // Instead, show that unlock succeeded.
      setMsg('Unlocked successfully.');
    } catch (e) {
      setMsg('Unlock failed: ' + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {!dashboard ? (
        <section style={{ maxWidth: 640, margin: '40px auto', textAlign: 'center' }}>
          <h2 style={{ marginBottom: 8 }}>No Wallet on Device</h2>
          <div style={{ opacity: 0.7, marginBottom: 16 }}>Recover your wallet with your PIN or unlock locally with password.</div>
          <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (used for token vending)" style={{ padding: 10, borderRadius: 6, border: '1px solid #8883' }} />
            <input value={pin} onChange={(e) => setPin(e.target.value)} placeholder="4-digit PIN" maxLength={4} inputMode="numeric" style={{ padding: 10, borderRadius: 6, border: '1px solid #8883' }} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Daily password" style={{ padding: 10, borderRadius: 6, border: '1px solid #8883' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={recover} disabled={busy} style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #1d4ed8', background: '#3b82f6', color: '#fff' }}>Recover Wallet</button>
            <button onClick={unlockDaily} disabled={busy} style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #8883', background: 'transparent' }}>Unlock (Password)</button>
            <button onClick={signOut} style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #8883', background: 'transparent' }}>Sign Out</button>
          </div>
          {msg && <div style={{ marginTop: 12 }}>{msg}</div>}
        </section>
      ) : (
        <section style={{ maxWidth: 720, margin: '40px auto' }}>
          <h2 style={{ marginBottom: 8 }}>{dashboard.wallet?.name || 'Wallet'}</h2>
          <div style={{ opacity: 0.7, marginBottom: 16 }}>{email}</div>
          <div style={{ border: '1px solid #8883', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #8883' }}>Chain</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #8883' }}>Address</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #8883' }}>Path</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.accounts?.map((a, i) => (
                  <tr key={i}>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{a.chainType}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', fontFamily: 'monospace' }}>{a.address}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', fontFamily: 'monospace' }}>{a.derivationPath}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={nukeWallet} style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #ef4444', background: '#ef4444', color: '#fff' }}>Nuke Wallet (Local)</button>
            <button onClick={signOut} style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #8883', background: 'transparent' }}>Sign Out</button>
          </div>
          {msg && <div style={{ marginTop: 12 }}>{msg}</div>}
        </section>
      )}
    </div>
  );
}
