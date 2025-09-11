Jelli OAuth SPA (Next.js)
=========================

Minimal Next.js app to exercise the jelli-oauth-backend API with PKCE.

What it does
- Configures backend Base URL and API key.
- Starts OAuth with PKCE, redirects to provider, and completes on return.
- Provides quick actions for `/health` and `/oauth/cancel`.

Project structure
- `app/`: Next.js App Router pages.
  - `page.js`: Main UI (config, start/complete/cancel, logs).
  - `oauth/callback/page.js`: Handles return from the provider and calls `/oauth/complete`.
- `lib/`: utilities.
  - `api.js`: Backend API calls.
  - `pkce.js`: PKCE helpers.
  - `storage.js`: Local/session storage helpers.
- `jelli-oauth-backend.postman_collection.json`: Reference for API calls.
- `heroku-dev.postman_environment.json`: Example environment for hosted backend.

Run locally
1) Install deps: `npm install`
2) Dev server: `npm run dev` (default at http://localhost:3000)
3) In the app:
   - Base URL: your backend (e.g., `http://localhost:3000` or the Heroku URL`)`
   - API Key: typically `dev` for local
   - Return URL defaults to `http://localhost:3000/oauth/callback` (or your dev URL). Ensure this is allowed by your backend.
4) Click “Start OAuth”, complete provider login, the callback page will auto-call `/oauth/complete` and show the result.

Notes
- `sessionId`, `codeVerifier`, and `codeChallenge` are stored in `sessionStorage` for the current tab.
- CORS must allow the Next.js origin. If your backend uses cookies, also enable `Access-Control-Allow-Credentials` and set fetch `credentials: 'include'` as needed.

