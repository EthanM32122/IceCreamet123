import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  SELL_PRICES, SHINY_DIAMOND_VALUES, enforceCaps, publicProfile
} from '../../shared/economy.ts';

// Sells one or more copies of a blook to the shop.
// Normal blooks sell for tokens (SELL_PRICES), shiny blooks sell for diamonds
// (SHINY_DIAMOND_VALUES). The server validates ownership and applies the
// reward — the client cannot fabricate currency or sell blooks it doesn't own.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { blook_id, isShiny, quantity } = body || {};
    if (!blook_id) return Response.json({ error: 'Missing blook_id' }, { status: 400 });
    const qty = Math.max(1, Math.min(100000, quantity || 1));

    const svc = base44.asServiceRole;

    // 1. Authoritative profile
    let profile = await getProfileSafe(svc, user.id);
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });
    if (profile.is_banned) return Response.json({ error: 'Account banned' }, { status: 403 });

    // 2. Validate ownership
    const records = await svc.entities.PlayerBlook.filter({
      user_id: user.id, blook_id, game: 'icecreamet'
    });
    if (records.length === 0) {
      return Response.json({ error: 'You do not own this blook' }, { status: 400 });
    }
    const rec = records[0];
    const available = isShiny ? (rec.shiny_quantity || 0) : (rec.quantity || 0);
    if (available < qty) {
      return Response.json({ error: 'Insufficient quantity' }, { status: 400 });
    }

    // 3. Get blook for rarity-based pricing
    const blook = await svc.entities.Blook.get(blook_id);
    if (!blook) return Response.json({ error: 'Blook not found' }, { status: 404 });

    // 4. Calculate reward
    let rewardType, rewardAmount;
    if (isShiny) {
      rewardType = 'diamonds';
      rewardAmount = Math.round((SHINY_DIAMOND_VALUES[blook.rarity] || 0) * qty * 100) / 100;
    } else {
      rewardType = 'tokens';
      const perUnit = blook.sell_price || SELL_PRICES[blook.rarity] || 5;
      rewardAmount = perUnit * qty;
    }

    // 5. Add currency to profile
    const newBalance = rewardType === 'diamonds'
      ? Math.round(((profile.diamonds || 0) + rewardAmount) * 100) / 100
      : (profile.tokens || 0) + rewardAmount;

    profile = await svc.entities.PlayerProfile.update(profile.id, {
      [rewardType]: newBalance
    });

    // 6. Decrement / remove the blook
    const newQty = isShiny ? rec.shiny_quantity - qty : rec.quantity - qty;
    const otherQty = isShiny ? (rec.quantity || 0) : (rec.shiny_quantity || 0);
    if (newQty <= 0 && otherQty <= 0) {
      await svc.entities.PlayerBlook.delete(rec.id);
    } else {
      const patch = isShiny
        ? { shiny_quantity: Math.max(0, newQty) }
        : { quantity: Math.max(0, newQty) };
      await svc.entities.PlayerBlook.update(rec.id, patch);
    }

    // 7. Enforce caps + return
    profile = await enforceCaps(svc, profile);

    return Response.json({
      ok: true,
      reward: { type: rewardType, amount: rewardAmount },
      profile: publicProfile(profile),
      soldBlook: { id: blook_id, name: blook.name, rarity: blook.rarity, isShiny, quantity: qty }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function getProfileSafe(svc, userId) {
  const profiles = await svc.entities.PlayerProfile.filter({ user_id: userId });
  return profiles[0] || null;
}