// Utility functions for extracting user information from OAuth/Firebase tokens

/**
 * Extract the Google OAuth user ID from the session
 * According to the SDK docs, this should be the Google user ID, not Firebase UID
 * @param {Object} session - The session object from loadSession()
 * @returns {string|null} - The extracted Google user ID or null if not found
 */
export function extractGoogleUserID(session) {
  if (!session?.oauth) return null;

  // Try to extract from Firebase custom token first
  // The Firebase custom token 'uid' field contains the actual user ID for API calls
  try {
    if (session.oauth.firebaseCustomToken) {
      const token = session.oauth.firebaseCustomToken;
      const payload = JSON.parse(atob(token.split('.')[1]));
      // The 'uid' field contains the user ID (e.g., "google:109420296811390119596")
      if (payload.uid) {
        console.log('[AUTH] Extracted user ID from Firebase custom token:', payload.uid);
        return payload.uid;
      }
    }
  } catch (e) {
    console.warn('[AUTH] Failed to decode Firebase custom token:', e);
  }

  // Try other possible locations for Google user ID in the OAuth response
  const possibleUserIDs = [
    session.oauth.user?.id,           // Google user.id
    session.oauth.profile?.id,        // Google profile.id
    session.oauth.profile?.sub,       // Google profile.sub
    session.oauth.data?.profile?.id,  // Nested profile.id
    session.oauth.data?.profile?.sub, // Nested profile.sub
    session.oauth.sub,                // Direct sub field
    session.oauth.userId,             // userId field
    session.oauth.user?.uid,          // Fallback to uid
  ].filter(Boolean);

  if (possibleUserIDs.length > 0) {
    console.log('[AUTH] Found possible Google user IDs:', possibleUserIDs);
    return possibleUserIDs[0]; // Return the first valid one
  }

  console.warn('[AUTH] No Google user ID found in session');
  return null;
}

/**
 * Extract email from the OAuth session
 * @param {Object} session - The session object from loadSession()
 * @returns {string|null} - The extracted email or null if not found
 */
export function extractEmail(session) {
  if (!session?.oauth) return null;

  const possibleEmails = [
    session.oauth.profile?.email,
    session.oauth.data?.profile?.email,
    session.oauth.email,
    session.oauth.user?.email,
  ].filter(Boolean);

  return possibleEmails[0] || null;
}

/**
 * Get the best available user identifier for API calls
 * According to SDK docs, should be the Google OAuth user ID
 * @param {Object} session - The session object from loadSession()
 * @returns {string|null} - The user identifier to use for API calls
 */
export function getUserIdentifier(session) {
  const googleUserID = extractGoogleUserID(session);
  if (googleUserID) return googleUserID;

  const email = extractEmail(session);
  if (email) {
    console.warn('[AUTH] Using email as fallback user identifier:', email);
    return email;
  }

  console.error('[AUTH] No user identifier found in session');
  return null;
}
