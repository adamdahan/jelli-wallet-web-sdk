# Web Strategy: Google Sign‑In + Juicebox (Seedless Wallets)

This document outlines a production‑grade web architecture to enable “sign in with Google + 4‑digit PIN” for self‑custodial seed backup and recovery using Juicebox, modeled after Phantom’s approach while adapting it for a website.

## Goals & Principles

- Usability: Google sign‑in + short PIN; no seed phrase UX.
- Self‑custody: Seed exists in plaintext only on the user’s device.
- Split custody: Backend stores ciphertext; Juicebox gates a key share by PIN.
- No client secrets: The Juicebox tenant signing key lives only on the backend.
- Least privilege: Short‑lived tokens, scoped API, auditable events, KMS.

## High‑Level Architecture

- Browser client (SPA): 
  - Performs Google OAuth sign‑in (OIDC) to your backend.
  - Generates seed + symmetric key; encrypts seed locally.
  - Registers/recovers a PIN‑gated share via Juicebox.
- Backend (serverless or service):
  - Owns the Juicebox tenant signing private key (never shipped to the client).
  - Vends per‑realm auth tokens on demand to authenticated sessions.
  - Stores seed ciphertext and the backend key share (KMS‑protected).
  - Stores/derives a stable `secretId` linked to the user.
- Juicebox network:
  - Stores the PIN‑gated share via OPRF protocol across configured realms.
- Google Identity:
  - OAuth2/OIDC used for session authentication and account binding.

## Data & Crypto Model

- Seed entropy: 32 bytes (or per wallet standard), generated client‑side.
- Symmetric key: 32 bytes, generated client‑side.
- Encryption: ChaCha20‑Poly1305 or AES‑GCM (WebCrypto natively supports AES‑GCM; ChaCha requires a library). Store `ciphertext`, `nonce`, `alg`, and optional AAD.
- Key split: Shamir Secret Sharing (2‑of‑2 to start; consider 2‑of‑3 for resilience):
  - Share A (backend share): Stored in backend, KMS‑encrypted at rest.
  - Share B (Juicebox share): Registered to Juicebox, gated by PIN via OPRF; internally Juicebox further distributes sub‑shares across realms.
- `secretId`: 16‑byte hex identifier stable per user. Store server‑side; optionally mirror in client storage for convenience.
- Realms: Curated list of Juicebox realms with `register_threshold` and `recover_threshold` set per risk appetite (e.g., 2‑of‑2 now, 2‑of‑3 later).

## Registration / Backup Flow (Browser + Backend)

1) User signs in with Google on the website.
- Browser: Initiate Google OAuth2 (OIDC) → receive code → exchange at backend.
- Backend: Validates tokens, creates an app session (HTTP‑only cookie or token).

2) Client generates local materials.
- Generate `seed` and `symKey` using WebCrypto/secure RNG.
- Encrypt `seed` with `symKey` → `ciphertext` (store alg + nonce + AAD).
- Split `symKey` into shares (A, B) via Shamir 2‑of‑2.

3) Persist non‑custodial artifacts to backend.
- POST `/backup` with `{ ciphertext, nonce, alg, aad, version }`.
- POST `/backup/share` with `{ shareA, version }` (backend share), KMS wrap at rest.
- Backend associates with authenticated user and a `secretId` (create if absent).

4) Obtain per‑realm Juicebox tokens from backend.
- Browser calls `POST /juicebox-tokens` with `{ secretId, realmIds[] }`.
- Backend signs one JWT per realm using the tenant signing key + version; returns `{ [realmId]: token }`.

5) Register Juicebox share B with the user’s PIN.
- Browser prompts user for 4‑digit PIN; NEVER send PIN to backend.
- Using Juicebox web client, call `register(configuration, authentication, pin, secretPartB, info, guesses)`.
  - `authentication` is the map returned from `/juicebox-tokens`.
  - `info` is stable salt context (e.g., your tenant string or user ID).
  - `guesses` sets lockout threshold for wrong PIN attempts.

