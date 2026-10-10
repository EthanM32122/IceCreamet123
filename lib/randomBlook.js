import { base44 } from '@/api/base44Client';
import { RARITY_DROP_RATES } from '@/lib/constants';
import { rollShiny } from '@/lib/shiny';

// Cached pool of every blook available from active, non-bazaar, non-locked market packs.
let _poolCache = { pool: null, ts: 0 };
const POOL_TTL = 120000;

export async function getMarketBlookPool() {
  const now = Date.now();
  if (_poolCache.pool && now - _poolCache.ts < POOL_TTL) return _poolCache.pool;
  const [packList, blookList] = await Promise.all([
    base44.entities.Pack.filter({ is_active: true, game: 'icecreamet' }, 'order'),
    base44.entities.Blook.filter({ is_deleted: false, is_active: true, game: 'icecreamet' })
  ]);
  const nowDate = new Date();
  const activePackIds = new Set(
    packList
      .filter(p => (!p.release_date || new Date(p.release_date) <= nowDate) && !p.bazaar_only && !p.locked)
      .map(p => p.id)
  );
  const pool = blookList.filter(b => b.pack_id && activePackIds.has(b.pack_id) && !b.locked);
  _poolCache = { pool, ts: Date.now() };
  return pool;
}

// Weighted random pick using the same rarity drop rates as pack opening.
export function pickRandomMarketBlook(pool) {
  const weights = pool.map(b => RARITY_DROP_RATES[b.rarity] || (b.drop_chance || 1));
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  let rand = Math.random() * totalWeight;
  for (let i = 0; i < pool.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return pool[i];
  }
  return pool[0];
}

// Picks a random market blook, rolls shiny with the same chance, and grants it to the player.
export async function grantRandomBlook(profile) {
  const pool = await getMarketBlookPool();
  if (pool.length === 0) return null;
  const blook = pickRandomMarketBlook(pool);
  const shiny = rollShiny(null, blook);
  const existing = await base44.entities.PlayerBlook.filter({ user_id: profile.user_id, blook_id: blook.id, game: 'icecreamet' });
  if (existing.length > 0) {
    const update = shiny
      ? { shiny_quantity: (existing[0].shiny_quantity || 0) + 1 }
      : { quantity: (existing[0].quantity || 1) + 1 };
    await base44.entities.PlayerBlook.update(existing[0].id, update);
  } else {
    await base44.entities.PlayerBlook.create({ user_id: profile.user_id, blook_id: blook.id, quantity: shiny ? 0 : 1, shiny_quantity: shiny ? 1 : 0, game: 'icecreamet' });
  }
  return { blook, shiny };
}