import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { enforceCaps, publicProfile } from '../../shared/economy.ts';

// Handles auction operations: list, bid, and claim.
// All ownership and balance checks are server-side.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action } = body;
    if (!action) return Response.json({ error: 'Missing action' }, { status: 400 });

    const svc = base44.asServiceRole;
    let profile = await getProfileSafe(svc, user.id);
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });
    if (profile.is_banned) return Response.json({ error: 'Account banned' }, { status: 403 });

    switch (action) {
      case 'list': {
        const { blook_id, isShiny, starting_price, duration_hours } = body;
        if (!blook_id) return Response.json({ error: 'Missing blook_id' }, { status: 400 });
        const startPrice = parseInt(starting_price) || 0;
        const hours = Math.max(1, Math.min(72, parseInt(duration_hours) || 24));
        if (startPrice <= 0) return Response.json({ error: 'Invalid starting price' }, { status: 400 });

        // Validate ownership
        const records = await svc.entities.PlayerBlook.filter({ user_id: user.id, blook_id, game: 'icecreamet' });
        if (records.length === 0) return Response.json({ error: 'You do not own this blook' }, { status: 400 });
        const rec = records[0];
        const available = isShiny ? (rec.shiny_quantity || 0) : (rec.quantity || 0);
        if (available < 1) return Response.json({ error: 'Insufficient quantity' }, { status: 400 });

        // Get blook details
        const blook = await svc.entities.Blook.get(blook_id);
        if (!blook) return Response.json({ error: 'Blook not found' }, { status: 404 });

        // Remove from inventory
        const newQty = isShiny ? rec.shiny_quantity - 1 : rec.quantity - 1;
        const otherQty = isShiny ? (rec.quantity || 0) : (rec.shiny_quantity || 0);
        if (newQty <= 0 && otherQty <= 0) await svc.entities.PlayerBlook.delete(rec.id);
        else {
          const patch = isShiny ? { shiny_quantity: Math.max(0, newQty) } : { quantity: Math.max(0, newQty) };
          await svc.entities.PlayerBlook.update(rec.id, patch);
        }

        // Create auction
        const auction = await svc.entities.Auction.create({
          seller_id: user.id, seller_username: profile.username,
          blook_id, blook_name: blook.name, blook_image_url: blook.image_url || '',
          blook_rarity: blook.rarity, starting_price: startPrice,
          current_bid: 0, end_time: new Date(Date.now() + hours * 3600000).toISOString(),
          status: 'active', game: 'icecreamet', is_shiny: !!isShiny
        });
        return Response.json({ ok: true, auction });
      }

      case 'bid': {
        const { auction_id, amount } = body;
        if (!auction_id) return Response.json({ error: 'Missing auction_id' }, { status: 400 });
        const bidAmount = parseInt(amount) || 0;

        const auction = await svc.entities.Auction.get(auction_id);
        if (!auction || auction.status !== 'active') return Response.json({ error: 'Auction not active' }, { status: 400 });
        if (new Date(auction.end_time).getTime() < Date.now()) return Response.json({ error: 'Auction ended' }, { status: 400 });
        if (auction.seller_id === user.id) return Response.json({ error: 'Cannot bid on your own auction' }, { status: 400 });

        const minBid = auction.current_bid > 0 ? auction.current_bid + 1 : auction.starting_price;
        if (bidAmount < minBid) return Response.json({ error: `Minimum bid is ${minBid}` }, { status: 400 });
        if (bidAmount > (profile.tokens || 0)) return Response.json({ error: 'Insufficient funds' }, { status: 400 });

        await svc.entities.Auction.update(auction_id, {
          current_bid: bidAmount,
          current_bidder_id: user.id,
          current_bidder_username: profile.username
        });
        return Response.json({ ok: true });
      }

      case 'claim': {
        const { auction_id } = body;
        if (!auction_id) return Response.json({ error: 'Missing auction_id' }, { status: 400 });

        const auction = await svc.entities.Auction.get(auction_id);
        if (!auction || auction.status !== 'active') return Response.json({ error: 'Auction not available' }, { status: 400 });
        if (new Date(auction.end_time).getTime() >= Date.now()) return Response.json({ error: 'Auction not ended yet' }, { status: 400 });
        if (auction.current_bidder_id !== user.id) return Response.json({ error: 'You are not the winner' }, { status: 403 });
        if ((profile.tokens || 0) < auction.current_bid) return Response.json({ error: 'Insufficient funds' }, { status: 400 });

        // Validate seller still has the blook
        const sellerBlooks = await svc.entities.PlayerBlook.filter({ user_id: auction.seller_id, blook_id: auction.blook_id, game: 'icecreamet' });
        const sellerHas = sellerBlooks[0] && (auction.is_shiny ? (sellerBlooks[0].shiny_quantity || 0) >= 1 : (sellerBlooks[0].quantity || 0) >= 1);
        if (!sellerHas) {
          await svc.entities.Auction.update(auction_id, { status: 'cancelled' });
          return Response.json({ error: 'Seller no longer has this blook' }, { status: 400 });
        }

        // Pay seller
        const sellerProfiles = await svc.entities.PlayerProfile.filter({ user_id: auction.seller_id });
        if (sellerProfiles[0]) {
          await svc.entities.PlayerProfile.update(sellerProfiles[0].id, {
            tokens: (sellerProfiles[0].tokens || 0) + auction.current_bid
          });
        }

        // Deduct from winner
        profile = await svc.entities.PlayerProfile.update(profile.id, {
          tokens: profile.tokens - auction.current_bid
        });

        // Transfer blook
        const sb = sellerBlooks[0];
        if (auction.is_shiny) {
          const newSq = (sb.shiny_quantity || 0) - 1;
          if (newSq <= 0 && (sb.quantity || 0) <= 0) await svc.entities.PlayerBlook.delete(sb.id);
          else await svc.entities.PlayerBlook.update(sb.id, { shiny_quantity: newSq });
        } else {
          if (sb.quantity > 1) await svc.entities.PlayerBlook.update(sb.id, { quantity: sb.quantity - 1 });
          else await svc.entities.PlayerBlook.delete(sb.id);
        }

        const myExisting = await svc.entities.PlayerBlook.filter({ user_id: user.id, blook_id: auction.blook_id, game: 'icecreamet' });
        if (myExisting[0]) {
          const patch = auction.is_shiny
            ? { shiny_quantity: (myExisting[0].shiny_quantity || 0) + 1 }
            : { quantity: (myExisting[0].quantity || 0) + 1 };
          await svc.entities.PlayerBlook.update(myExisting[0].id, patch);
        } else {
          await svc.entities.PlayerBlook.create({
            user_id: user.id, blook_id: auction.blook_id,
            quantity: auction.is_shiny ? 0 : 1,
            shiny_quantity: auction.is_shiny ? 1 : 0,
            game: 'icecreamet'
          });
        }

        await svc.entities.Auction.update(auction_id, { status: 'claimed' });
        profile = await enforceCaps(svc, profile);
        return Response.json({ ok: true, profile: publicProfile(profile) });
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