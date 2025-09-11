// Seedless helpers using @iheartsolana/jelli-core
// - Pads mnemonic to fixed length
// - encryptAndSplitSeed -> returns encrypted envelope + Shamir shares

import { encryptAndSplitSeed, reconstructAndDecryptSeed } from '@iheartsolana/jelli-core';

/**
 * Pad a UTF-8 string to a fixed byte length using zero padding.
 */
export function padTo(bytes, size = 256) {
  const out = new Uint8Array(size);
  const len = Math.min(bytes.length, size);
  out.set(bytes.slice(0, len));
  return out;
}

/**
 * Prepare backup artifacts from a mnemonic string using jelli-core.
 * Returns { encrypted, shareA, shareB, meta }
 */
export async function prepareBackupFromMnemonic(mnemonic, { threshold = 2, totalShares = 2 } = {}) {
  const encoder = new TextEncoder();
  const padded = padTo(encoder.encode(mnemonic), 256);

  const result = await encryptAndSplitSeed(padded, { threshold, totalShares });
  if (!result?.keyShares || !result?.encrypted) {
    throw new Error('encryptAndSplitSeed failed');
  }

  const shareA = new Uint8Array(result.keyShares.shares[0]);
  const shareB = new Uint8Array(result.keyShares.shares[1]);

  const encrypted = {
    ciphertext: new Uint8Array(result.encrypted.ciphertext),
    nonce: new Uint8Array(result.encrypted.nonce),
    authTag: new Uint8Array(result.encrypted.authTag),
    algorithm: result.encrypted.algorithm,
  };

  return {
    encrypted,
    shareA,
    shareB,
    meta: {
      threshold: result.keyShares.threshold,
      totalShares: result.keyShares.totalShares,
      juiceboxKeyShareLength: shareB.length,
    },
  };
}

/**
 * Reconstruct mnemonic from encrypted + shares using jelli-core.
 * - encrypted: { ciphertext, nonce, authTag, algorithm } (Uint8Arrays)
 * - shareA: Uint8Array (backend share)
 * - recoveredShareB: Uint8Array (Juicebox recovered bytes)
 * - expectedShareLength: number (length of original shareB; trims padding)
 */
export async function recoverMnemonicFromBackup({ encrypted, shareA, recoveredShareB, expectedShareLength, threshold = 2 }) {
  const juiceboxKeyShare = expectedShareLength ? recoveredShareB.slice(0, expectedShareLength) : recoveredShareB;
  console.log('[SEEDLESS] Share A length:', shareA.length, 'bytes');
  console.log('[SEEDLESS] Share A first 10 bytes:', Array.from(shareA.slice(0, 10)));
  console.log('[SEEDLESS] Juicebox share length:', juiceboxKeyShare.length, 'bytes');
  console.log('[SEEDLESS] Juicebox share first 10 bytes:', Array.from(juiceboxKeyShare.slice(0, 10)));
  
  const keyShares = [shareA, juiceboxKeyShare];
  
  console.log('[SEEDLESS] Encrypted object:', {
    ciphertextLength: encrypted.ciphertext.length,
    nonceLength: encrypted.nonce.length,
    authTagLength: encrypted.authTag.length,
    algorithm: encrypted.algorithm
  });
  console.log('[SEEDLESS] Calling reconstructAndDecryptSeed with threshold:', threshold);
  
  const result = await reconstructAndDecryptSeed(encrypted, keyShares, threshold);
  
  console.log('[SEEDLESS] Reconstruction result:', {
    success: result?.success,
    error: result?.error,
    seedBytesLength: result?.seedBytes?.length || 0
  });
  
  if (!result || !result.success) {
    const errorMsg = result?.error || 'Unknown reconstruction error';
    throw new Error('Failed to reconstruct and decrypt mnemonic: ' + errorMsg);
  }
  // result.seedBytes is padded mnemonic bytes
  const padded = result.seedBytes;
  console.log('[SEEDLESS] Padded result length:', padded.length);
  console.log('[SEEDLESS] First 20 bytes:', Array.from(padded.slice(0, 20)));
  
  const nullIndex = padded.indexOf(0);
  console.log('[SEEDLESS] Null terminator at index:', nullIndex);
  
  // If nullIndex is 0, the data is corrupted or decryption failed
  if (nullIndex === 0) {
    throw new Error('Decryption failed - recovered data starts with null byte');
  }
  
  const mnemonicBytes = nullIndex >= 0 ? padded.slice(0, nullIndex) : padded;
  console.log('[SEEDLESS] Mnemonic bytes length:', mnemonicBytes.length);
  
  const mnemonic = Buffer.from(mnemonicBytes).toString('utf8').trim();
  console.log('[SEEDLESS] Decoded mnemonic string:', JSON.stringify(mnemonic));
  
  return mnemonic;
}