6) Local persistence for UX (optional).
- Cache `secretId` and minimal metadata in local storage for faster subsequent operations. Do not cache sensitive shares or PINs.

Result: Backend has only ciphertext + Share A; Juicebox holds Share B (PIN‑gated). Only the user, with Google account access + correct PIN, can reconstruct `symKey` and decrypt the seed.

## Recovery Flow

1) User signs in with Google.
- Same OIDC flow; obtain an authenticated app session.

2) Fetch backup artifacts and tokens.
- GET `/backup` → returns `{ ciphertext, nonce, alg, aad, version }`.
- GET `/backup/share` → returns `{ shareA, version }` (after auth checks).
- POST `/juicebox-tokens` with `{ secretId, realmIds[] }` → returns auth tokens.

3) Reconstruct symmetric key and decrypt.
- Browser prompts for PIN.
- Use Juicebox to `recover(configuration, authentication, pin, info)` → returns Share B.
- Reconstruct `symKey` from Share A and Share B; decrypt seed locally.

4) Optional: Re‑register (e.g., realm list upgrades or threshold changes).
- If configuration changed, re‑register Share B under new realms/thresholds.

## Endpoint Sketches (Backend)

All endpoints require an authenticated session (post‑Google sign‑in). Use CSRF protection for cookie sessions; use short‑lived JWTs if SPA bearer tokens.

- POST `/juicebox-tokens`
  - Request: `{ secretId: string, realmIds: string[], keyVersion?: number }`
  - Response: `{ tokens: { [realmId: string]: string /* JWT */ }, keyVersion: number, exp: number }`
  - Behavior: Signs a per‑realm token for the `secretId` using the tenant signing key (with `keyVersion`).

- POST `/backup`
  - Request: `{ ciphertext: base64, nonce: base64, alg: 'AES-GCM' | 'CHACHA20-POLY1305', aad?: base64, version: number }`
  - Response: `201 Created`
  - Behavior: Stores ciphertext blob keyed by user + version (idempotency on version).

- POST `/backup/share`
  - Request: `{ shareA: base64, version: number }`
  - Response: `201 Created`
  - Behavior: KMS‑encrypts `shareA` (KEK‑DEK pattern) and stores it alongside `backup` record.

- GET `/backup`
  - Response: `{ ciphertext, nonce, alg, aad?, version }`

- GET `/backup/share`
  - Response: `{ shareA, version }`

- Optional: POST `/backup/rotate`
  - Rotates encryption or Shamir parameters; returns new envelopes to client for re‑registration.

Notes:
- Prefer a single `/backup` POST that includes `shareA` if storage systems are unified. Separate endpoints clarify access control and auditing.
- Add rate limits and audit logs to `/juicebox-tokens` and `/backup/share`.

## Juicebox Configuration

- Realms: Curate a list (e.g., `gcp.realms.juicebox.xyz`, `aws.realms.juicebox.xyz`, plus a load‑balanced realm).
- Thresholds: Start with `{ register_threshold: 2, recover_threshold: 2 }` for 2‑of‑2; plan to move to 2‑of‑3.
- Pin hashing mode: `Standard2019` (strong mode) for production.
- Stable `info`: A tenant identifier or user ID; must match between register and recover.

## Security Controls

- Secrets & keys:
  - Tenant signing private key: store in HSM/KMS; do not expose to app code.
  - Backend share: wrap with KMS (KEK‑DEK); access via least‑privileged role.
  - Key rotation: Support `version` in JWTs and shares; publish next key ID; dual‑sign during rotation windows.
- Token hygiene:
  - Short JWT TTLs (minutes) for Juicebox tokens; bind tokens to `secretId` and audience (realm).
  - Server‑side rate limiting and anomaly detection (per user/IP/device).
- PIN safety:
  - PIN never leaves the client; wrong‑attempt throttling enforced by Juicebox OPRF + `guesses`.
- Web app posture:
  - HTTPS everywhere, HSTS, CSP, SRI, CSRF protection, SameSite cookies.
  - Strict dependency pinning for crypto libs; SCA scanning; SRI for CDN.
