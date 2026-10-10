// Client-side mirror of base44/shared/economy.ts admin restriction logic.
// Used by the Admin Abuse panel to filter out blooks that admins cannot grant
// (Hivelands, PAC3/Mega Dragonite, Summer, Golden, Spooky, trophies, plushes).

export const SPOOKY_PACK_ID = '6abdc8898281b760c964c249';
export const HIVELANDS_PACK_ID = '6ac16ad4076befcf48d45858';
export const SUMMER_PACK_ID = '6a9c854b923f12c122f1f58a';
export const GOLDEN_PACK_ID = '6a9c8543d9146d362a45bc92';

export const ADMIN_RESTRICTED_PACK_IDS = new Set([
  SPOOKY_PACK_ID,
  HIVELANDS_PACK_ID,
  SUMMER_PACK_ID,
  GOLDEN_PACK_ID
]);

export const ADMIN_RESTRICTED_BLOOK_NAME_MATCHES = [
  'mega dragonite',
  "icecreamy's birthday cake",
  'minti plush',
  'icecreamy plush'
];

export const ADMIN_RESTRICTED_BLOOK_IDS = new Set([
  '6a8d1186f4b81699fe601446', // trophy: blook
  '6a8d1186f4b81699fe601447', // trophy: verified
  '6a8d1186f4b81699fe601448', // trophy: icecreametuber
  '6a8d1186f4b81699fe601449', // trophy: artist
  '6a975fa62887ab237770be04', // mega charizard
  '6a943a21521eb7fcc3838ead'  // pumpkin king
]);

const RESTRICTED_PACK_NAME_FRAGMENTS = ['summer pack', 'golden pack', 'hivelands', 'spooky'];

// Returns true if a blook cannot be granted via admin tools (gift, Admin Abuse).
// `packMap` is an optional map of pack_id → pack record.
export function isBlookAdminRestricted(blook, packMap = {}) {
  if (!blook) return true;
  if (ADMIN_RESTRICTED_BLOOK_IDS.has(blook.id)) return true;
  const name = (blook.name || '').toLowerCase().trim();
  if (ADMIN_RESTRICTED_BLOOK_NAME_MATCHES.some(m => name.includes(m))) return true;
  if (blook.pack_id && ADMIN_RESTRICTED_PACK_IDS.has(blook.pack_id)) return true;
  const pack = blook.pack_id ? packMap[blook.pack_id] : null;
  if (pack) {
    const packName = (pack.name || '').toLowerCase().trim();
    if (RESTRICTED_PACK_NAME_FRAGMENTS.some(frag => packName.includes(frag))) return true;
  }
  return false;
}