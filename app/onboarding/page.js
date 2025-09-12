"use client";

import { useEffect, useMemo, useState } from 'react';
import '../../lib/crypto/init';
import { challengeS256, generateVerifier } from '../../lib/pkce';
import { oauthStart } from '../../lib/api';
import { loadConfig, loadSession, saveSession } from '../../lib/storage';
import { getUserIdentifier, extractEmail, extractAvatar, extractDisplayName } from '../../lib/auth-utils';
import { installJuiceboxAuthProvider } from '../../lib/juicebox-tokens';
import { makeClient, registerShare } from '../../lib/juicebox';
import { prepareBackupFromMnemonic, recoverMnemonicFromBackup } from '../../lib/seedless';
import { putBackup, listBackups, getBackup } from '../../lib/data-api';
import { WalletManager, HDWalletEngine, InMemoryWalletStore, InMemorySecretVault, ChainType } from '@iheartsolana/jelli-core';
import { storePasswordEncryptedSeed } from '../../lib/password-vault';

// Design System Components
function Screen({ children, className = '' }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fef7f7 0%, #fdf2f8 50%, #fff1f2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '28rem',
        margin: '0 auto'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '1.5rem',
          boxShadow: '0 4px 12px rgba(255, 142, 200, 0.15)',
          border: '1px solid #fce7f3',
          padding: '2rem',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle background pattern with brand pink */}
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '8rem',
            height: '8rem',
            background: 'linear-gradient(225deg, rgba(255, 142, 200, 0.1) 0%, transparent 100%)',
            borderRadius: '50%',
            transform: 'translate(4rem, -4rem)',
            opacity: 0.8
          }}></div>
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '6rem',
            height: '6rem',
            background: 'linear-gradient(45deg, rgba(255, 142, 200, 0.08) 0%, transparent 100%)',
            borderRadius: '50%',
            transform: 'translate(-3rem, 3rem)',
            opacity: 0.8
          }}></div>
          <div style={{ position: 'relative', zIndex: 10 }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function Title({ children, className = '' }) {
  return <h1 style={{
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: '0.75rem',
    textAlign: 'center'
  }}>{children}</h1>;
}

function Subtitle({ children, className = '' }) {
  return <p style={{
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: '1.5rem',
    lineHeight: '1.625'
  }}>{children}</p>;
}

function Button({ onClick, children, variant = 'primary', disabled, className = '', size = 'default', loading = false }) {
  const baseStyle = {
    width: '100%',
    fontWeight: '600',
    borderRadius: '1rem',
    transition: 'all 0.2s',
    border: 'none',
    cursor: (disabled && !loading) ? 'not-allowed' : 'pointer',
    fontSize: size === 'large' ? '1.125rem' : '1rem',
    padding: size === 'large' ? '1rem 2rem' : '0.75rem 1.5rem'
  };
  
  let variantStyle = {};
  if (variant === 'primary') {
    if (disabled && !loading) {
      variantStyle = {
        background: '#e5e7eb',
        color: '#9ca3af'
      };
    } else {
      variantStyle = {
        background: '#FF8EC8',
        color: 'white',
        boxShadow: '0 2px 8px rgba(255, 142, 200, 0.3)',
        transform: 'translateY(0)'
      };
    }
  } else if (variant === 'secondary') {
    variantStyle = {
      background: '#f9fafb',
      color: '#374151',
      border: '2px solid #e5e7eb'
    };
  } else if (variant === 'outline') {
    variantStyle = {
      background: 'transparent',
      color: '#FF8EC8',
      border: '2px solid #FF8EC8'
    };
  }
  
  return (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      style={{...baseStyle, ...variantStyle}}
      onMouseEnter={(e) => {
        if (!disabled && variant === 'primary' && !loading) {
          e.target.style.transform = 'translateY(-1px)';
          e.target.style.boxShadow = '0 4px 12px rgba(255, 142, 200, 0.4)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && variant === 'primary' && !loading) {
          e.target.style.transform = 'translateY(0)';
          e.target.style.boxShadow = '0 2px 8px rgba(255, 142, 200, 0.3)';
        }
      }}
    >
      {children}
    </button>
  );
}

function WhiteSpinner({ size = 'default' }) {
  const spinnerSize = size === 'large' ? '1.5rem' : '1rem';
  
  return (
    <div style={{
      width: spinnerSize,
      height: spinnerSize,
      border: '2px solid rgba(255, 255, 255, 0.3)',
      borderTop: '2px solid white',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      margin: '0 auto'
    }}></div>
  );
}

function PinInput({ value, onChange, label = 'Enter 4-digit PIN' }) {
  const digits = value.split('');
  
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <label style={{
        display: 'block',
        fontSize: '0.875rem',
        fontWeight: '500',
        color: '#374151',
        marginBottom: '1rem',
        textAlign: 'center'
      }}>{label}</label>
      <div 
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '0.75rem',
          position: 'relative'
        }}
        onClick={() => {
          // Focus the hidden input when clicking on the PIN display
          const input = document.querySelector('input[type="tel"]');
          if (input) input.focus();
        }}
      >
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            style={{
              width: '3.5rem',
              height: '3.5rem',
              borderRadius: '1rem',
              border: `2px solid ${digits[index] ? '#FF8EC8' : '#e5e7eb'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: digits[index] ? '#fdf2f8' : '#f9fafb',
              transition: 'all 0.2s',
              cursor: 'pointer'
            }}
          >
            <span style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#1f2937'
            }}>
              {digits[index] ? '•' : ''}
            </span>
          </div>
        ))}
        {/* Invisible input overlay */}
        <input
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
          maxLength={4}
          inputMode="numeric"
          pattern="[0-9]*"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer',
            fontSize: '1rem'
          }}
          autoFocus
          placeholder="0000"
        />
      </div>
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder, className = '' }) {
  const [showPassword, setShowPassword] = useState(false);
  
  return (
    <div style={{ position: 'relative', marginBottom: '1rem' }}>
      <input
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '1rem 3rem 1rem 1rem',
          border: '2px solid #e5e7eb',
          borderRadius: '1rem',
          background: '#f9fafb',
          fontSize: '1rem',
          transition: 'all 0.2s',
          outline: 'none',
          boxSizing: 'border-box'
        }}
        onFocus={(e) => {
          e.target.style.borderColor = '#FF8EC8';
          e.target.style.background = 'white';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = '#e5e7eb';
          e.target.style.background = '#f9fafb';
        }}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        style={{
          position: 'absolute',
          right: '1rem',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1.2rem',
          color: '#6b7280'
        }}
      >
        {showPassword ? '🙈' : '👁️'}
      </button>
    </div>
  );
}

function LoadingSpinner({ size = 'default' }) {
  const spinnerSize = size === 'large' ? '3rem' : '1.5rem';
  
  return (
    <div style={{
      width: spinnerSize,
      height: spinnerSize,
      border: '3px solid #f3f4f6',
      borderTop: '3px solid #FF8EC8',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      margin: '0 auto'
    }}></div>
  );
}

function ProgressBar({ currentStep, totalSteps }) {
  const progress = (currentStep / totalSteps) * 100;
  
  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{
        width: '100%',
        background: '#f3f4f6',
        borderRadius: '9999px',
        height: '0.5rem'
      }}>
        <div style={{
          background: '#FF8EC8',
          height: '0.5rem',
          borderRadius: '9999px',
          width: `${progress}%`,
          transition: 'all 0.3s ease-out'
        }}></div>
      </div>
    </div>
  );
}

export default function Onboarding() {
  const [cfg, setCfg] = useState({ baseUrl: '', apiKey: '', returnUrl: '' });
  const [session, setSession] = useState({});
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [step, setStep] = useState('SIGN_IN'); // SIGN_IN | PROFILE | CHOOSE | PIN | PIN_CONFIRM | PASSWORD | CREATING | COMPLETE
  const [mode, setMode] = useState('CREATE'); // CREATE | RECOVER
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [recoveredMnemonic, setRecoveredMnemonic] = useState('');
  
  const totalSteps = mode === 'RECOVER' ? 6 : 7; // Sign in, Profile, Choose, PIN, PIN_CONFIRM, Password, Complete
  const getCurrentStepNumber = () => {
    switch (step) {
      case 'SIGN_IN': return 1;
      case 'PROFILE': return 2;
      case 'CHOOSE': return 3;
      case 'PIN': return 4;
      case 'PIN_CONFIRM': return 5;
      case 'PASSWORD': return mode === 'RECOVER' ? 5 : 6;
      case 'CREATING': return mode === 'RECOVER' ? 5 : 6;
      case 'COMPLETE': return mode === 'RECOVER' ? 6 : 7;
      default: return 1;
    }
  };

  useEffect(() => {
    const c = loadConfig();
    const s = loadSession();
    const defaultReturn = `${window.location.origin}/oauth/callback`;
    setCfg({ baseUrl: c.baseUrl || 'http://localhost:3000', apiKey: c.apiKey || 'dev', returnUrl: c.returnUrl || defaultReturn });
    setSession(s);
    const discoveredEmail = extractEmail(s) || '';
    const discoveredAvatar = extractAvatar(s) || '';
    const discoveredName = extractDisplayName(s) || '';
    const discoveredUid = getUserIdentifier(s) || discoveredEmail;
    if (discoveredEmail) {
      setEmail(discoveredEmail);
      setAvatar(discoveredAvatar);
      setDisplayName(discoveredName);
      setStep('PROFILE'); // Show profile confirmation first
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

  function proceedToPinConfirm() {
    if (pin.length !== 4) { 
      setMsg('Please enter a 4-digit PIN.'); 
      return; 
    }
    setMsg('');
    setStep('PIN_CONFIRM');
  }

  function proceedToPassword() {
    if (pin2.length !== 4 || pin !== pin2) { 
      setMsg('PINs must match.'); 
      return; 
    }
    setMsg('');
    setStep('PASSWORD');
  }

  async function confirmProfile() {
    setBusy(true);
    setMsg('Checking for existing wallet...');
    
    try {
      const c = loadConfig();
      const s = loadSession();
      const discoveredUid = getUserIdentifier(s) || email;
      
      // Attempt automatic backup discovery via Data API
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
    } finally {
      setBusy(false);
    }
  }

  function proceedRecover() {
    setMode('RECOVER');
    setStep('PIN');
  }

  async function createAndBackup() {
    if (pin.length !== 4 || pin2.length !== 4 || pin !== pin2) { setMsg('PINs must match and be 4 digits.'); return; }
    if (password.length < 6 || password !== password2) { setMsg('Passwords must match and be at least 6 characters.'); return; }
    setBusy(true); 
    setStep('CREATING');
    setMsg('Creating wallet and backing up...');
    try {
      // 1) Generate mnemonic (128-bit) and prepare backup (pad -> encryptAndSplitSeed)
      const { generateMnemonic, mnemonicToSeed } = await import('@scure/bip39');
      const { wordlist } = await import('@scure/bip39/wordlists/english');
      const mnemonic = generateMnemonic(wordlist, 128);
      const { encrypted, shareA, shareB, meta } = await prepareBackupFromMnemonic(mnemonic, { threshold: 2, totalShares: 2 });

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
    setBusy(true); 
    setStep('CREATING');
    setMsg('Recovering wallet...');
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
      
      // Store the recovered mnemonic for the password step
      setRecoveredMnemonic(mnemonic);
      
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
      
      // Save dashboard (without password encryption yet)
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
      setStep('PASSWORD');
      setMsg('Wallet recovered successfully. Now set your daily password.');
      
      // Recovery completed successfully in the direct decryption block above
    } catch (e) {
      console.error('[RECOVER] Full error object:', e);
      const errorMsg = e?.message || e?.error || (typeof e === 'string' ? e : JSON.stringify(e, null, 2));
      setMsg('Recover failed: ' + errorMsg);
    } finally {
      setBusy(false);
    }
  }

  async function setDailyPassword() {
    if (password.length < 6 || password !== password2) { 
      setMsg('Passwords must match and be at least 6 characters.'); 
      return; 
    }
    if (!recoveredMnemonic) {
      setMsg('No recovered mnemonic found. Please try the recovery process again.');
      return;
    }
    
    setBusy(true);
    setMsg('Setting up your daily password...');
    
    try {
      const s = loadSession();
      if (s.dashboard && s.dashboard.wallet) {
        // Convert mnemonic to seed for password encryption
        const { mnemonicToSeed } = await import('@scure/bip39');
        const seedUint8Array = await mnemonicToSeed(recoveredMnemonic, '');
        const seedBytes = Buffer.from(seedUint8Array);
        
        // Store password-encrypted seed
        storePasswordEncryptedSeed(s.dashboard.wallet.id, seedBytes, password);
        
        setStep('COMPLETE');
        setMsg('Daily password set successfully!');
      } else {
        throw new Error('No wallet found in session');
      }
    } catch (e) {
      console.error('[PASSWORD] Error setting daily password:', e);
      setMsg('Failed to set password: ' + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  if (step === 'CREATING') {
    return (
      <Screen>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <LoadingSpinner size="large" />
          </div>
          <Title>{mode === 'CREATE' ? 'Creating Your Wallet' : 'Recovering Your Wallet'}</Title>
          <Subtitle>
            {mode === 'CREATE' 
              ? 'Generating secure keys and setting up your backup...' 
              : 'Decrypting your backup and restoring your wallet...'
            }
            <br />This may take a moment.
          </Subtitle>
          {msg && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '1rem'
            }}>
              <p style={{ color: '#1d4ed8', fontSize: '0.875rem', margin: 0 }}>{msg}</p>
            </div>
          )}
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      {step !== 'SIGN_IN' && <ProgressBar currentStep={getCurrentStepNumber()} totalSteps={totalSteps} />}
      
      {step === 'SIGN_IN' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '2rem' }}>
            <div style={{
              width: '5rem',
              height: '5rem',
              margin: '0 auto 1.5rem auto',
              filter: 'drop-shadow(0 2px 8px rgba(255, 142, 200, 0.2))',
              borderRadius: '0.75rem',
              overflow: 'hidden'
            }}>
              <img 
                src="/assets/logos/light-logo.png" 
                alt="Jelli Logo" 
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <Title>Welcome to Jelli</Title>
            <Subtitle>Your seedless wallet awaits. Sign in with Google to get started.</Subtitle>
          </div>
          
          <div style={{ marginBottom: '1rem' }}>
            <Button onClick={signIn} disabled={busy} size="large" loading={busy}>
              {busy ? (
                <WhiteSpinner size="large" />
              ) : (
                'Sign In with Google'
              )}
            </Button>
          </div>
          
          {msg && (
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '1rem'
            }}>
              <p style={{ color: '#dc2626', fontSize: '0.875rem', margin: 0 }}>{msg}</p>
            </div>
          )}
        </div>
      )}

      {step === 'PROFILE' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '2rem' }}>
            <div style={{
              width: '5rem',
              height: '5rem',
              borderRadius: '50%',
              margin: '0 auto 1rem auto',
              overflow: 'hidden',
              border: '3px solid #FF8EC8',
              background: '#f9fafb'
            }}>
              {avatar ? (
                <img 
                  src={avatar} 
                  alt={displayName || email} 
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover' 
                  }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#f0fdf4'
                }}>
                  <span style={{ fontSize: '2rem' }}>👤</span>
                </div>
              )}
            </div>
            <Title>Welcome{displayName ? `, ${displayName.split(' ')[0]}` : ''}!</Title>
            <Subtitle>
              You're signed in as:
              <br />
              <strong style={{ color: '#1f2937' }}>{email}</strong>
            </Subtitle>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Button 
              onClick={confirmProfile} 
              disabled={busy}
              size="large"
              loading={busy}
            >
              {busy ? (
                <WhiteSpinner size="large" />
              ) : (
                'Continue'
              )}
            </Button>
          </div>
          
          {msg && !msg.includes('Checking') && !msg.includes('found') && (
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '1rem'
            }}>
              <p style={{ color: '#dc2626', fontSize: '0.875rem', margin: 0 }}>{msg}</p>
            </div>
          )}
        </div>
      )}

      {step === 'CHOOSE' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '2rem' }}>
            <div style={{
              width: '4rem',
              height: '4rem',
              background: '#f0fdf4',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem auto'
            }}>
              <span style={{ fontSize: '1.5rem' }}>👋</span>
            </div>
            <Title>Hello there!</Title>
            <Subtitle>
              Welcome back, {email.split('@')[0]}
              <br />What would you like to do?
            </Subtitle>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Button onClick={proceedCreate} size="large">
              ✨ Create New Wallet
            </Button>
            <Button onClick={proceedRecover} variant="outline">
              🔑 I already have a wallet
            </Button>
          </div>
        </div>
      )}

      {step === 'PIN' && mode === 'CREATE' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '2rem' }}>
            <div style={{
              width: '4rem',
              height: '4rem',
              background: '#f3e8ff',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem auto'
            }}>
              <span style={{ fontSize: '1.5rem' }}>🔐</span>
            </div>
            <Title>Create Your PIN</Title>
            <Subtitle>
              Choose a 4-digit PIN to secure your wallet backup.
              <br />You'll need this to recover your wallet.
            </Subtitle>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <PinInput 
              value={pin} 
              onChange={setPin} 
              label="Enter your 4-digit PIN"
            />
            
            <Button 
              onClick={proceedToPinConfirm} 
              disabled={pin.length !== 4}
              size="large"
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 'PIN_CONFIRM' && mode === 'CREATE' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '2rem' }}>
            <div style={{
              width: '4rem',
              height: '4rem',
              background: '#f3e8ff',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem auto'
            }}>
              <span style={{ fontSize: '1.5rem' }}>🔐</span>
            </div>
            <Title>Confirm Your PIN</Title>
            <Subtitle>
              Enter your PIN again to confirm.
            </Subtitle>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <PinInput 
              value={pin2} 
              onChange={setPin2} 
              label="Confirm your 4-digit PIN"
            />
            
            <Button 
              onClick={proceedToPassword} 
              disabled={pin2.length !== 4 || pin !== pin2}
              size="large"
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 'PIN' && mode === 'RECOVER' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '2rem' }}>
            <div style={{
              width: '4rem',
              height: '4rem',
              background: '#dbeafe',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem auto'
            }}>
              <span style={{ fontSize: '1.5rem' }}>🔓</span>
            </div>
            <Title>Welcome Back!</Title>
            <Subtitle>
              We found your wallet backup.
              <br />Enter your PIN to recover it.
            </Subtitle>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <PinInput 
              value={pin} 
              onChange={setPin} 
              label="Enter your 4-digit PIN"
            />
            
            <Button 
              onClick={recoverWithPin} 
              disabled={busy || pin.length !== 4}
              size="large"
              loading={busy}
            >
              {busy ? (
                <WhiteSpinner size="large" />
              ) : (
                'Recover My Wallet'
              )}
            </Button>
          </div>
          
          {msg && !msg.includes('We found a backup') && (
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '1rem'
            }}>
              <p style={{ color: '#dc2626', fontSize: '0.875rem', margin: 0 }}>{msg}</p>
            </div>
          )}
        </div>
      )}

      {step === 'PASSWORD' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '2rem' }}>
            <div style={{
              width: '4rem',
              height: '4rem',
              background: '#f0f9ff',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem auto'
            }}>
              <span style={{ fontSize: '1.5rem' }}>🔐</span>
            </div>
            <Title>Set Daily Password</Title>
            <Subtitle>
              {mode === 'CREATE' ? 'Almost done! Set a password for daily access.' : 'Great! Your wallet is recovered. Now set a password for daily access.'}
            </Subtitle>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ textAlign: 'left' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Daily Password
              </label>
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder="Enter a secure password"
              />
              <PasswordInput
                value={password2}
                onChange={setPassword2}
                placeholder="Confirm your password"
              />
              <p style={{
                fontSize: '0.75rem',
                color: '#6b7280',
                marginTop: '0.5rem',
                marginBottom: 0
              }}>
                Minimum 6 characters required
              </p>
            </div>
            
            <Button 
              onClick={mode === 'CREATE' ? createAndBackup : setDailyPassword} 
              disabled={busy || password.length < 6 || password !== password2}
              size="large"
              loading={busy}
            >
              {busy ? (
                <WhiteSpinner size="large" />
              ) : (
                mode === 'CREATE' ? 'Create My Wallet' : 'Set Password'
              )}
            </Button>
          </div>
        </div>
      )}

      {step === 'COMPLETE' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '2rem' }}>
            <div style={{
              width: '5rem',
              height: '5rem',
              background: '#f0fdf4',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem auto',
              animation: 'pulse 2s infinite'
            }}>
              <span style={{ fontSize: '2.25rem' }}>🎉</span>
            </div>
            <Title>All Set!</Title>
            <Subtitle>
              Your wallet has been {mode === 'CREATE' ? 'created' : 'recovered'} successfully.
              <br />Your backup is secure and ready to use.
            </Subtitle>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Button onClick={() => window.location.href = '/'} size="large">
              🚀 Open My Wallet
            </Button>
          </div>
        </div>
      )}
    </Screen>
  );
}
