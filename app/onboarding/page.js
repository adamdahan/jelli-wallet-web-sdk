"use client";

import { useEffect, useMemo, useState } from 'react';
import '../../lib/crypto/init';
import { challengeS256, generateVerifier } from '../../lib/pkce';
import { oauthStart } from '../../lib/api';
import { loadConfig, loadSession, saveSession } from '../../lib/storage';
import { getUserIdentifier, extractEmail } from '../../lib/auth-utils';
import { installJuiceboxAuthProvider } from '../../lib/juicebox-tokens';
import { makeClient, registerShare } from '../../lib/juicebox';
import { prepareBackupFromMnemonic, recoverMnemonicFromBackup } from '../../lib/seedless';
import { putBackup, listBackups, getBackup } from '../../lib/data-api';
import { WalletManager, HDWalletEngine, InMemoryWalletStore, InMemorySecretVault, ChainType } from '@iheartsolana/jelli-core';
import { storePasswordEncryptedSeed } from '../../lib/password-vault';

function Screen({ children }) {
  return <section style={{ maxWidth: 520, margin: '40px auto' }}>{children}</section>;
}

function Title({ children }) {
  return <h2 style={{ fontSize: 22, margin: '0 0 10px' }}>{children}</h2>;
}

function Sub({ children }) {
  return <div style={{ opacity: 0.75, marginBottom: 16 }}>{children}</div>;
}

function Button({ onClick, children, variant = 'primary', disabled }) {
  const style = variant === 'primary'
    ? { padding: '12px 16px', borderRadius: 8, border: '1px solid #1d4ed8', background: '#3b82f6', color: '#fff', width: '100%' }
    : { padding: '12px 16px', borderRadius: 8, border: '1px solid #8884', background: 'transparent', width: '100%' };
  return <button onClick={onClick} disabled={disabled} style={style}>{children}</button>;
}

function PinInput({ value, onChange, label = 'Enter 4‑digit PIN' }) {
  return (
    <div style={{ margin: '12px 0' }}>
      <label style={{ display: 'block', fontSize: 12, opacity: 0.7, marginBottom: 6 }}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={4} inputMode="numeric" pattern="[0-9]*"
        style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #8884' }} />
    </div>
  );
}

