// Thin web wrapper around the official Juicebox web/WASM SDK (`juicebox-sdk`)
// Exposes: makeClient, registerShare, recoverShare, deleteShare, randomSecretId

import { JUICEBOX_CONFIG } from './juicebox-config.js';

const DEFAULT_INFO = 'jelli_key_share';

export async function makeClient({ realms = JUICEBOX_CONFIG.realms, register_threshold = JUICEBOX_CONFIG.register_threshold, recover_threshold = JUICEBOX_CONFIG.recover_threshold, pin_hashing_mode = 'Standard2019', previous = [] } = {}) {
  const mod = await import('juicebox-sdk');
  const { Client, Configuration } = mod;

  const cfg = new Configuration({
    realms,
    register_threshold,
    recover_threshold,
    pin_hashing_mode,
  });

  // Previous configurations list (optional, for migrations). Keep empty for now.
  const client = new Client(cfg, previous);
  return { client, mod };
}

function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (typeof input === 'string') return new TextEncoder().encode(input);
  throw new Error('Unsupported input type');
}

// Enforce max 128 bytes for Juicebox secret value
function capSecretBytes(bytes) {
  const MAX = 128;
  if (bytes.length <= MAX) return bytes;
  return bytes.slice(0, MAX);
}

/**
 * Register a PIN-gated share with Juicebox.
 * - pin: string | Uint8Array (user PIN)
 * - shareBytes: Uint8Array (key share B) – will be capped to 128 bytes
 * - info: string | Uint8Array – must be stable across register/recover
 * - guesses: number – allowed guesses before lockout
 */
export async function registerShare({ client, pin, shareBytes, info = DEFAULT_INFO, guesses = 5 }) {
  if (!client) throw new Error('registerShare requires a client');
  const pinBytes = toBytes(pin);
  const infoBytes = toBytes(info);
  const secretBytes = capSecretBytes(shareBytes);
  await client.register(pinBytes, secretBytes, infoBytes, guesses);
}

/**
 * Recover a PIN-gated share from Juicebox. Returns Uint8Array (share bytes).
 */
export async function recoverShare({ client, pin, info = DEFAULT_INFO }) {
  if (!client) throw new Error('recoverShare requires a client');
  const pinBytes = toBytes(pin);
  const infoBytes = toBytes(info);
  return client.recover(pinBytes, infoBytes);
}

/**
 * Delete any registered secret for the current configuration.
 */
export async function deleteShare({ client }) {
  if (!client) throw new Error('deleteShare requires a client');
  await client.delete();
}

export async function randomSecretId() {
  const mod = await import('juicebox-sdk');
  // In web/WASM, a random secret ID is provided by AuthTokenGenerator as a convenience.
  // We do not use AuthTokenGenerator for token minting on the client, but we can reuse
  // its random_secret_id helper.
  const { AuthTokenGenerator } = mod;
  return AuthTokenGenerator.random_secret_id();
}

