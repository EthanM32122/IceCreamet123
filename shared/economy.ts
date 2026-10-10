// Server-side economy logic — shared by all economy backend functions.
// These constants and helpers live here (not in the client) so players
// can never tamper with drop rates, sell prices, or currency caps.

export const RARITY_DROP_RATES = {
  uncommon: 19.5, rare: 10, epic: 2.5, legendary: 0.7,
  chroma: 0.04, supreme: 0.02, mythical: 0.005,
  iridescent: 0.001, unique: 0.0008, icecreamacle: 0.0025, paradox: 0.005,
  elite: 0.005
};

export const SELL_PRICES = {
  uncommon: 5, rare: 20, epic: 75, legendary: 200,
  chroma: 300, supreme: 350, mythical: 750,
  iridescent: 5000, unique: 400, icecreamacle: 10000, paradox: 25000, elite: 100000
};

export const SHINY_CHANCE = 0.05;
export const DIAMOND_SHINY_MULT = 1.9;
export const DIAMOND_PACK_COST = 15;
export const DIAMOND_PACK_LUCK = 2;

export const SHINY_DIAMOND_VALUES = {
  uncommon: 0.5, rare: 0.7, epic: 0.9, legendary: 2,
  chroma: 5, mythical: 10, iridescent: 50, unique: 40, icecreamacle: 25, elite: 100
};

export const TOKEN_CAP = 75000000;
export const DIAMOND_CAP = 25000000;

export const VIP_BULK_RECEIVERS = [
  '6a99b529fd54567710eb02d5',
  '6a96d0c802fe3d941536ffe2'
];

// Store costs
export const PLUS_COST = 500000;
export const CRATE_V1_COST = 100000;
export const CRATE_V2_COST = 250000;
export const PLUS_BADGE_ID = '6a8a50a35d48898fb1742efa';
export const GRENADE_COST = 5000;
export const SHIELD_COST = 3000;
export const DAILY_PLUS_CLAIM = 500;

// Hourly spin prizes + cooldown
export const SPIN_PRIZES = [2500, 3000, 4000, 5000, 6000, 7000, 8000, 10000];
export const SPIN_COOLDOWN_MS = 3600000;

// Plush collectibles
export const PLUSH_EXPIRY = new Date('2026-10-12T23:59:59Z');
export const PLUSHES = [
  { name: 'Kool Kat Plush', price: 4000000 },
  { name: 'Creepy TV Bot Plush', price: 4000000 }
];
export const COLLECTOR_TIERS = [
  { count: 1, badge: 'Collector' },
  { count: 2, badge: 'Golden Collector' },
  { count: 3, badge: 'Diamond Collector' },
  { count: 4, badge: 'Rainbow Collector' },
  { count: 5, badge: 'Void Collector' }
];

// Crate exclusions
export const TROPHY_BLOOKS = {
  blook: '6a8d1186f4b81699fe601446',
  verified: '6a8d1186f4b81699fe601447',
  icecreametuber: '6a8d1186f4b81699fe601448',
  artist: '6a8d1186f4b81699fe601449'
};
export const MEGA_CHARIZARD_BLOOK_ID = '6a975fa62887ab237770be04';
export const RARITY_ORDER = ['uncommon', 'rare', 'epic', 'legendary', 'chroma', 'supreme', 'mythical', 'iridescent', 'unique', 'icecreamacle', 'paradox', 'elite'];

const CRATE_TROPHY_IDS = new Set([...Object.values(TROPHY_BLOOKS), MEGA_CHARIZARD_BLOOK_ID]);
const CRATE_EXCLUDED_PACK_NAMES = new Set(['summer pack', 'golden pack']);
const CRATE_EXCLUDED_BLOOK_NAMES = new Set(["icecreamy's birthday cake", 'cube', 'nexus', 'minti plush', 'icecreamy plush']);

// ── Admin restriction: blooks/packs that admins cannot gift or drop via Admin Abuse ──
// These are exclusive rewards that should only be earned through their intended systems.
export const SPOOKY_PACK_ID = '6abdc8898281b760c964c249';
export const HIVELANDS_PACK_ID = '6ac16ad4076befcf48d45858';
export const SUMMER_PACK_ID = '6a9c854b923f12c122f1f58a';
export const GOLDEN_PACK_ID = '6a9c8543d9146d362a45bc92';
// PAC3 pack was deleted, so its blooks are matched by name.
export const ADMIN_RESTRICTED_PACK_IDS = new Set([
  SPOOKY_PACK_ID,
  HIVELANDS_PACK_ID,
  SUMMER_PACK_ID,
  GOLDEN_PACK_ID
]);
// Blook-name substrings that are admin-restricted (case-insensitive).
export const ADMIN_RESTRICTED_BLOOK_NAME_MATCHES = [
  'mega dragonite',     // PAC3 event blooks (pack deleted)
  "icecreamy's birthday cake",
  'minti plush',
  'icecreamy plush'
];
// Blook IDs that are individually admin-restricted (trophies, mega charizard, pumpkin king).
export const ADMIN_RESTRICTED_BLOOK_IDS = new Set([
  ...Object.values(TROPHY_BLOOKS),
  MEGA_CHARIZARD_BLOOK_ID,
  '6a943a21521eb7fcc3838ead' // Pumpkin King (Spooky seed reward)
]);

