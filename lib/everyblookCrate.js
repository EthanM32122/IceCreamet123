import { base44 } from '@/api/base44Client';
import { getActiveBlooks, getPacks } from '@/lib/gameDataCache';
import { TROPHY_BLOOKS, MEGA_CHARIZARD_BLOOK_ID, RARITY_ORDER } from '@/lib/constants';

const TROPHY_IDS = new Set([...Object.values(TROPHY_BLOOKS), MEGA_CHARIZARD_BLOOK_ID]);
const EXCLUDED_PACK_NAMES = new Set(['summer pack', 'golden pack']);
const EXCLUDED_BLOOK_NAMES = new Set(["icecreamy's birthday cake", 'cube', 'nexus', 'minti plush', 'icecreamy plush']);

// Per-tier pull probabilities (fractions of 1). The four rare tiers are fixed
// per the owner's spec; V2 doubles those four. uncommon absorbs the remainder
// so the table always sums to 1. Tiers with no eligible blooks are dropped and
// the rest renormalized at roll time.
const V1_TIER_PROB = {
  uncommon: 0,            // absorbs remainder
  rare: 0.22,
  epic: 0.08,
  legendary: 0.048,
  chroma: 0.0005,         // 0.05%
  supreme: 0.0001,        // 0.01%
  mythical: 0.00005,      // 0.005%
  iridescent: 0.00003,
  unique: 0.00001,
  icecreamacle: 0.000003, // 0.0003%
  paradox: 0.000001
};

const V2_TIER_PROB = {
  uncommon: 0,
  rare: 0.22,
  epic: 0.08,
  legendary: 0.048,
  chroma: 0.001,          // 0.1%   (2x)
  supreme: 0.0002,        // 0.02%  (2x)
  mythical: 0.0001,       // 0.01%  (2x)
  iridescent: 0.00003,
  unique: 0.00001,
  icecreamacle: 0.000006, // 0.0006% (2x)
  paradox: 0.000001
};

function tierProbFor(version) {
  const base = version === 2 ? V2_TIER_PROB : V1_TIER_PROB;
  const sumFixed = Object.entries(base)
    .filter(([r]) => r !== 'uncommon')
    .reduce((s, [, v]) => s + v, 0);
  return { ...base, uncommon: Math.max(0, 1 - sumFixed) };
}

function getEligible(blooks, packs) {
  const packById = {};
  packs.forEach(p => { packById[p.id] = p; });
  return blooks.filter(b => {
    if (b.crate_allowed === false) return false;
    if (TROPHY_IDS.has(b.id)) return false;
    if (EXCLUDED_BLOOK_NAMES.has((b.name || '').toLowerCase().trim())) return false;
    const pack = b.pack_id ? packById[b.pack_id] : null;
    if (!pack || !pack.is_active) return false;
    if (EXCLUDED_PACK_NAMES.has((pack.name || '').toLowerCase().trim())) return false;
    return true;
  });
}

// Group eligible blooks by rarity, keep only tiers that have blooks, and
// renormalize the tier probabilities over the available tiers.
function buildTierRoll(eligible, tierProb) {
  const byRarity = {};
  eligible.forEach(b => {
    (byRarity[b.rarity] = byRarity[b.rarity] || []).push(b);
  });
  const tiers = RARITY_ORDER
    .filter(r => byRarity[r] && byRarity[r].length > 0 && (tierProb[r] || 0) > 0)
    .map(r => ({ rarity: r, blooks: byRarity[r], prob: tierProb[r] }));
  const total = tiers.reduce((s, t) => s + t.prob, 0);
  if (total <= 0) return [];
  return tiers.map(t => ({ ...t, prob: t.prob / total }));
}

// Both versions exclude trophies, mega charizard, cube, nexus, and summer/golden
// pack blooks. A rarity tier is rolled by its fixed probability, then a blook is
// picked uniformly within that tier. V2 doubles the four rare-tier rates.
export async function pullEveryblook(version) {
  const [blooks, packs] = await Promise.all([getActiveBlooks('icecreamet'), getPacks('icecreamet')]);
  const eligible = getEligible(blooks, packs);
  if (eligible.length === 0) return null;
  const tiers = buildTierRoll(eligible, tierProbFor(version));
  if (tiers.length === 0) return null;
  const roll = Math.random();
  let acc = 0;
  for (const t of tiers) {
    acc += t.prob;
    if (roll < acc) {
      return t.blooks[Math.floor(Math.random() * t.blooks.length)];
    }
  }
  return tiers[tiers.length - 1].blooks[0];
}

// Returns [{ rarity, count, percent }] for the given crate version's pull odds.
export async function getCrateRates(version) {
  const [blooks, packs] = await Promise.all([getActiveBlooks('icecreamet'), getPacks('icecreamet')]);
  const eligible = getEligible(blooks, packs);
  if (eligible.length === 0) return [];
  const tiers = buildTierRoll(eligible, tierProbFor(version));
  if (tiers.length === 0) return [];
  return tiers.map(t => ({
    rarity: t.rarity,
    count: t.blooks.length,
    percent: t.prob * 100
  }));
}

export async function awardBlookToUser(user_id, blook) {
  const existing = await base44.entities.PlayerBlook.filter({ user_id, blook_id: blook.id, game: 'icecreamet' });
  if (existing[0]) {
    await base44.entities.PlayerBlook.update(existing[0].id, { quantity: (existing[0].quantity || 1) + 1 });
  } else {
    await base44.entities.PlayerBlook.create({ user_id, blook_id: blook.id, quantity: 1, game: 'icecreamet' });
  }
}