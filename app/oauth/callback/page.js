"use client";

import { useEffect, useState, useRef } from 'react';
import { loadConfig, loadSession, saveSession } from '../../../lib/storage';
import { oauthComplete } from '../../../lib/api';

// Reuse the same design components from onboarding
function Screen({ children }) {
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

function Title({ children }) {
  return <h1 style={{
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: '0.75rem',
    textAlign: 'center'
  }}>{children}</h1>;
}

function Subtitle({ children }) {
  return <p style={{
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: '1.5rem',
    lineHeight: '1.625'
  }}>{children}</p>;
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

export default function CallbackPage() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const completedRef = useRef(false);

  useEffect(() => {
    const cfg = loadConfig();
    const s = loadSession();
    
    async function run() {
      if (completedRef.current) return; // Prevent duplicate runs
      completedRef.current = true;
      
      if (!s.sessionId || !s.codeVerifier) {
        setError('Missing sessionId/codeVerifier; cannot complete.');
        return;
      }
      
      // Check if we already have a successful OAuth result
      if (s.oauth?.firebaseCustomToken) {
        console.log('[OAUTH] Already have valid OAuth result, redirecting...');
        setResult(s.oauth);
        setTimeout(() => { window.location.href = '/onboarding'; }, 600);
        return;
      }
      
      const { ok, data } = await oauthComplete({ baseUrl: cfg.baseUrl, sessionId: s.sessionId, codeVerifier: s.codeVerifier });
      if (ok) {
        setResult(data);
        // Persist OAuth result (profile/email if present) for downstream flows like Juicebox
        const next = { ...s, oauth: data };
        saveSession(next);
        setTimeout(() => { window.location.href = '/onboarding'; }, 600);
      } else {
        setError(typeof data === 'string' ? data : JSON.stringify(data));
        // Still persist original session for troubleshooting
        saveSession(s);
      }
    }
    
    run();
  }, []);

  return (
    <Screen>
      <div style={{ textAlign: 'center' }}>
        {error ? (
          <>
            <div style={{
              width: '4rem',
              height: '4rem',
              background: '#fef2f2',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem auto'
            }}>
              <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            </div>
            <Title>Sign In Error</Title>
            <Subtitle>There was an issue completing your sign in. Please try again.</Subtitle>
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '1rem',
              textAlign: 'left'
            }}>
              <p style={{ color: '#dc2626', fontSize: '0.875rem', margin: 0, fontFamily: 'monospace' }}>
                {error}
              </p>
            </div>
          </>
        ) : (
          <>
            <div style={{
              width: '4rem',
              height: '4rem',
              margin: '0 auto 1rem auto',
              filter: 'drop-shadow(0 2px 6px rgba(255, 142, 200, 0.2))',
              borderRadius: '0.5rem',
              overflow: 'hidden'
            }}>
              <img 
                src="/assets/logos/light-logo.png" 
                alt="Jelli" 
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <Title>Completing Sign In</Title>
            <Subtitle>
              {result ? 'Success! Redirecting to your wallet...' : 'Verifying your Google account...'}
            </Subtitle>
            <div style={{ marginBottom: '1.5rem' }}>
              <LoadingSpinner size="large" />
            </div>
          </>
        )}
      </div>
    </Screen>
  );
}
