import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  RARITY_ORDER, TROPHY_BLOOKS, MEGA_CHARIZARD_BLOOK_ID,
  enforceCaps, publicProfile
} from '../../shared/economy.ts';

const CRAFT_COST = 50;
const MIN_ING = 2;
const MAX_ING = 5;

const CHROMA_PLUS_WEIGHT = {
  chroma: 0.0001, supreme: 0.00005, mythical: 0.00002,
  iridescent: 0.00001, unique: 0.000005,
  icecreamacle: 0.000002, paradox: 0.000001
};

const TROPHY_IDS = new Set([...Object.values(TROPHY_BLOOKS), MEGA_CHARIZARD_BLOOK_ID]);

const rarityIndex = (r) => { const i = RARITY_ORDER.indexOf(r); return i < 0 ? 0 : i; };

const isExcludedResultPack = (pack) => {
  const n = (pack?.name || '').toLowerCase();
  return n.includes('golden') || n.includes('summer');
};

const isExcludedBlookName = (blook) => {
  const n = (blook?.name || '').toLowerCase();
  return n.includes('summer') || n.includes('golden') || n.includes('plush');
};

const resultCapFor = (maxIdx) => {
  if (maxIdx <= 0) return 2;
  if (maxIdx === 1) return 3;
  if (maxIdx === 2) return 4;
  if (maxIdx === 3) return 5;
  if (maxIdx === 4) return 6;
  return 9;
};

