/** Usernames that always receive co-owner role + panel access. */
export const CO_OWNER_USERNAMES = new Set([
  'ethan32',
]);

export function isForcedCoOwner(username) {
  return CO_OWNER_USERNAMES.has(String(username || '').toLowerCase().trim());
}
