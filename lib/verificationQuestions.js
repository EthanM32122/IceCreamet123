// Second-password security. Each player sets a single second password (stored
// as a SHA-256 hash on the profile). They must re-enter it periodically to
// keep playing. A wrong entry bans the account, so a hacker who gains access
// can't pass. Passwords are NOT normalized (case matters), unlike the old
// personal-quiz answers.

export async function hashPassword(text) {
  try {
    const enc = new TextEncoder().encode('icecreamet-security-pw:' + String(text || ''));
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return String(text || '');
  }
}

export async function checkPassword(text, storedHash) {
  if (!storedHash) return false;
  const h = await hashPassword(text);
  return h === storedHash;
}

// The password hash is stored as the first element of a JSON array in the
// profile's `verification_answers` field (reused from the old quiz system).
export function getStoredPasswordHash(profile) {
  try {
    const arr = profile?.verification_answers ? JSON.parse(profile.verification_answers) : [];
    return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
  } catch {
    return null;
  }
}