- Privacy:
  - No logging of secrets, shares, PINs, or ciphertexts; redact tokens in logs.

## Operational Considerations

- Realm management: Track current/previous realm sets; recover should fall back to previous realms if needed.
- Migration: Build re‑register tooling when thresholds/realms change.
- Backups & DR: Encrypt at rest; test restores; implement data retention and deletion.
- Monitoring: Metrics for token issuance, backup/recovery success, PIN failure counts, rate limiting.

## UX Guidelines

- PIN UX: Educate that PIN is required for recovery; we cannot recover it for users.
- Periodic PIN verification: Prompt occasionally to keep memory fresh (configurable cadence).
- Multi‑device guidance: Encourage recovery onto a second device post‑onboarding.
- Failure states: Clear messaging for invalid PIN, no backup found, or auth issues.

## Client Pseudocode (Browser)

```ts
// after Google sign‑in completes and session cookie is set
const realmIds = [/* from config */];
const secretId = await fetch('/api/me').then(r => r.json()).then(x => x.secretId);

// 1) Generate
const seed = crypto.getRandomValues(new Uint8Array(32));
const symKey = crypto.getRandomValues(new Uint8Array(32));

// 2) Encrypt (AES‑GCM example)
const key = await crypto.subtle.importKey('raw', symKey, 'AES-GCM', false, ['encrypt']);
const nonce = crypto.getRandomValues(new Uint8Array(12));
const ciphertextBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, seed);
const ciphertext = new Uint8Array(ciphertextBuf);

// 3) Split key
const { shareA, shareB } = shamirSplit(symKey, { threshold: 2, shares: 2 });

// 4) Persist to backend
await fetch('/backup', { method: 'POST', body: JSON.stringify({ ciphertext: b64(ciphertext), nonce: b64(nonce), alg: 'AES-GCM', version: 1 }) });
await fetch('/backup/share', { method: 'POST', body: JSON.stringify({ shareA: b64(shareA), version: 1 }) });

// 5) Tokens
const { tokens } = await fetch('/juicebox-tokens', { method: 'POST', body: JSON.stringify({ secretId, realmIds }) }).then(r => r.json());

// 6) Register with Juicebox (conceptual web API)
await juicebox.register(configuration, tokens, pinToBytes(userPin), shareB, infoBytes, guesses);
```

## Server Token Minting (Sketch)

```ts
// POST /juicebox-tokens
export async function handler(req, res) {
  assertAuthenticated(req);
  const { secretId, realmIds } = req.body;

  const tokens = {} as Record<string, string>;
  for (const realmId of realmIds) {
    tokens[realmId] = await signJuiceboxJwt({ realmId, secretId, keyVersion: CURRENT_KID });
  }
  res.json({ tokens, keyVersion: CURRENT_KID, exp: Date.now() + 2 * 60 * 1000 });
}
```

## Implementation Checklist

- Google OAuth2/OIDC login and secure session management.
- Backend storage for: users, `secretId`, ciphertext envelopes, backend shares, audit logs.
- KMS integration for tenant signing key + backend share (KEK‑DEK).
- `/juicebox-tokens`, `/backup`, `/backup/share`, `/backup` retrieval endpoints.
- Realm configuration and rotation processes; key versioning.
- Client crypto: RNG, encryption, Shamir, and Juicebox web client integration.
- Rate limiting, monitoring, alerting, and privacy‑safe logging.
- UX for PIN setup, periodic verification, recovery, and error handling.

## Variants & Extensions

- 2‑of‑3 design: Store a third share in a user device backup or passkey‑guarded vault to improve recoverability.
- WebAuthn binding: Protect backend share retrieval behind a platform authenticator challenge.
- Risk engine: Challenge issuance of `/juicebox-tokens` based on device/IP anomalies.

---

This strategy keeps the signing key server‑side, leverages Google for account auth, and uses Juicebox’s PIN‑gated OPRF flow so that only the user—never the server—can reconstruct the symmetric key and decrypt the seed.
