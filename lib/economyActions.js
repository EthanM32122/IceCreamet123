import { base44 } from '@/api/base44Client';

/** Server-authoritative bazaar list/buy/cancel so sellers get tokens. */
export async function bazaarList({ blook_id, price, isShiny }) {
  const res = await base44.functions.invoke('bazaarAction', {
    action: 'list',
    blook_id,
    price,
    isShiny: !!isShiny,
  });
  const data = res?.data || res;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function bazaarBuy(listing_id) {
  const res = await base44.functions.invoke('bazaarAction', {
    action: 'buy',
    listing_id,
  });
  const data = res?.data || res;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function bazaarCancel(listing_id) {
  const res = await base44.functions.invoke('bazaarAction', {
    action: 'cancel',
    listing_id,
  });
  const data = res?.data || res;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function auctionBid(auction_id, amount) {
  const res = await base44.functions.invoke('auctionAction', {
    action: 'bid',
    auction_id,
    amount,
  });
  const data = res?.data || res;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function auctionClaim(auction_id) {
  const res = await base44.functions.invoke('auctionAction', {
    action: 'claim',
    auction_id,
  });
  const data = res?.data || res;
  if (data?.error) throw new Error(data.error);
  return data;
}
