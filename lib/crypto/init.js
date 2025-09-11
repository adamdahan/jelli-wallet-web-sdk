// Initialize web crypto adapter for jelli-core
"use client";
import { setCryptoAdapter } from '@iheartsolana/jelli-core';
import { createWebCryptoAdapter } from './web-crypto-adapter';

// Idempotent init
try {
  setCryptoAdapter(createWebCryptoAdapter());
  // eslint-disable-next-line no-console
  console.log('[Jelli] Web crypto adapter initialized');
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('[Jelli] Failed to init crypto adapter', e?.message || e);
}

