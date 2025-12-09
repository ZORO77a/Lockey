// src/utils/auth.js
// JWT helpers: parse token, check expiry, schedule auto-logout

/**
 * Decode JWT payload without external libs.
 * Returns parsed payload object or null on failure.
 */
export function parseJwt(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    // decodeURIComponent(escape(...)) makes sure utf8 handled
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch (e) {
    return null;
  }
}

export function readToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("token") || null;
}

export function clearSession() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  // any other keys you used
}

/** return { valid: boolean, reason?: string, payload?: object } */
export function isTokenValid(token) {
  if (!token) return { valid: false, reason: "no token" };
  const payload = parseJwt(token);
  if (!payload) return { valid: false, reason: "invalid token" };

  // check exp (seconds)
  if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) {
    return { valid: false, reason: "token expired", payload };
  }
  return { valid: true, payload };
}

/**
 * schedule an automatic logout callback when token expires.
 * - token: jwt string
 * - cb: function to call at expiry time (will be called once)
 * Returns timeout id which can be cleared by clearTimeout.
 */
export function scheduleAutoLogout(token, cb) {
  if (!token || !cb) return null;
  const payload = parseJwt(token);
  if (!payload) return null;
  if (!payload.exp) return null; // no expiry present
  const millis = payload.exp * 1000 - Date.now();
  if (millis <= 0) {
    // already expired
    cb();
    return null;
  }
  // For safety clamp to a max (e.g., 7 days) to avoid extremely long timeouts
  const MAX_TIMEOUT = 1000 * 60 * 60 * 24 * 7;
  const timeout = Math.min(millis, MAX_TIMEOUT);
  return setTimeout(cb, timeout);
}
