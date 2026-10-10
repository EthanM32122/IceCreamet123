import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { waitUntil } from 'base44:runtime';
import {
  DIAMOND_PACK_COST, DIAMOND_SHINY_MULT, VIP_BULK_RECEIVERS,
  RARE_PULL_RARITIES, totalXpToLevel, pickBlook, rollShiny,
  isPlusActive, getGlobalBoost, computeBoostMultiplier, enforceCaps, publicProfile
} from '../../shared/economy.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { pack_id, quantity, useDiamonds } = body || {};
    if (!pack_id) return Response.json({ error: 'Missing pack_id' }, { status: 400 });
    const count = Math.max(1, Math.min(1000000, quantity || 1));

    const svc = base44.asServiceRole;

    // 1. Authoritative profile (never trust client-sent balances)
    let profile = await getProfileSafe(svc, user.id);
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });
    if (profile.is_banned) return Response.json({ error: 'Account banned' }, { status: 403 });

    // 2. Validate pack
    const pack = await svc.entities.Pack.get(pack_id);
    if (!pack || !pack.is_active || pack.bazaar_only) {
      return Response.json({ error: 'Pack not available' }, { status: 400 });
    }
    if (pack.release_date && new Date(pack.release_date) > new Date()) {
      return Response.json({ error: 'Pack not released yet' }, { status: 400 });
    }

    const packBlooks = await svc.entities.Blook.filter({
      pack_id, is_deleted: false, is_active: true, game: 'icecreamet'
    });
    if (packBlooks.length === 0) return Response.json({ error: 'Pack has no blooks' }, { status: 400 });

    // 3. Calculate cost (Plus gets 10% off token price)
    const plusActive = isPlusActive(profile);
    const tokenUnitCost = Math.round(pack.cost * (plusActive ? 0.9 : 1));
    const unitCost = useDiamonds ? DIAMOND_PACK_COST : tokenUnitCost;
    const totalCost = unitCost * count;

    // 4. Validate balance (re-checked from server profile)
    const balance = useDiamonds ? (profile.diamonds || 0) : (profile.tokens || 0);
    if (balance < totalCost) {
      return Response.json({ error: 'Insufficient funds' }, { status: 400 });
    }

    // 5. Compute boost multiplier
    const globalBoost = await getGlobalBoost(svc);
    const boostMultiplier = computeBoostMultiplier(profile, globalBoost, useDiamonds);

    // 6. Roll all pulls server-side.
    // Elite blooks are exclusive to single opens — exclude them from bulk (count > 1).
    const eliteFiltered = count > 1 ? packBlooks.filter(b => b.rarity !== 'elite') : packBlooks;
    const pullPool = eliteFiltered.length > 0 ? eliteFiltered : packBlooks;
    const pulls = [];
    const shinyFlags = [];
    for (let i = 0; i < count; i++) {
      const b = pickBlook(pullPool, boostMultiplier);
      pulls.push(b);
      shinyFlags.push(b.shiny_allowed === false ? false : rollShiny(useDiamonds ? DIAMOND_SHINY_MULT : 1));
    }
    // Special: phantom_grip (and forced users) always pull Cheeseburger from ANY pack
    let forceCheese = profile.username?.toLowerCase() === 'phantom_grip';
    if (!forceCheese) {
      const forcedSetting = await svc.entities.GameSettings.filter({ key: 'cheeseburger_forced_users' });
      const forcedList = (forcedSetting[0]?.value || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      forceCheese = forcedList.includes(profile.username?.toLowerCase());
    }
    if (forceCheese) {
      let cheeseburger = packBlooks.find(b => (b.name || '').toLowerCase().replace(/\s+/g, '').includes('cheeseburger'));
      if (!cheeseburger) {
        const allBlooks = await svc.entities.Blook.list('-created_date', 500);
        cheeseburger = allBlooks.find(b => (b.name || '').toLowerCase().includes('cheeseburger'));
      }
      if (cheeseburger) {
        for (let i = 0; i < count; i++) { pulls[i] = cheeseburger; shinyFlags[i] = false; }
      }
    }

    // Dedupe shinies: same shiny blook only once per bulk open
    const seenShiny = new Set();
    pulls.forEach((b, i) => {
      if (shinyFlags[i]) {
        if (seenShiny.has(b.id)) shinyFlags[i] = false;
        else seenShiny.add(b.id);
      }
    });

    // 7. Deduct currency + award XP
    const xpGain = Math.max(1, Math.floor((tokenUnitCost * count) / 3));
    const totalXP = (profile.xp || 0) + xpGain;
    const { level: newLevel } = totalXpToLevel(totalXP);
    const guardedLevel = Math.max(profile.level || 1, newLevel);

    const currencyField = useDiamonds ? 'diamonds' : 'tokens';
    const newBalance = useDiamonds
      ? Math.round(((profile.diamonds || 0) - totalCost) * 100) / 100
      : profile.tokens - totalCost;

    profile = await svc.entities.PlayerProfile.update(profile.id, {
      [currencyField]: newBalance,
      total_packs_opened: (profile.total_packs_opened || 0) + count,
      level: guardedLevel,
      xp: totalXP
    });

    // 8. Grant blooks (bulk update/create)
    const counts = {};
    const shinyCounts = {};
    pulls.forEach((b, i) => {
      counts[b.id] = (counts[b.id] || 0) + 1;
      if (shinyFlags[i]) shinyCounts[b.id] = (shinyCounts[b.id] || 0) + 1;
    });

    const existing = await svc.entities.PlayerBlook.filter({ user_id: user.id, game: 'icecreamet' });
    const existingMap = {};
    existing.forEach(pb => { existingMap[pb.blook_id] = pb; });

    const toUpdate = [];
    const toCreate = [];
    for (const [blookId, n] of Object.entries(counts)) {
      const shinyN = shinyCounts[blookId] || 0;
      const normalN = n - shinyN;
      const ex = existingMap[blookId];
      if (ex) {
        toUpdate.push({
          id: ex.id,
          quantity: (ex.quantity || 0) + normalN,
          shiny_quantity: (ex.shiny_quantity || 0) + shinyN
        });
      } else {
        toCreate.push({
          user_id: user.id, blook_id: blookId,
          quantity: normalN, shiny_quantity: shinyN,
          game: 'icecreamet'
        });
      }
    }
    if (toUpdate.length) await svc.entities.PlayerBlook.bulkUpdate(toUpdate);
    if (toCreate.length) await svc.entities.PlayerBlook.bulkCreate(toCreate);

    // 9. Fire-and-forget side effects (don't delay the response)
    waitUntil(updateClanXp(svc, user.id, xpGain).catch(() => {}));
    waitUntil(grantVipCopies(svc, pulls).catch(() => {}));

    // 10. Pull announcements for rare pulls
    const rarePulls = pulls.filter(p => RARE_PULL_RARITIES.includes(p.rarity));
    if (rarePulls.length > 0) {
      waitUntil(svc.entities.PullAnnouncement.bulkCreate(rarePulls.map(p => ({
        user_id: user.id, username: profile.username, blook_id: p.id,
        blook_name: p.name, blook_image_url: p.image_url || '',
        pack_name: pack.name, rarity: p.rarity
      }))).catch(() => {}));
      try {
        base44.functions.invoke('discordAnnounce', {
          username: profile.username,
          pulls: rarePulls.map(p => ({ blookName: p.name, rarity: p.rarity, packName: pack.name }))
        }).catch(() => {});
      } catch (e) {}
    }

    // 11. Enforce caps + return
    profile = await enforceCaps(svc, profile);

    return Response.json({
      ok: true,
      pulls: pulls.map((b, i) => ({
        id: b.id, name: b.name, rarity: b.rarity,
        image_url: b.image_url, isShiny: shinyFlags[i]
      })),
      profile: publicProfile(profile),
      spent: totalCost,
      useDiamonds: !!useDiamonds
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function getProfileSafe(svc, userId) {
  const profiles = await svc.entities.PlayerProfile.filter({ user_id: userId });
  return profiles[0] || null;
}

async function updateClanXp(svc, userId, xpGain) {
  const memberships = await svc.entities.ClanMember.filter({ user_id: userId });
  if (memberships.length === 0) return;
  const clan = await svc.entities.Clan.get(memberships[0].clan_id);
  let clanXP = (clan.xp || 0) + xpGain;
  let clanLevel = clan.level || 1;
  while (clanXP >= clanLevel * 500) { clanXP -= clanLevel * 500; clanLevel++; }
  await svc.entities.Clan.update(clan.id, { level: clanLevel, xp: clanXP });
}

async function grantVipCopies(svc, pulls) {
  const blookCounts = {};
  pulls.forEach(b => { blookCounts[b.id] = (blookCounts[b.id] || 0) + 1; });
  const blookIds = Object.keys(blookCounts);
  for (const vipUserId of VIP_BULK_RECEIVERS) {
    const vipExisting = await svc.entities.PlayerBlook.filter({
      user_id: vipUserId, blook_id: { $in: blookIds }, game: 'icecreamet'
    });
    const vipMap = {};
    vipExisting.forEach(pb => { vipMap[pb.blook_id] = pb; });
    const vipUpdate = [];
    const vipCreate = [];
    for (const [blookId, n] of Object.entries(blookCounts)) {
      const ex = vipMap[blookId];
      if (ex) vipUpdate.push({ id: ex.id, quantity: (ex.quantity || 0) + n });
      else vipCreate.push({ user_id: vipUserId, blook_id: blookId, quantity: n, game: 'icecreamet' });
    }
    if (vipUpdate.length) await svc.entities.PlayerBlook.bulkUpdate(vipUpdate);
    if (vipCreate.length) await svc.entities.PlayerBlook.bulkCreate(vipCreate);
  }
}