import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { waitUntil } from 'base44:runtime';
import {
  PLUS_COST, CRATE_V1_COST, CRATE_V2_COST, PLUS_BADGE_ID,
  GRENADE_COST, SHIELD_COST, DAILY_PLUS_CLAIM, SELL_PRICES,
  PLUSHES, PLUSH_EXPIRY, COLLECTOR_TIERS,
  isPlusActive, enforceCaps, publicProfile, pullCrateBlook
} from '../../shared/economy.ts';

// Handles all store purchases: Plus subscription, crates, plush, daily claim,
// war items, event blooks, and banners. The server validates every cost and
// availability check — the client cannot grant itself items or currency.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { item_type, plush_name, blook_id, banner_id } = body || {};
    if (!item_type) return Response.json({ error: 'Missing item_type' }, { status: 400 });

    const svc = base44.asServiceRole;
    let profile = await getProfileSafe(svc, user.id);
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });
    if (profile.is_banned) return Response.json({ error: 'Account banned' }, { status: 403 });

    switch (item_type) {
      case 'plus': {
        if (isPlusActive(profile)) return Response.json({ error: 'Already Plus' }, { status: 400 });
        if ((profile.tokens || 0) < PLUS_COST) return Response.json({ error: 'Insufficient funds' }, { status: 400 });
        profile = await svc.entities.PlayerProfile.update(profile.id, {
          tokens: profile.tokens - PLUS_COST,
          plus_permanent: true
        });
        const existing = await svc.entities.PlayerBadge.filter({ user_id: user.id, badge_id: PLUS_BADGE_ID });
        if (existing.length === 0) {
          await svc.entities.PlayerBadge.create({ user_id: user.id, badge_id: PLUS_BADGE_ID });
        }
        break;
      }

      case 'crate': {
        const version = body.version || 1;
        const cost = version === 2 ? CRATE_V2_COST : CRATE_V1_COST;
        if ((profile.tokens || 0) < cost) return Response.json({ error: 'Insufficient funds' }, { status: 400 });
        const pulled = await pullCrateBlook(svc, version);
        if (!pulled) return Response.json({ error: 'No eligible blooks available' }, { status: 400 });
        profile = await svc.entities.PlayerProfile.update(profile.id, {
          tokens: profile.tokens - cost,
          total_packs_opened: (profile.total_packs_opened || 0) + 1
        });
        await grantBlookSafe(svc, user.id, pulled.id, 1, 0);
        profile = await enforceCaps(svc, profile);
        return Response.json({
          ok: true, item_type: 'crate',
          pulledBlook: { id: pulled.id, name: pulled.name, rarity: pulled.rarity, image_url: pulled.image_url },
          profile: publicProfile(profile)
        });
      }

      case 'plush': {
        if (new Date() > PLUSH_EXPIRY) return Response.json({ error: 'Plushies no longer available' }, { status: 400 });
        const plush = PLUSHES.find(p => p.name === plush_name);
        if (!plush) return Response.json({ error: 'Invalid plush' }, { status: 400 });
        if ((profile.tokens || 0) < plush.price) return Response.json({ error: 'Insufficient funds' }, { status: 400 });
        const blooks = await svc.entities.Blook.filter({ name: plush_name, game: 'icecreamet' });
        if (blooks.length === 0) return Response.json({ error: 'Plush blook not found' }, { status: 404 });
        const blook = blooks[0];
        profile = await svc.entities.PlayerProfile.update(profile.id, {
          tokens: profile.tokens - plush.price
        });
        await grantBlookSafe(svc, user.id, blook.id, 1, 0);

        // Escalate collector badge
        const plushIds = (await svc.entities.Blook.filter({ name: { $in: PLUSHES.map(p => p.name) }, game: 'icecreamet' })).map(b => b.id);
        const playerBlooks = await svc.entities.PlayerBlook.filter({ user_id: user.id, blook_id: { $in: plushIds } });
        const plushCount = playerBlooks.reduce((s, pb) => s + (pb.quantity || 0) + (pb.shiny_quantity || 0), 0);
        const tier = COLLECTOR_TIERS.filter(t => plushCount >= t.count).pop();
        if (tier) {
          const allBadges = await svc.entities.Badge.filter({}, null, 200);
          const tierBadge = allBadges.find(b => b.name === tier.badge);
          if (tierBadge) {
            const collectorBadgeNames = COLLECTOR_TIERS.map(t => t.badge);
            const collectorBadgeIds = allBadges.filter(b => collectorBadgeNames.includes(b.name)).map(b => b.id);
            const existingBadges = await svc.entities.PlayerBadge.filter({ user_id: user.id });
            const oldBadges = existingBadges.filter(pb => collectorBadgeIds.includes(pb.badge_id));
            for (const pb of oldBadges) {
              await svc.entities.PlayerBadge.delete(pb.id);
            }
            await svc.entities.PlayerBadge.create({ user_id: user.id, badge_id: tierBadge.id });
          }
        }
        break;
      }

      case 'daily_claim': {
        if (!isPlusActive(profile)) return Response.json({ error: 'Plus only' }, { status: 403 });
        const today = new Date().toDateString();
        const lastClaim = profile.last_plus_claim ? new Date(profile.last_plus_claim).toDateString() : '';
        if (today === lastClaim) return Response.json({ error: 'Already claimed today' }, { status: 400 });
        profile = await svc.entities.PlayerProfile.update(profile.id, {
          tokens: (profile.tokens || 0) + DAILY_PLUS_CLAIM,
          last_plus_claim: new Date().toISOString()
        });
        break;
      }

      case 'grenade': {
        if ((profile.tokens || 0) < GRENADE_COST) return Response.json({ error: 'Insufficient funds' }, { status: 400 });
        profile = await svc.entities.PlayerProfile.update(profile.id, {
          tokens: profile.tokens - GRENADE_COST,
          grenades: (profile.grenades || 0) + 1
        });
        break;
      }

      case 'shield': {
        if ((profile.tokens || 0) < SHIELD_COST) return Response.json({ error: 'Insufficient funds' }, { status: 400 });
        profile = await svc.entities.PlayerProfile.update(profile.id, {
          tokens: profile.tokens - SHIELD_COST,
          shields: (profile.shields || 0) + 1
        });
        break;
      }

      case 'event_blook': {
        if (!blook_id) return Response.json({ error: 'Missing blook_id' }, { status: 400 });
        const blook = await svc.entities.Blook.get(blook_id);
        if (!blook || !blook.bazaar_event || !blook.is_active) {
          return Response.json({ error: 'Blook not available for purchase' }, { status: 400 });
        }
        const price = (blook.sell_price || SELL_PRICES[blook.rarity] || 5) * 5;
        if ((profile.tokens || 0) < price) return Response.json({ error: 'Insufficient funds' }, { status: 400 });
        profile = await svc.entities.PlayerProfile.update(profile.id, {
          tokens: profile.tokens - price
        });
        await grantBlookSafe(svc, user.id, blook_id, 1, 0);
        break;
      }

      case 'banner': {
        if (!banner_id) return Response.json({ error: 'Missing banner_id' }, { status: 400 });
        const banner = await svc.entities.Banner.get(banner_id);
        if (!banner || !banner.is_active) return Response.json({ error: 'Banner not available' }, { status: 400 });
        if ((profile.tokens || 0) < banner.cost) return Response.json({ error: 'Insufficient funds' }, { status: 400 });
        const existing = await svc.entities.PlayerBanner.filter({ user_id: user.id, banner_id: banner_id });
        if (existing.length > 0) return Response.json({ error: 'Already owned' }, { status: 400 });
        profile = await svc.entities.PlayerProfile.update(profile.id, {
          tokens: profile.tokens - banner.cost
        });
        await svc.entities.PlayerBanner.create({ user_id: user.id, banner_id: banner_id });
        break;
      }

      default:
        return Response.json({ error: 'Unknown item_type' }, { status: 400 });
    }

    profile = await enforceCaps(svc, profile);
    return Response.json({ ok: true, profile: publicProfile(profile) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function getProfileSafe(svc, userId) {
  const profiles = await svc.entities.PlayerProfile.filter({ user_id: userId });
  return profiles[0] || null;
}

async function grantBlookSafe(svc, userId, blookId, quantity, shinyQuantity) {
  const existing = await svc.entities.PlayerBlook.filter({ user_id: userId, blook_id: blookId, game: 'icecreamet' });
  if (existing.length > 0) {
    return svc.entities.PlayerBlook.update(existing[0].id, {
      quantity: (existing[0].quantity || 0) + quantity,
      shiny_quantity: (existing[0].shiny_quantity || 0) + shinyQuantity
    });
  }
  return svc.entities.PlayerBlook.create({
    user_id: userId, blook_id: blookId,
    quantity, shiny_quantity: shinyQuantity, game: 'icecreamet'
  });
}