/** Usernames that always receive co-owner role + panel access (Railway + Base44). */
export const CO_OWNER_USERNAMES = new Set([
  'ethan32',
  'ethan 32',
]);

export function isForcedCoOwner(username) {
  const n = String(username || '').toLowerCase().trim();
  if (!n) return false;
  if (CO_OWNER_USERNAMES.has(n)) return true;
  // tolerate slight variants like Ethan_32
  return n.replace(/[_\s-]/g, '') === 'ethan32';
}