// Returns true if a blook cannot be granted via admin tools (gift, Admin Abuse random/targeted).
// `packById` is an optional map of pack_id → pack record; if absent, restricted pack_ids are
// still matched against ADMIN_RESTRICTED_PACK_IDS by id alone.
export function isBlookAdminRestricted(blook, packById = {}) {
  if (!blook) return true;
  if (ADMIN_RESTRICTED_BLOOK_IDS.has(blook.id)) return true;
  const name = (blook.name || '').toLowerCase().trim();
  if (ADMIN_RESTRICTED_BLOOK_NAME_MATCHES.some(m => name.includes(m))) return true;
  if (blook.pack_id && ADMIN_RESTRICTED_PACK_IDS.has(blook.pack_id)) return true;
  // If the pack record is available, also match by pack name (covers renamed packs).
  const pack = blook.pack_id ? packById[blook.pack_id] : null;
  if (pack && CRATE_EXCLUDED_PACK_NAMES.has((pack.name || '').toLowerCase().trim())) return true;
  if (pack && (pack.name || '').toLowerCase().includes('hivelands')) return true;
  if (pack && (pack.name || '').toLowerCase().includes('spooky')) return true;
  return false;
}

// Build a pack-id → pack lookup map for restriction checks.
export function buildPackMap(packs) {
  const m = {};
  (packs || []).forEach(p => { if (p && p.id) m[p.id] = p; });
  return m;
}

const V1_TIER_PROB = {
  uncommon: 0, rare: 0.22, epic: 0.08, legendary: 0.048,
  chroma: 0.0005, supreme: 0.0001, mythical: 0.00005,
  iridescent: 0.00003, unique: 0.00001, icecreamacle: 0.000003, paradox: 0.000001
};
const V2_TIER_PROB = {
  uncommon: 0, rare: 0.22, epic: 0.08, legendary: 0.048,
  chroma: 0.001, supreme: 0.0002, mythical: 0.0001,
  iridescent: 0.00003, unique: 0.00001, icecreamacle: 0.000006, paradox: 0.000001
};

function crateTierProb(version) {
  const base = version === 2 ? V2_TIER_PROB : V1_TIER_PROB;
  const sumFixed = Object.entries(base)
    .filter(([r]) => r !== 'uncommon')
    .reduce((s, [, v]) => s + v, 0);
  return { ...base, uncommon: Math.max(0, 1 - sumFixed) };
}

// Pull a random blook from the "Anything Crate" pool (server-side).
// Excludes trophies, mega charizard, cube, nexus, plushes, and summer/golden pack blooks.
export async function pullCrateBlook(svc, version) {
  const [blooks, packs] = await Promise.all([
    svc.entities.Blook.filter({ is_deleted: false, is_active: true, game: 'icecreamet' }),
    svc.entities.Pack.filter({ game: 'icecreamet' })
  ]);
  const packById = {};
  packs.forEach(p => { packById[p.id] = p; });
  const eligible = blooks.filter(b => {
    if (CRATE_TROPHY_IDS.has(b.id)) return false;
    if (b.crate_allowed === false) return false;
    if (CRATE_EXCLUDED_BLOOK_NAMES.has((b.name || '').toLowerCase().trim())) return false;
    const pack = b.pack_id ? packById[b.pack_id] : null;
    if (!pack || !pack.is_active) return false;
    if (CRATE_EXCLUDED_PACK_NAMES.has((pack.name || '').toLowerCase().trim())) return false;
    return true;
  });
  if (eligible.length === 0) return null;

  const tierProb = crateTierProb(version);
  const byRarity = {};
  eligible.forEach(b => { (byRarity[b.rarity] = byRarity[b.rarity] || []).push(b); });
  const tiers = RARITY_ORDER
    .filter(r => byRarity[r] && byRarity[r].length > 0 && (tierProb[r] || 0) > 0)
    .map(r => ({ rarity: r, blooks: byRarity[r], prob: tierProb[r] }));
  const total = tiers.reduce((s, t) => s + t.prob, 0);
  if (total <= 0) return null;
  const normalized = tiers.map(t => ({ ...t, prob: t.prob / total }));

  const roll = Math.random();
  let acc = 0;
  for (const t of normalized) {
    acc += t.prob;
    if (roll < acc) return t.blooks[Math.floor(Math.random() * t.blooks.length)];
  }
  return normalized[normalized.length - 1].blooks[0];
}