export default function Onboarding() {
  const [cfg, setCfg] = useState({ baseUrl: '', apiKey: '', returnUrl: '' });
  const [session, setSession] = useState({});
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('SIGN_IN'); // SIGN_IN | CHOOSE | PIN | CREATING | COMPLETE
  const [mode, setMode] = useState('CREATE'); // CREATE | RECOVER (recover UI can be added next)
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const c = loadConfig();
    const s = loadSession();
    const defaultReturn = `${window.location.origin}/oauth/callback`;
    setCfg({ baseUrl: c.baseUrl || 'http://localhost:3000', apiKey: c.apiKey || 'dev', returnUrl: c.returnUrl || defaultReturn });
    setSession(s);
    const discoveredEmail = extractEmail(s) || '';
    const discoveredUid = getUserIdentifier(s) || discoveredEmail;
    if (discoveredEmail) {
      setEmail(discoveredEmail);
      // Attempt automatic backup discovery via Data API
      (async () => {
        try {
          const appId = c.appId || process.env.NEXT_PUBLIC_APP_ID || '389qiFSo2VPmot3dj6vv';
          if (appId) {
            const items = await listBackups({ dataApiBase: c.dataApiBase }, { appId, uid: discoveredUid });
            if (items && items.length > 0) {
              setMode('RECOVER');
              setStep('PIN');
              setMsg('We found a backup for your account. Enter your PIN to recover.');
              return;
            }
          }
          setStep('CHOOSE');
        } catch (_) {
          setStep('CHOOSE');
        }
      })();
    }
  }, []);

  async function signIn() {
    try {
      setBusy(true);
      const codeVerifier = generateVerifier();
      const codeChallenge = await challengeS256(codeVerifier);
      const json = await oauthStart({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, returnUrl: cfg.returnUrl, codeChallenge, method: 'S256' });
      const state = { sessionId: json.sessionId, authUrl: json.authUrl, codeVerifier, codeChallenge };
      setSession(state); saveSession(state);
      window.location.href = json.authUrl;
    } catch (e) {
      setMsg(String(e?.message || e));
    } finally { setBusy(false); }
  }

  function proceedCreate() {
    setMode('CREATE');
    setStep('PIN');
  }

  function proceedRecover() {
    setMode('RECOVER');
    setStep('PIN');
  }

  async function createAndBackup() {
    if (pin.length !== 4 || pin2.length !== 4 || pin !== pin2) { setMsg('PINs must match and be 4 digits.'); return; }
    if (password.length < 6 || password !== password2) { setMsg('Passwords must match and be at least 6 characters.'); return; }
    setBusy(true); setMsg('Creating wallet and backing up...');
    try {
      // 1) Generate mnemonic (128-bit) and prepare backup (pad -> encryptAndSplitSeed)
      const { generateMnemonic, mnemonicToSeed } = await import('@scure/bip39');
      const { wordlist } = await import('@scure/bip39/wordlists/english');
      const mnemonic = generateMnemonic(wordlist, 128);
      const { encrypted, shareA, shareB } = await prepareBackupFromMnemonic(mnemonic, { threshold: 2, totalShares: 2 });

      // 2) Install Juicebox auth provider and register shareB with PIN
      if (!email) throw new Error('Missing email from OAuth');
      installJuiceboxAuthProvider({ email });
      const { client } = await makeClient({ pin_hashing_mode: 'Standard2019' });
      await registerShare({ client, pin, shareBytes: shareB, info: 'jelli_key_share', guesses: 5 });

      // 3) Derive accounts locally (index 0) and cache non-sensitive dashboard + backup in sessionStorage
      const engine = new HDWalletEngine();
      const store = new InMemoryWalletStore();
      const vault = new InMemorySecretVault();
      const manager = new WalletManager(engine, store, vault, [ChainType.Bitcoin, ChainType.Ethereum, ChainType.Solana, ChainType.Base]);
      const imported = await manager.importWallet('Jelli Wallet', mnemonic, 0);
      const wallet = imported.success ? imported.wallet : null;
      let accounts = [];
      if (wallet) {
        accounts = await manager.listAccounts(wallet.id);
      }

      // 3b) Password-encrypt the seed and store in web vault
      const { mnemonicToSeed: toSeed } = await import('@scure/bip39');
      const seedU8 = await toSeed(mnemonic, '');
      const seedBytes = Buffer.from(seedU8);
      if (wallet) {
        storePasswordEncryptedSeed(wallet.id, seedBytes, password);
      }

      // Persist minimal dashboard + backup to session
      const s = loadSession() || {};
      const backupCache = {
        encrypted: {
          ciphertext: Array.from(encrypted.ciphertext),
          nonce: Array.from(encrypted.nonce),
          authTag: Array.from(encrypted.authTag),
          algorithm: encrypted.algorithm,
        },
        shareA: Array.from(shareA),
        juiceboxKeyShareLength: meta.juiceboxKeyShareLength,
      };
      const dashboard = {
        wallet: wallet ? { id: wallet.id, name: wallet.name } : null,
        accounts: accounts.map(a => ({ chainType: a.chainType, address: a.address, derivationPath: a.derivationPath })),
        email,
      };
      saveSession({ ...s, backupCache, dashboard });

      // 4) Persist backup remotely (Data API) if appId is available
      try {
        const cfg = loadConfig();
        const appId = cfg.appId || process.env.NEXT_PUBLIC_APP_ID || '389qiFSo2VPmot3dj6vv';
        if (appId && wallet) {
          const payload = {
            encryptedMnemonic: {
              ciphertext: Array.from(encrypted.ciphertext),
              nonce: Array.from(encrypted.nonce),
              authTag: Array.from(encrypted.authTag),
              algorithm: encrypted.algorithm,
            },
            backendKeyShare: Array.from(shareA),
            juiceboxKeyShareLength: meta.juiceboxKeyShareLength,
            walletId: wallet.id,
            createdAt: new Date().toISOString(),
            threshold: meta.threshold,
            totalShares: meta.totalShares,
            architecture: 'phantom-mnemonic-based',
          };
          await putBackup({ dataApiBase: cfg.dataApiBase }, { appId, uid: email, walletId: wallet.id, payload, idempotencyKey: `backup:${email}:${wallet.id}` });
        }
      } catch (e) {
        console.warn('[Backup] Remote persist failed', e?.message || e);
      }

      setStep('COMPLETE');
      setMsg('Wallet created and backed up with PIN.');
    } catch (e) {
      setMsg('Failed: ' + (e?.message || String(e)));
    } finally { setBusy(false); }
  }

  async function recoverWithPin() {
    if (pin.length !== 4) { setMsg('Enter your 4-digit PIN.'); return; }
    if (password.length < 6 || password !== password2) { setMsg('Passwords must match and be at least 6 characters.'); return; }
    setBusy(true); setMsg('Recovering wallet...');
    try {
      const c = loadConfig();
      const s = loadSession() || {};
      const appId = c.appId || process.env.NEXT_PUBLIC_APP_ID || '389qiFSo2VPmot3dj6vv';
      if (!email) throw new Error('Missing email from OAuth');
      if (!appId) throw new Error('Missing appId for backup lookup');

      // Use the SDK's high-level juiceboxServices.recoverWallet approach
      console.log('🔓 Starting wallet recovery with SDK approach...');
      
      // Find the wallet ID from the backup
      const uid = getUserIdentifier(s) || email;
      
      // Create a user object like the SDK expects
      const user = {
        uid: uid,
        email: email
      };
      const items = await listBackups({ dataApiBase: c.dataApiBase }, { appId, uid });
      if (!items || items.length === 0) throw new Error('No backups found');
      const walletId = items[0].walletId || items[0].id || items[0];
      
      // Get backup data
      const got = await getBackup({ dataApiBase: c.dataApiBase }, { appId, uid, walletId });
      if (!got.exists) throw new Error('Backup not found');
      const b = got.data;

      const encrypted = {
        ciphertext: new Uint8Array(b.encryptedMnemonic.ciphertext),
        nonce: new Uint8Array(b.encryptedMnemonic.nonce),
        authTag: new Uint8Array(b.encryptedMnemonic.authTag),
        algorithm: b.encryptedMnemonic.algorithm,
      };
      const shareA = new Uint8Array(b.backendKeyShare);
      
      // Recover Juicebox share with PIN
      installJuiceboxAuthProvider({ email });
      const { makeClient, recoverShare } = await import('../../lib/juicebox');
      const { client } = await makeClient({ pin_hashing_mode: 'Standard2019' });
      const recoveredBytes = await recoverShare({ client, pin, info: 'jelli_key_share' });
      
      // Use clean jelli-core recovery approach
      const { recoverMnemonicFromBackup } = await import('../../lib/seedless');
      const mnemonic = await recoverMnemonicFromBackup({ 
        encrypted, 
        shareA, 
        recoveredShareB: recoveredBytes, 
        expectedShareLength: b.juiceboxKeyShareLength, 
        threshold: 2 
      });
      
      console.log('✅ Mnemonic recovered:', mnemonic.split(' ').length, 'words');
      
      // Import the wallet with the recovered mnemonic
      const engine = new HDWalletEngine();
      const store = new InMemoryWalletStore();
      const vault = new InMemorySecretVault();
      const manager = new WalletManager(engine, store, vault, [ChainType.Bitcoin, ChainType.Ethereum, ChainType.Solana, ChainType.Base]);
      const imported = await manager.importWallet('Recovered Jelli Wallet', mnemonic, 0);
      
      if (!imported.success) {
        throw new Error('Failed to import wallet: ' + imported.message);
      }
      
      const wallet = imported.wallet;
      const accounts = await manager.listAccounts(wallet.id);
      
      // Convert mnemonic to seed for password encryption
      const { mnemonicToSeed } = await import('@scure/bip39');
      const seedUint8Array = await mnemonicToSeed(mnemonic, '');
      const seedBytes = Buffer.from(seedUint8Array);
      
      // Store password-encrypted seed
      if (wallet) {
        storePasswordEncryptedSeed(wallet.id, seedBytes, password);
      }
      
      // Save dashboard
      const dashboard = {
        wallet: wallet ? { id: wallet.id, name: wallet.name } : null,
        accounts: accounts.map(a => ({ chainType: a.chainType, address: a.address, derivationPath: a.derivationPath })),
        email,
      };
      
      // Save backup cache
      const backupCache = {
        encrypted: b.encryptedMnemonic,
        shareA: b.backendKeyShare,
        juiceboxKeyShareLength: b.juiceboxKeyShareLength,
      };
      
      saveSession({ ...s, dashboard, backupCache });
      setStep('COMPLETE');
      setMsg('Wallet recovered successfully.');
      
      // Recovery completed successfully in the direct decryption block above
    } catch (e) {
      console.error('[RECOVER] Full error object:', e);
      const errorMsg = e?.message || e?.error || (typeof e === 'string' ? e : JSON.stringify(e, null, 2));
      setMsg('Recover failed: ' + errorMsg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      {step === 'SIGN_IN' && (
        <>
          <Title>Sign in to continue</Title>
          <Sub>Sign in with Google to create or recover your wallet.</Sub>
          <Button onClick={signIn} disabled={busy}>Sign In with Google</Button>
          {msg && <div style={{ marginTop: 12, color: '#dc2626' }}>{msg}</div>}
        </>
      )}

      {step === 'CHOOSE' && (
        <>
          <Title>Welcome</Title>
          <Sub>{email}</Sub>
          <div style={{ display: 'grid', gap: 10 }}>
            <Button onClick={proceedCreate}>Create New Wallet</Button>
            <Button onClick={proceedRecover} variant="secondary">I already have a wallet</Button>
          </div>
        </>
      )}

      {step === 'PIN' && mode === 'CREATE' && (
        <>
          <Title>Create a PIN</Title>
          <Sub>We’ll use your PIN to protect a backup share with Juicebox. Don’t share this PIN.</Sub>
          <PinInput value={pin} onChange={setPin} label="Enter 4-digit PIN" />
          <PinInput value={pin2} onChange={setPin2} label="Confirm PIN" />
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'block', fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Daily Password (min 6 chars)</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #8884', marginBottom: 8 }} />
            <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="Confirm password" style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #8884' }} />
          </div>
          <Button onClick={createAndBackup} disabled={busy || pin.length !== 4 || pin2.length !== 4 || !password || !password2}>Continue</Button>
          {msg && <div style={{ marginTop: 12, color: '#dc2626' }}>{msg}</div>}
        </>
      )}

      {step === 'PIN' && mode === 'RECOVER' && (
        <>
          <Title>Enter Your PIN</Title>
          <Sub>We found a backup for your account. Enter your PIN to recover, then set a daily password.</Sub>
          <PinInput value={pin} onChange={setPin} label="4-digit PIN" />
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'block', fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Daily Password (min 6 chars)</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter new password" style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #8884', marginBottom: 8 }} />
            <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="Confirm password" style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #8884' }} />
          </div>
          <Button onClick={recoverWithPin} disabled={busy || pin.length !== 4 || !password || !password2}>Recover Wallet</Button>
          {msg && <div style={{ marginTop: 12, color: '#dc2626' }}>{msg}</div>}
        </>
      )}

      {step === 'COMPLETE' && (
        <>
          <Title>All set</Title>
          <Sub>Your wallet backup is protected with your PIN. You’ll need it to recover.</Sub>
          <Button onClick={() => window.location.href = '/'}>Finish</Button>
          {msg && <div style={{ marginTop: 12 }}>{msg}</div>}
        </>
      )}
    </Screen>
  );
}
