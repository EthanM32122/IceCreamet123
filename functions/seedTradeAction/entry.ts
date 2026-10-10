import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Server-authoritative pumpkin-seed trading: send seeds to a player, or
// list / buy / cancel seeds on the Bazaar. All balances are checked and
// moved server-side — the client can never create or move seeds on its own.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action } = body || {};
    if (!action) return Response.json({ error: 'Missing action' }, { status: 400 });

    const svc = base44.asServiceRole;
    const getProfile = async (userId) => {
      const profiles = await svc.entities.PlayerProfile.filter({ user_id: userId });
      return profiles[0] || null;
    };

    let profile = await getProfile(user.id);
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });
    if (profile.is_banned) return Response.json({ error: 'Account banned' }, { status: 403 });

    switch (action) {
      case 'send': {
        const { receiver_user_id, quantity } = body;
        if (!receiver_user_id) return Response.json({ error: 'Missing recipient' }, { status: 400 });
        const qty = Math.floor(quantity || 0);
        if (qty <= 0) return Response.json({ error: 'Invalid quantity' }, { status: 400 });
        if (receiver_user_id === user.id) return Response.json({ error: 'Cannot send seeds to yourself' }, { status: 400 });
        if ((profile.pumpkin_seeds || 0) < qty) return Response.json({ error: 'Not enough pumpkin seeds' }, { status: 400 });

        const receiver = await getProfile(receiver_user_id);
        if (!receiver) return Response.json({ error: 'Recipient not found' }, { status: 404 });

        await svc.entities.PlayerProfile.update(profile.id, {
          pumpkin_seeds: (profile.pumpkin_seeds || 0) - qty
        });
        await svc.entities.PlayerProfile.update(receiver.id, {
          pumpkin_seeds: (receiver.pumpkin_seeds || 0) + qty
        });

        await svc.entities.Notification.create({
          user_id: receiver_user_id, type: 'gift_received',
          title: '🎃 Pumpkin Seeds!',
          message: `${profile.username} sent you ${qty} pumpkin seeds!`,
          link: '/spooky-event'
        }).catch(() => {});

        return Response.json({ ok: true, quantity: qty });
      }

      case 'list': {
        const { quantity, price } = body;
        const qty = Math.floor(quantity || 0);
        const listPrice = parseInt(price) || 0;
        if (qty <= 0) return Response.json({ error: 'Invalid quantity' }, { status: 400 });
        if (listPrice <= 0) return Response.json({ error: 'Invalid price' }, { status: 400 });
        if ((profile.pumpkin_seeds || 0) < qty) return Response.json({ error: 'Not enough pumpkin seeds' }, { status: 400 });

        await svc.entities.PlayerProfile.update(profile.id, {
          pumpkin_seeds: (profile.pumpkin_seeds || 0) - qty
        });
        const listing = await svc.entities.SeedListing.create({
          seller_id: user.id, seller_username: profile.username,
          quantity: qty, price: listPrice, status: 'active'
        });
        return Response.json({ ok: true, listing });
      }

      case 'buy': {
        const { listing_id } = body;
        if (!listing_id) return Response.json({ error: 'Missing listing_id' }, { status: 400 });

        const listing = await svc.entities.SeedListing.get(listing_id);
        if (!listing || listing.status !== 'active') {
          return Response.json({ error: 'Listing not available' }, { status: 400 });
        }
        if (listing.seller_id === user.id) {
          return Response.json({ error: 'Cannot buy your own listing' }, { status: 400 });
        }
        if ((profile.tokens || 0) < listing.price) {
          return Response.json({ error: 'Insufficient tokens' }, { status: 400 });
        }

        await svc.entities.PlayerProfile.update(profile.id, {
          tokens: (profile.tokens || 0) - listing.price,
          pumpkin_seeds: (profile.pumpkin_seeds || 0) + listing.quantity
        });

        const seller = await getProfile(listing.seller_id);
        if (seller) {
          await svc.entities.PlayerProfile.update(seller.id, {
            tokens: (seller.tokens || 0) + listing.price
          });
        }

        await svc.entities.SeedListing.update(listing_id, { status: 'sold' });
        return Response.json({ ok: true, listing });
      }

      case 'cancel': {
        const { listing_id } = body;
        if (!listing_id) return Response.json({ error: 'Missing listing_id' }, { status: 400 });

        const listing = await svc.entities.SeedListing.get(listing_id);
        if (!listing || listing.status !== 'active') {
          return Response.json({ error: 'Listing not available' }, { status: 400 });
        }
        if (listing.seller_id !== user.id) {
          return Response.json({ error: 'Not your listing' }, { status: 403 });
        }

        await svc.entities.PlayerProfile.update(profile.id, {
          pumpkin_seeds: (profile.pumpkin_seeds || 0) + listing.quantity
        });
        await svc.entities.SeedListing.update(listing_id, { status: 'cancelled' });
        return Response.json({ ok: true });
      }

      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}