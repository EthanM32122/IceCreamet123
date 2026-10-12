import { base44 } from '@/api/base44Client';

/** Parse trade room blook entry (id or id:shiny). */
export function parseTradeEntry(entry) {
  if (typeof entry !== 'string') return { id: entry, isShiny: false };
  if (entry.endsWith(':shiny')) return { id: entry.slice(0, -6), isShiny: true };
  return { id: entry, isShiny: false };
}

async function adjustOwnBlook(userId, blookId, isShiny, delta) {
  const rows = await base44.entities.PlayerBlook.filter({ user_id: userId, blook_id: blookId });
  const row = rows[0];
  if (delta < 0) {
    if (!row) return;
    if (isShiny) {
      const next = Math.max(0, (row.shiny_quantity || 0) + delta);
      await base44.entities.PlayerBlook.update(row.id, { shiny_quantity: next });
    } else {
      const next = Math.max(0, (row.quantity || 1) + delta);
      if (next <= 0 && !(row.shiny_quantity > 0)) {
        try {
          await base44.entities.PlayerBlook.delete(row.id);
        } catch (_) {
          await base44.entities.PlayerBlook.update(row.id, { quantity: 0 });
        }
      } else {
        await base44.entities.PlayerBlook.update(row.id, { quantity: next });
      }
    }
    return;
  }
  if (row) {
    if (isShiny) {
      await base44.entities.PlayerBlook.update(row.id, {
        shiny_quantity: (row.shiny_quantity || 0) + delta,
      });
    } else {
      await base44.entities.PlayerBlook.update(row.id, {
        quantity: (row.quantity || 1) + delta,
      });
    }
  } else {
    await base44.entities.PlayerBlook.create({
      user_id: userId,
      blook_id: blookId,
      quantity: isShiny ? 0 : delta,
      shiny_quantity: isShiny ? delta : 0,
      game: 'icecreamet',
    });
  }
}

/** Each player settles ONLY their own inventory (RLS-safe). */
export async function clientSettleLiveTrade(room, profile, updateProfile) {
  if (!room || !profile?.user_id) throw new Error('Missing room/profile');
  const key = `trade_settled_${room.id}_${profile.user_id}`;
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) {
      return { already: true };
    }
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, '1');
  } catch (_) {}

  const isA = room.player_a_id === profile.user_id;
  const isB = room.player_b_id === profile.user_id;
  if (!isA && !isB) throw new Error('Not a party to this trade');

  let giveRaw = [];
  let getRaw = [];
  try {
    giveRaw = JSON.parse(isA ? room.a_blooks || '[]' : room.b_blooks || '[]');
  } catch (_) {
    giveRaw = [];
  }
  try {
    getRaw = JSON.parse(isA ? room.b_blooks || '[]' : room.a_blooks || '[]');
  } catch (_) {
    getRaw = [];
  }
  const giveTokens = Number(isA ? room.a_tokens || 0 : room.b_tokens || 0) || 0;
  const getTokens = Number(isA ? room.b_tokens || 0 : room.a_tokens || 0) || 0;

  for (const entry of giveRaw) {
    const { id, isShiny } = parseTradeEntry(entry);
    if (id) await adjustOwnBlook(profile.user_id, id, isShiny, -1);
  }
  for (const entry of getRaw) {
    const { id, isShiny } = parseTradeEntry(entry);
    if (id) await adjustOwnBlook(profile.user_id, id, isShiny, 1);
  }

  const cur = Math.floor(Number(profile.tokens) || 0);
  const nextTokens = Math.max(0, cur - giveTokens + getTokens);
  if (nextTokens !== cur && updateProfile) {
    await updateProfile({ tokens: nextTokens });
  }

  try {
    const fresh = await base44.entities.TradeRoom.get(room.id);
    if (fresh.status === 'active' || fresh.status === 'completing') {
      await base44.entities.TradeRoom.update(room.id, {
        status: 'completed',
        a_accepted: true,
        b_accepted: true,
      });
      await base44.entities.TradeMessage.create({
        room_id: room.id,
        is_system: true,
        username: 'Trade Bot',
        content: '✅ Trade completed!',
      }).catch(() => {});
    }
  } catch (_) {}

  return { ok: true, tokens: nextTokens };
}

/** Accept public TradeRequest without backend function. */
export async function clientAcceptTradeRequest(trade, profile, updateProfile) {
  if (!trade || !profile) throw new Error('Missing trade');
  if (trade.from_user_id === profile.user_id) throw new Error('Cannot accept your own offer');

  let offerBlooks = [];
  let requestBlooks = [];
  const rawOffer = trade.offered_blooks != null ? trade.offered_blooks : trade.offer_blooks;
  const rawReq = trade.requested_blooks != null ? trade.requested_blooks : trade.request_blooks;
  try {
    offerBlooks = typeof rawOffer === 'string' ? JSON.parse(rawOffer || '[]') : (rawOffer || []);
  } catch (_) {}
  try {
    requestBlooks = typeof rawReq === 'string' ? JSON.parse(rawReq || '[]') : (rawReq || []);
  } catch (_) {}

  const offerTokens = Number(trade.offered_tokens != null ? trade.offered_tokens : (trade.offer_tokens || 0)) || 0;
  const requestTokens = Number(trade.requested_tokens != null ? trade.requested_tokens : (trade.request_tokens || 0)) || 0;

  for (const item of requestBlooks) {
    const id = item.blook_id || item.id || item;
    const qty = item.quantity || 1;
    const shiny = !!item.is_shiny;
    for (let i = 0; i < qty; i++) await adjustOwnBlook(profile.user_id, id, shiny, -1);
  }
  for (const item of offerBlooks) {
    const id = item.blook_id || item.id || item;
    const qty = item.quantity || 1;
    const shiny = !!item.is_shiny;
    for (let i = 0; i < qty; i++) await adjustOwnBlook(profile.user_id, id, shiny, 1);
  }

  let tokens = Math.floor(Number(profile.tokens) || 0);
  tokens = tokens - requestTokens + offerTokens;
  if (tokens < 0) throw new Error('Not enough tokens');
  await updateProfile({ tokens });

  try {
    const posters = await base44.entities.PlayerProfile.filter({ user_id: trade.from_user_id });
    const poster = posters[0];
    if (poster) {
      for (const item of offerBlooks) {
        const id = item.blook_id || item.id || item;
        const qty = item.quantity || 1;
        const shiny = !!item.is_shiny;
        for (let i = 0; i < qty; i++) {
          try { await adjustOwnBlook(trade.from_user_id, id, shiny, -1); } catch (_) {}
        }
      }
      for (const item of requestBlooks) {
        const id = item.blook_id || item.id || item;
        const qty = item.quantity || 1;
        const shiny = !!item.is_shiny;
        for (let i = 0; i < qty; i++) {
          try { await adjustOwnBlook(trade.from_user_id, id, shiny, 1); } catch (_) {}
        }
      }
      try {
        await base44.entities.PlayerProfile.update(poster.id, {
          tokens: Math.max(0, Math.floor(Number(poster.tokens) || 0) - offerTokens + requestTokens),
        });
      } catch (_) {}
    }
  } catch (_) {}

  await base44.entities.TradeRequest.update(trade.id, { status: 'accepted', to_user_id: profile.user_id });
  try {
    await base44.entities.Notification.create({
      user_id: trade.from_user_id,
      type: 'trade_received',
      title: 'Trade accepted',
      message: `${profile.username || 'Someone'} accepted your trade offer.`,
      link: '/trade',
    });
  } catch (_) {}

  return { ok: true, profile: { ...profile, tokens } };
}
