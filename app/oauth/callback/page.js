"use client";

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { loadConfig, loadSession, saveSession } from '../../../lib/storage';
import { oauthComplete } from '../../../lib/api';

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
    <div>
      <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>OAuth Callback</h2>
      {error ? (
        <div style={{ color: '#dc2626', whiteSpace: 'pre-wrap' }}>{error}</div>
      ) : (
        <pre style={{ background: '#0001', border: '1px solid #8883', padding: 12, borderRadius: 6, maxHeight: '40vh', overflow: 'auto' }}>
{result ? JSON.stringify(result, null, 2) : 'Completing...'}
        </pre>
      )}
      <div style={{ marginTop: 12 }}>
        <Link href="/">Back to Home</Link>
      </div>
    </div>
  );
}
