import { base44 } from '@/api/base44Client';

async function invokeOrNull(name, payload, ms = 3500) {
  try {
    const p = base44.functions.invoke(name, payload);
    p.catch(() => {});
    return await Promise.race([
      p,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
    ]);
  } catch (_) {
    return null;
  }
}

/** Server-authoritative bazaar; falls back to client when functions blocked. */
export async function bazaarList({ blook_id, price, isShiny }) {
  const res = await invokeOrNull('bazaarAction', {
    action: 'list',
    blook_id,
    price,
    isShiny: !!isShiny,
  });
  const data = res?.data || res;
  if (data && !data.error) return data;
  if (data?.error) throw new Error(data.error);

  const user = await base44.auth.me();
  if (!user) throw new Error('Not logged in');
  const profiles = await base44.entities.PlayerProfile.filter({ user_id: user.id });
  const profile = profiles[0];
  if (!profile) throw new Error('Profile not found');
  const records = await base44.entities.PlayerBlook.filter({ user_id: user.id, blook_id });
  if (!records.length) throw new Error('You do not own this blook');
  const row = records[0];
  if (isShiny) {
    if ((row.shiny_quantity || 0) < 1) throw new Error('No shiny to list');
    await base44.entities.PlayerBlook.update(row.id, { shiny_quantity: (row.shiny_quantity || 0) - 1 });
  } else {
    if ((row.quantity || 1) < 1) throw new Error('No copies to list');
    const next = (row.quantity || 1) - 1;
    if (next <= 0 && !(row.shiny_quantity > 0)) {
      try { await base44.entities.PlayerBlook.delete(row.id); } catch (_) {
        await base44.entities.PlayerBlook.update(row.id, { quantity: 0 });
      }
    } else {
      await base44.entities.PlayerBlook.update(row.id, { quantity: next });
    }
  }
  await base44.entities.BazaarListing.create({
    seller_id: user.id,
    seller_username: profile.username,
    blook_id,
    price: parseInt(price) || 0,
    is_shiny: !!isShiny,
    status: 'active',
    game: 'icecreamet',
  });
  return { ok: true, fallback: true };
}

export async function bazaarBuy(listing_id) {
  const res = await invokeOrNull('bazaarAction', { action: 'buy', listing_id });
  const data = res?.data || res;
  if (data && !data.error) return data;
  if (data?.error) throw new Error(data.error);

  const user = await base44.auth.me();
  if (!user) throw new Error('Not logged in');
  const listing = await base44.entities.BazaarListing.get(listing_id);
  if (!listing || listing.status !== 'active') throw new Error('Listing not available');
  if (listing.seller_id === user.id) throw new Error('Cannot buy your own listing');
  const profiles = await base44.entities.PlayerProfile.filter({ user_id: user.id });
  const profile = profiles[0];
  if (!profile) throw new Error('Profile not found');
  const price = Number(listing.price) || 0;
  if ((profile.tokens || 0) < price) throw new Error('Not enough tokens');

  const mine = await base44.entities.PlayerBlook.filter({ user_id: user.id, blook_id: listing.blook_id });
  if (mine[0]) {
    if (listing.is_shiny) {
      await base44.entities.PlayerBlook.update(mine[0].id, {
        shiny_quantity: (mine[0].shiny_quantity || 0) + 1,
      });
    } else {
      await base44.entities.PlayerBlook.update(mine[0].id, {
        quantity: (mine[0].quantity || 1) + 1,
      });
    }
  } else {
    await base44.entities.PlayerBlook.create({
      user_id: user.id,
      blook_id: listing.blook_id,
      quantity: listing.is_shiny ? 0 : 1,
      shiny_quantity: listing.is_shiny ? 1 : 0,
      game: listing.game || 'icecreamet',
    });
  }

  const newTokens = Math.max(0, (profile.tokens || 0) - price);
  await base44.entities.PlayerProfile.update(profile.id, { tokens: newTokens });

  try {
    const sellers = await base44.entities.PlayerProfile.filter({ user_id: listing.seller_id });
    if (sellers[0]) {
      await base44.entities.PlayerProfile.update(sellers[0].id, {
        tokens: (sellers[0].tokens || 0) + price,
      });
    }
  } catch (_) {}

  await base44.entities.BazaarListing.update(listing.id, { status: 'sold' });
  return { ok: true, fallback: true, profile: { ...profile, tokens: newTokens } };
}

export async function bazaarCancel(listing_id) {
  const res = await invokeOrNull('bazaarAction', { action: 'cancel', listing_id });
  const data = res?.data || res;
  if (data && !data.error) return data;
  if (data?.error) throw new Error(data.error);

  const user = await base44.auth.me();
  if (!user) throw new Error('Not logged in');
  const listing = await base44.entities.BazaarListing.get(listing_id);
  if (!listing || listing.seller_id !== user.id) throw new Error('Not your listing');
  const mine = await base44.entities.PlayerBlook.filter({ user_id: user.id, blook_id: listing.blook_id });
  if (mine[0]) {
    if (listing.is_shiny) {
      await base44.entities.PlayerBlook.update(mine[0].id, {
        shiny_quantity: (mine[0].shiny_quantity || 0) + 1,
      });
    } else {
      await base44.entities.PlayerBlook.update(mine[0].id, {
        quantity: (mine[0].quantity || 1) + 1,
      });
    }
  } else {
    await base44.entities.PlayerBlook.create({
      user_id: user.id,
      blook_id: listing.blook_id,
      quantity: listing.is_shiny ? 0 : 1,
      shiny_quantity: listing.is_shiny ? 1 : 0,
      game: 'icecreamet',
    });
  }
  await base44.entities.BazaarListing.update(listing.id, { status: 'cancelled' });
  return { ok: true, fallback: true };
}

export async function auctionBid(auction_id, amount) {
  const res = await invokeOrNull('auctionAction', { action: 'bid', auction_id, amount });
  const data = res?.data || res;
  if (data && !data.error) return data;
  if (data?.error) throw new Error(data.error);
  throw new Error('Auction bid needs Base44 backend — try https://icecreametisnot.base44.app');
}

export async function auctionClaim(auction_id) {
  const res = await invokeOrNull('auctionAction', { action: 'claim', auction_id });
  const data = res?.data || res;
  if (data && !data.error) return data;
  if (data?.error) throw new Error(data.error);
  throw new Error('Auction claim needs Base44 backend — try https://icecreametisnot.base44.app');
}