// Crafting: combine 2-5 blooks into 1 of 5 possible results.
// The server validates ownership, calculates possible results, rolls the
// outcome, consumes ingredients, and grants the result — all server-side.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { ingredients } = body;
    if (!Array.isArray(ingredients) || ingredients.length < MIN_ING || ingredients.length > MAX_ING) {
      return Response.json({ error: `Need ${MIN_ING}-${MAX_ING} ingredients` }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    let profile = await getProfileSafe(svc, user.id);
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });
    if (profile.is_banned) return Response.json({ error: 'Account banned' }, { status: 403 });
    if ((profile.tokens || 0) < CRAFT_COST) return Response.json({ error: 'Insufficient funds' }, { status: 400 });

    // 1. Validate ingredient ownership
    const myBlooks = await svc.entities.PlayerBlook.filter({ user_id: user.id, game: 'icecreamet' });
    const myMap = {};
    myBlooks.forEach(pb => { myMap[pb.blook_id] = pb; });

    const ingredientIds = ingredients.map(i => i.blook_id);
    const ingredientCounts = {};
    ingredientIds.forEach(id => { ingredientCounts[id] = (ingredientCounts[id] || 0) + 1; });

    for (const [blookId, needed] of Object.entries(ingredientCounts)) {
      const pb = myMap[blookId];
      if (!pb || (pb.quantity || 0) < needed) {
        return Response.json({ error: 'You do not own all ingredients' }, { status: 400 });
      }
    }

    // 2. Get blook + pack data for result calculation
    const [allBlooks, packs] = await Promise.all([
      svc.entities.Blook.filter({ is_active: true, is_deleted: false, game: 'icecreamet' }, null, 2000),
      svc.entities.Pack.filter({ game: 'icecreamet' })
    ]);
    const packMap = {};
    packs.forEach(p => { packMap[p.id] = p; });
    const blookMap = {};
    allBlooks.forEach(b => { blookMap[b.id] = b; });

    // 3. Calculate ingredient rarities
    const ingredientBlooks = ingredientIds.map(id => blookMap[id]).filter(Boolean);
    if (ingredientBlooks.length !== ingredientIds.length) {
      return Response.json({ error: 'Invalid ingredients' }, { status: 400 });
    }

    const avgIdx = ingredientBlooks.reduce((s, b) => s + rarityIndex(b.rarity), 0) / ingredientBlooks.length;
    const floor = Math.floor(avgIdx);
    const cap = resultCapFor(floor);

    // 4. Calculate eligible results
    const ingredientSet = new Set(ingredientIds);
    const eligibleResults = allBlooks.filter(b => {
      if (b.craftable === false) return false;
      if (TROPHY_IDS.has(b.id)) return false;
      if (ingredientSet.has(b.id)) return false;
      if (b.pack_id && isExcludedResultPack(packMap[b.pack_id])) return false;
      if (isExcludedBlookName(b)) return false;
      if ((b.name || '').toLowerCase().includes('gojo')) return false;
      if (/icecreamy'?s birthday cake/i.test(b.name || '')) return false;
      const idx = rarityIndex(b.rarity);
      if (idx < floor) return false;
      if (idx > cap) return false;
      return true;
    });

    if (eligibleResults.length === 0) return Response.json({ error: 'No valid results for this combination' }, { status: 400 });

    // 5. Calculate weights + select 5 possible results
    const luckActive = !!(profile.luck_booster_until && new Date(profile.luck_booster_until) > new Date());
    let factor = 0.35 + avgIdx * 0.06;
    if (luckActive) factor *= 1.25;
    factor = Math.min(0.95, factor);

    const weighted = eligibleResults.map(b => {
      const idx = rarityIndex(b.rarity);
      const weight = idx < 4 ? Math.pow(factor, idx) : (CHROMA_PLUS_WEIGHT[b.rarity] || 0.000001);
      return { blook: b, weight };
    });

    // Select 5 unique results (weighted, without replacement)
    const chosen = [];
    const pool = [...weighted];
    while (chosen.length < 5 && pool.length > 0) {
      const total = pool.reduce((s, w) => s + w.weight, 0);
      let r = Math.random() * total;
      let idx = 0;
      for (let i = 0; i < pool.length; i++) { r -= pool[i].weight; if (r <= 0) { idx = i; break; } }
      chosen.push(pool[idx]);
      pool.splice(idx, 1);
    }
    const totalW = chosen.reduce((s, c) => s + c.weight, 0);
    const possible = chosen.map(c => ({ blook: c.blook, chance: c.weight / totalW }));

    // 6. Roll the result
    const rollTotal = possible.reduce((s, p) => s + p.chance, 0);
    let rollR = Math.random() * rollTotal;
    let won = possible[possible.length - 1];
    for (const p of possible) { rollR -= p.chance; if (rollR <= 0) { won = p; break; } }

    // 7. Deduct tokens
    profile = await svc.entities.PlayerProfile.update(profile.id, {
      tokens: profile.tokens - CRAFT_COST
    });

    // 8. Consume ingredients
    for (const [blookId, needed] of Object.entries(ingredientCounts)) {
      const pb = myMap[blookId];
      const rem = (pb.quantity || 0) - needed;
      if (rem <= 0 && (pb.shiny_quantity || 0) <= 0) await svc.entities.PlayerBlook.delete(pb.id);
      else await svc.entities.PlayerBlook.update(pb.id, { quantity: Math.max(0, rem) });
    }

    // 9. Grant result blook
    const existing = await svc.entities.PlayerBlook.filter({ user_id: user.id, blook_id: won.blook.id, game: 'icecreamet' });
    if (existing[0]) {
      await svc.entities.PlayerBlook.update(existing[0].id, { quantity: (existing[0].quantity || 0) + 1 });
    } else {
      await svc.entities.PlayerBlook.create({
        user_id: user.id, blook_id: won.blook.id, quantity: 1, game: 'icecreamet'
      });
    }

    profile = await enforceCaps(svc, profile);

    return Response.json({
      ok: true,
      result: { id: won.blook.id, name: won.blook.name, rarity: won.blook.rarity, image_url: won.blook.image_url },
      possible: possible.map(p => ({
        id: p.blook.id, name: p.blook.name, rarity: p.blook.rarity, image_url: p.blook.image_url,
        chance: p.chance
      })),
      profile: publicProfile(profile)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function getProfileSafe(svc, userId) {
  const profiles = await svc.entities.PlayerProfile.filter({ user_id: userId });
  return profiles[0] || null;
}