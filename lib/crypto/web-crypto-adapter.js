// Web Crypto Adapter for @iheartsolana/jelli-core
// Provides ChaCha20-Poly1305 via @noble/ciphers and AES-GCM via SubtleCrypto.

import { Buffer } from 'buffer';

let nobleChacha;
async function getChacha() {
  if (!nobleChacha) {
    const mod = await import('@noble/ciphers/chacha');
    nobleChacha = mod.chacha20poly1305 || mod.default?.chacha20poly1305 || mod;
  }
  return nobleChacha;
}

function toUint8(buf) {
  if (buf instanceof Uint8Array) return buf;
  return new Uint8Array(buf.buffer ?? buf);
}

function toBuffer(u8) {
  return Buffer.from(u8);
}

function webRandomBytes(size) {
  const out = new Uint8Array(size);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(out);
  else {
    for (let i = 0; i < size; i++) out[i] = Math.floor(Math.random() * 256);
  }
  return toBuffer(out);
}

// AES-GCM functions removed - jelli-core only uses ChaCha20-Poly1305

function createChaChaCipher(keyBuf, ivBuf) {
  const keyU8 = toUint8(keyBuf);
  const nonceU8 = toUint8(ivBuf);
  const chunks = [];
  return {
    update(dataBuf) { 
      chunks.push(toUint8(dataBuf)); 
      return Buffer.alloc(0); 
    },
    final() {
      const plaintext = chunks.length === 1 ? chunks[0] : new Uint8Array(chunks.reduce((n, a) => n + a.length, 0));
      if (chunks.length > 1) { let o = 0; for (const c of chunks) { plaintext.set(c, o); o += c.length; } }
      
      // Use synchronous approach - import chacha at module level
      const { chacha20poly1305 } = require('@noble/ciphers/chacha');
      const cipher = chacha20poly1305(keyU8, nonceU8);
      const encrypted = cipher.encrypt(plaintext);
      
      // Split ciphertext and auth tag like React Native adapter
      const tag = encrypted.slice(encrypted.length - 16);
      this._authTag = tag;
      const ciphertext = encrypted.slice(0, encrypted.length - 16);
      return toBuffer(ciphertext);
    },
    getAuthTag() { return toBuffer(this._authTag || new Uint8Array(16)); },
  };
}

function createChaChaDecipher(keyBuf, ivBuf) {
  const keyU8 = toUint8(keyBuf);
  const nonceU8 = toUint8(ivBuf);
  const chunks = [];
  let tagU8 = null;
  return {
    setAuthTag(tagBuf) { tagU8 = toUint8(tagBuf); },
    update(dataBuf) { 
      chunks.push(toUint8(dataBuf)); 
      
      // If we have auth tag, decrypt immediately (Node.js crypto behavior)
      if (tagU8) {
        const ciphertext = chunks.length === 1 ? chunks[0] : new Uint8Array(chunks.reduce((n, a) => n + a.length, 0));
        if (chunks.length > 1) { let o = 0; for (const c of chunks) { ciphertext.set(c, o); o += c.length; } }
        
        // Use synchronous approach - import chacha at module level
        const { chacha20poly1305 } = require('@noble/ciphers/chacha');
        const cipher = chacha20poly1305(keyU8, nonceU8);
        
        // Combine ciphertext and auth tag like React Native adapter
        const encryptedWithTag = new Uint8Array(ciphertext.length + tagU8.length);
        encryptedWithTag.set(ciphertext, 0);
        encryptedWithTag.set(tagU8, ciphertext.length);
        
        const decrypted = cipher.decrypt(encryptedWithTag);
        return toBuffer(decrypted);
      }
      
      return Buffer.alloc(0); 
    },
    final() {
      // Node.js crypto final() just verifies auth tag, doesn't return data
      if (!tagU8) throw new Error('ChaCha20-Poly1305 missing auth tag');
      return Buffer.alloc(0);
    }
  };
}

export function createWebCryptoAdapter() {
  return {
    randomBytes: webRandomBytes,
    createCipheriv(algorithm, key, iv) {
      const alg = String(algorithm).toLowerCase();
      if (alg.includes('chacha20') || alg.includes('poly1305')) return createChaChaCipher(key, iv);
      throw new Error(`Unsupported algorithm: ${algorithm}. Only ChaCha20-Poly1305 is supported.`);
    },
    createDecipheriv(algorithm, key, iv) {
      const alg = String(algorithm).toLowerCase();
      if (alg.includes('chacha20') || alg.includes('poly1305')) return createChaChaDecipher(key, iv);
      throw new Error(`Unsupported algorithm: ${algorithm}. Only ChaCha20-Poly1305 is supported.`);
    },
  };
}