export const RARE_PULL_RARITIES = ['mythical', 'iridescent', 'unique', 'icecreamacle', 'paradox', 'elite'];

// Get the authoritative player profile from the server (service role).
// Never trust a client-sent profile — always re-read from the DB.
export async function getProfile(svc, userId) {
  const profiles = await svc.entities.PlayerProfile.filter({ user_id: userId });
  return profiles[0] || null;
}

// Cumulative XP system (ported from src/lib/leveling.js).
// `xp` is lifetime total, never resets. Each level L requires L*200 XP.
export function totalXpToLevel(total) {
  let level = 1;
  let acc = 0;
  while (total >= acc + level * 200) {
    acc += level * 200;
    level++;
  }
  return { level, progress: total - acc, needed: level * 200 };
}

// Weighted random blook selection (ported from Home.jsx pickBlook).
export function pickBlook(packBlooks, boostMultiplier) {
  const weights = packBlooks.map(b => {
    let chance = RARITY_DROP_RATES[b.rarity] || (b.drop_chance || 1);
    if (boostMultiplier > 1 && ['mythical', 'iridescent', 'unique', 'icecreamacle'].includes(b.rarity)) {
      chance *= boostMultiplier;
    }
    return chance;
  });
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  let rand = Math.random() * totalWeight;
  let selected = packBlooks[0];
  for (let i = 0; i < packBlooks.length; i++) {
    rand -= weights[i];
    if (rand <= 0) { selected = packBlooks[i]; break; }
  }
  return selected;
}

// Roll shiny (ported from src/lib/shiny.js).
export function rollShiny(shinyMult) {
  return Math.random() < (SHINY_CHANCE * shinyMult);
}

// Check if Plus subscription is active.
export function isPlusActive(profile) {
  return !!profile.plus_permanent || (profile.plus_until && new Date(profile.plus_until) > new Date());
}

// Read the global pack boost from GameSettings (ported from src/lib/packBoost.js).
// Returns { multiplier, end_time, count } or null.
export async function getGlobalBoost(svc) {
  try {
    const settings = await svc.entities.GameSettings.filter({ key: 'pack_boost' });
    if (!settings.length) return null;
    const boosts = JSON.parse(settings[0].value);
    const now = new Date();
    const active = Array.isArray(boosts) ? boosts.filter(b => b.end_time && new Date(b.end_time) > now) : [];
    if (active.length === 0) return null;
    const multiplier = 2 * active.length;
    const earliestEnd = active.map(b => new Date(b.end_time)).sort((a, b) => a - b)[0];
    return { multiplier, end_time: earliestEnd.toISOString(), count: active.length };
  } catch (e) {
    return null;
  }
}

// Compute the total boost multiplier for a player opening a pack.
export function computeBoostMultiplier(profile, globalBoost, useDiamonds) {
  let personalMult = (profile.luck_booster_until && new Date(profile.luck_booster_until) > new Date()) ? 2 : 0;
  let globalMult = (globalBoost && globalBoost.end_time && new Date(globalBoost.end_time) > new Date()) ? (globalBoost.multiplier || 2) : 0;
  let diamondMult = useDiamonds ? DIAMOND_PACK_LUCK : 0;
  let sum = personalMult + globalMult + diamondMult;
  return sum > 0 ? sum : 1;
}

// Enforce currency caps (anti-cheat). Bans the account if over cap.
export async function enforceCaps(svc, profile) {
  if ((profile.tokens || 0) > TOKEN_CAP || (profile.diamonds || 0) > DIAMOND_CAP) {
    return svc.entities.PlayerProfile.update(profile.id, {
      tokens: 0, diamonds: 0, is_banned: true,
      ban_reason: 'Currency cap exceeded', banned_by: 'Anti-Cheat'
    });
  }
  return profile;
}

// Strip the profile down to the fields the client needs after an economy op.
export function publicProfile(profile) {
  return {
    id: profile.id,
    tokens: profile.tokens,
    diamonds: profile.diamonds,
    level: profile.level,
    xp: profile.xp,
    total_packs_opened: profile.total_packs_opened,
    username: profile.username,
    plus_permanent: profile.plus_permanent,
    plus_until: profile.plus_until,
    luck_booster_until: profile.luck_booster_until
  };
}