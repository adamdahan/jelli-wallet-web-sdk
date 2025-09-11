# Jelli Web - Seedless Wallet Recovery System

A Next.js web application that provides OAuth authentication and seedless wallet recovery using Juicebox SDK and Firebase backend integration.

## Overview

Jelli Web is a complete wallet recovery system that allows users to:
- Authenticate via Google OAuth using PKCE flow
- Create and recover HD wallets using seedless technology
- Split wallet seeds between Juicebox (user-controlled PIN) and Firebase backend
- Reconstruct and decrypt wallet mnemonics for Phantom wallet compatibility

## Architecture

### Core Components
- **OAuth Flow**: PKCE-based Google OAuth with session management
- **Seedless Recovery**: Shamir's Secret Sharing with 2-of-2 threshold
- **Encryption**: ChaCha20-Poly1305 AEAD for seed protection
- **Backend Integration**: Firebase Data API for backup storage
- **Crypto Adapters**: Platform-specific implementations (Node.js/Web/Mobile)

### Key Technologies
- **Next.js 14** with App Router
- **Juicebox SDK** for hardware security module integration
- **@iheartsolana/jelli-core** for cryptographic operations
- **@noble/ciphers** for web-compatible ChaCha20-Poly1305
- **Firebase** for secure backup storage

## Project Structure

```
jelli-web/
├── app/                          # Next.js App Router
│   ├── page.js                   # Main dashboard with recovery UI
│   ├── onboarding/page.js        # Wallet creation and recovery flow
│   ├── oauth/callback/page.js    # OAuth return handler
│   └── api/                      # API proxy routes
│       ├── oauth/[...path]/      # OAuth backend proxy
│       └── data/[...path]/       # Firebase Data API proxy
├── lib/                          # Core utilities
│   ├── api.js                    # OAuth backend client
│   ├── data-api.js              # Firebase Data API client
│   ├── juicebox.js              # Juicebox SDK wrapper
│   ├── seedless.js              # Seed operations (jelli-core wrapper)
│   ├── auth-utils.js            # User ID extraction utilities
│   ├── pkce.js                  # PKCE helpers
│   ├── storage.js               # Browser storage utilities
│   └── crypto/
│       ├── init.js              # Crypto adapter initialization
│       └── web-crypto-adapter.js # Web-specific crypto implementation
├── WALLET_RECOVERY_SYSTEM.md    # Comprehensive technical documentation
└── web-google-juicebox-strategy.md # Implementation strategy notes
```

## Environment Setup

Create `.env.local` with the following variables:

```env
# OAuth Backend (required)
OAUTH_API_BASE=https://your-oauth-backend.herokuapp.com
OAUTH_API_KEY=your-api-key  # Optional, defaults to 'dev'

# Firebase Data API (required)
DATA_API_BASE=https://your-firebase-backend.herokuapp.com
DATA_API_BEARER=your-bearer-token
```

## Installation & Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

## Wallet Recovery Flow

### 1. Authentication
- User initiates Google OAuth via `/oauth/start`
- PKCE flow ensures secure token exchange
- Firebase custom token provides user identity

### 2. Backup Discovery
- System queries Firebase for existing wallet backups
- Uses Google OAuth user ID (`google:109420296811390119596`)
- Lists available wallets for recovery

### 3. PIN-Based Recovery
- User enters 4-digit PIN (e.g., `1111`)
- System retrieves encrypted backup from Firebase
- Recovers Juicebox share using PIN and hardware security

### 4. Secret Reconstruction
- Combines Juicebox share (33 bytes) with backend share
- Uses Shamir's Secret Sharing reconstruction
- Decrypts seed using ChaCha20-Poly1305 AEAD

### 5. Mnemonic Generation
- Reconstructed seed generates BIP39 mnemonic
- Validates mnemonic compliance
- Derives Solana addresses matching Phantom wallet

## Key Features

### Seedless Security
- **No seed storage**: Seeds never stored in plaintext
- **2-of-2 threshold**: Requires both user PIN and backend access
- **Hardware security**: Juicebox provides HSM-backed protection
- **End-to-end encryption**: ChaCha20-Poly1305 AEAD encryption

### Cross-Platform Compatibility
- **Universal crypto adapters**: Works across Node.js, Web, and React Native
- **Phantom compatibility**: Generated wallets match Phantom derivation
- **BIP39 compliance**: Standard mnemonic format
- **Modern web standards**: Uses SubtleCrypto and @noble/ciphers

### Developer Experience
- **Comprehensive logging**: Detailed debugging throughout recovery flow
- **Error handling**: Clear error messages and recovery guidance
- **Type safety**: TypeScript support in core libraries
- **Testing**: Full test suite with crypto adapter mocking

## Recent Fixes & Improvements

### Web Crypto Compatibility
- Fixed `decryptWithAEAD` to work with async web crypto adapters
- Implemented synchronous-compatible web crypto using @noble/ciphers
- Resolved TypeScript compilation errors in jelli-core
- Added proper Jest test setup for crypto adapters

### OAuth & Routing
- Fixed Next.js API routing for OAuth endpoints
- Resolved duplicate request issues in React StrictMode
- Added proper error handling for missing environment variables
- Implemented session management with localStorage

### Recovery System
- Fixed user ID extraction from Firebase custom tokens
- Corrected Juicebox share length handling (64→33 bytes)
- Added extensive debugging for mnemonic reconstruction
- Implemented backward-compatible crypto adapter system

## API Documentation

### OAuth Endpoints
- `POST /api/oauth/start` - Initiate OAuth flow
- `POST /api/oauth/complete` - Complete token exchange
- `POST /api/oauth/cancel` - Cancel active session

### Data API Endpoints  
- `GET /api/data/v1/apps/{appId}/backups/{userId}/wallets` - List backups
- `GET /api/data/v1/apps/{appId}/backups/{userId}/wallets/{walletId}` - Get backup

## Security Considerations

- **PIN Security**: 4-digit PINs provide user-friendly access control
- **Share Splitting**: No single point of failure for seed reconstruction
- **Transport Security**: All API calls use HTTPS with bearer tokens
- **Client-Side**: Sensitive operations performed in secure browser context
- **Hardware Backing**: Juicebox provides HSM-level security guarantees

## Troubleshooting

### Common Issues
1. **Environment Variables**: Ensure all required env vars are set
2. **CORS**: Backend must allow Next.js origin
3. **WebAssembly**: Ensure WASM files are properly served
4. **Crypto Adapters**: Verify crypto adapter initialization

### Debug Mode
Enable detailed logging by checking browser console for:
- `[OAUTH]` - OAuth flow debugging
- `[DATA]` - Firebase API calls
- `[RECOVER]` - Wallet recovery process
- `[AUTH]` - User authentication details

## Contributing

1. Follow the existing code style and patterns
2. Add comprehensive logging for debugging
3. Ensure backward compatibility with mobile implementations
4. Test across different browsers and environments
5. Update documentation for any API changes

## License

Private - iHeartSolana/Jelli Project

---

For detailed technical documentation, see [WALLET_RECOVERY_SYSTEM.md](./WALLET_RECOVERY_SYSTEM.md)