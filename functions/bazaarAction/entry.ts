import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { enforceCaps, publicProfile } from '../../shared/economy.ts';

// Handles bazaar operations: list, buy, and cancel.
// All ownership and balance checks are server-side — the client cannot
// create fake listings, buy with insufficient funds, or steal blooks.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action } = body || {};
    if (!action) return Response.json({ error: 'Missing action' }, { status: 400 });

    const svc = base44.asServiceRole;
    let profile = await getProfileSafe(svc, user.id);
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });
    if (profile.is_banned) return Response.json({ error: 'Account banned' }, { status: 403 });

    switch (action) {
      case 'list': {
        const { blook_id, price, isShiny } = body;
        if (!blook_id) return Response.json({ error: 'Missing blook_id' }, { status: 400 });
        const listPrice = parseInt(price) || 0;
        if (listPrice <= 0) return Response.json({ error: 'Invalid price' }, { status: 400 });

        // Validate ownership
        const records = await svc.entities.PlayerBlook.filter({ user_id: user.id, blook_id });
        if (records.length === 0) return Response.json({ error: 'You do not own this blook' }, { status: 400 });
        const rec = records[0];
        const available = isShiny ? (rec.shiny_quantity || 0) : (rec.quantity || 0);
        if (available < 1) return Response.json({ error: 'Insufficient quantity' }, { status: 400 });

        // Remove the blook from inventory
        const newQty = isShiny ? rec.shiny_quantity - 1 : rec.quantity - 1;
        const otherQty = isShiny ? (rec.quantity || 0) : (rec.shiny_quantity || 0);
        if (newQty <= 0 && otherQty <= 0) {
          await svc.entities.PlayerBlook.delete(rec.id);
        } else {
          const patch = isShiny ? { shiny_quantity: Math.max(0, newQty) } : { quantity: Math.max(0, newQty) };
          await svc.entities.PlayerBlook.update(rec.id, patch);
        }

        // Create the listing
        const listing = await svc.entities.BazaarListing.create({
          seller_id: user.id, seller_username: profile.username,
          blook_id, price: listPrice, status: 'active',
          is_shiny: !!isShiny, game: rec.game || 'icecreamet'
        });
        return Response.json({ ok: true, listing });
      }

      case 'buy': {
        const { listing_id } = body;
        if (!listing_id) return Response.json({ error: 'Missing listing_id' }, { status: 400 });

        const listing = await svc.entities.BazaarListing.get(listing_id);
        if (!listing || listing.status !== 'active') {
          return Response.json({ error: 'Listing not available' }, { status: 400 });
        }
        if (listing.seller_id === user.id) {
          return Response.json({ error: 'Cannot buy your own listing' }, { status: 400 });
        }
        if ((profile.tokens || 0) < listing.price) {
          return Response.json({ error: 'Insufficient funds' }, { status: 400 });
        }

        // Deduct from buyer
        profile = await svc.entities.PlayerProfile.update(profile.id, {
          tokens: profile.tokens - listing.price
        });

        // Grant blook to buyer
        const existing = await svc.entities.PlayerBlook.filter({ user_id: user.id, blook_id: listing.blook_id });
        if (existing.length > 0) {
          const patch = listing.is_shiny
            ? { shiny_quantity: (existing[0].shiny_quantity || 0) + 1 }
            : { quantity: (existing[0].quantity || 0) + 1 };
          await svc.entities.PlayerBlook.update(existing[0].id, patch);
        } else {
          await svc.entities.PlayerBlook.create({
            user_id: user.id, blook_id: listing.blook_id,
            quantity: listing.is_shiny ? 0 : 1,
            shiny_quantity: listing.is_shiny ? 1 : 0,
            game: listing.game || 'icecreamet'
          });
        }

        // Pay the seller
        const sellerProfiles = await svc.entities.PlayerProfile.filter({ user_id: listing.seller_id });
        if (sellerProfiles.length > 0) {
          await svc.entities.PlayerProfile.update(sellerProfiles[0].id, {
            tokens: (sellerProfiles[0].tokens || 0) + listing.price
          });
        }

        // Mark listing as sold
        await svc.entities.BazaarListing.update(listing_id, { status: 'sold' });

        profile = await enforceCaps(svc, profile);
        return Response.json({ ok: true, profile: publicProfile(profile) });
      }

      case 'cancel': {
        const { listing_id } = body;
        if (!listing_id) return Response.json({ error: 'Missing listing_id' }, { status: 400 });

        const listing = await svc.entities.BazaarListing.get(listing_id);
        if (!listing || listing.status !== 'active') {
          return Response.json({ error: 'Listing not available' }, { status: 400 });
        }
        if (listing.seller_id !== user.id) {
          return Response.json({ error: 'Not your listing' }, { status: 403 });
        }

        // Return the blook to the seller
        const existing = await svc.entities.PlayerBlook.filter({ user_id: user.id, blook_id: listing.blook_id });
        if (existing.length > 0) {
          const patch = listing.is_shiny
            ? { shiny_quantity: (existing[0].shiny_quantity || 0) + 1 }
            : { quantity: (existing[0].quantity || 0) + 1 };
          await svc.entities.PlayerBlook.update(existing[0].id, patch);
        } else {
          await svc.entities.PlayerBlook.create({
            user_id: user.id, blook_id: listing.blook_id,
            quantity: listing.is_shiny ? 0 : 1,
            shiny_quantity: listing.is_shiny ? 1 : 0,
            game: listing.game || 'icecreamet'
          });
        }

        await svc.entities.BazaarListing.update(listing_id, { status: 'cancelled' });
        return Response.json({ ok: true });
      }

      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function getProfileSafe(svc, userId) {
  const profiles = await svc.entities.PlayerProfile.filter({ user_id: userId });
  return profiles[0] || null;
}