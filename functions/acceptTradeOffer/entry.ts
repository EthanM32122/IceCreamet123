import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { enforceCaps, publicProfile } from '../../shared/economy.ts';

// Accepts a public Trade Hub offer. The server re-validates ownership and
// balances before transferring anything — no client-side inventory mutation
// can fake or duplicate items. Cross-player writes use asServiceRole to
// bypass RLS (the same pattern as executeTrade for live trade rooms).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { trade_id } = body;
    if (!trade_id) return Response.json({ error: 'Missing trade_id' }, { status: 400 });

    const svc = base44.asServiceRole;

    // 1. Get the trade request + validate state
    const trade = await svc.entities.TradeRequest.get(trade_id);
    if (!trade) return Response.json({ error: 'Trade not found' }, { status: 404 });
    if (!trade.is_public || trade.status !== 'pending') {
      return Response.json({ error: 'Trade is no longer available' }, { status: 400 });
    }
    if (trade.from_user_id === user.id) {
      return Response.json({ error: "You can't accept your own offer" }, { status: 400 });
    }

    // 2. Mark as accepted (prevents double-accept)
    await svc.entities.TradeRequest.update(trade_id, { status: 'accepted', to_user_id: user.id, is_public: false });

    const offered = JSON.parse(trade.offered_blooks || '[]');
    const requested = JSON.parse(trade.requested_blooks || '[]');
    const offeredTokens = trade.offered_tokens || 0;
    const requestedTokens = trade.requested_tokens || 0;

    // 3. Fetch both players' profiles + inventory
    const [myPb, theirPb, myPs, theirPs] = await Promise.all([
      svc.entities.PlayerBlook.filter({ user_id: user.id }),
      svc.entities.PlayerBlook.filter({ user_id: trade.from_user_id }),
      svc.entities.PlayerProfile.filter({ user_id: user.id }),
      svc.entities.PlayerProfile.filter({ user_id: trade.from_user_id })
    ]);
    const myProf = myPs[0], theirProf = theirPs[0];

    // 4. Build ownership maps
    const myOwned = {}, theirOwned = {};
    myPb.forEach(p => { myOwned[p.blook_id] = (myOwned[p.blook_id] || 0) + (p.quantity || 0); });
    theirPb.forEach(p => { theirOwned[p.blook_id] = (theirOwned[p.blook_id] || 0) + (p.quantity || 0); });

    // 5. Validate ownership + balances
    for (const r of requested) {
      if ((myOwned[r.blook_id] || 0) < (r.quantity || 1)) {
        await restoreTrade(svc, trade_id);
        return Response.json({ error: "You don't have the requested blooks" }, { status: 400 });
      }
    }
    for (const o of offered) {
      if ((theirOwned[o.blook_id] || 0) < (o.quantity || 1)) {
        await restoreTrade(svc, trade_id);
        return Response.json({ error: "The poster no longer has the offered blooks" }, { status: 400 });
      }
    }
    if ((myProf?.tokens || 0) < requestedTokens) {
      await restoreTrade(svc, trade_id);
      return Response.json({ error: "You don't have enough tokens" }, { status: 400 });
    }
    if ((theirProf?.tokens || 0) < offeredTokens) {
      await restoreTrade(svc, trade_id);
      return Response.json({ error: "The poster doesn't have enough tokens" }, { status: 400 });
    }

    // 6. Move requested blooks (me -> poster)
    for (const r of requested) {
      await moveQty(svc, user.id, trade.from_user_id, r.blook_id, r.quantity || 1);
    }

    // 7. Move offered blooks (poster -> me)
    for (const o of offered) {
      await moveQty(svc, trade.from_user_id, user.id, o.blook_id, o.quantity || 1);
    }

    // 8. Move tokens
    if (myProf) await svc.entities.PlayerProfile.update(myProf.id, { tokens: (myProf.tokens || 0) - requestedTokens + offeredTokens });
    if (theirProf) await svc.entities.PlayerProfile.update(theirProf.id, { tokens: (theirProf.tokens || 0) - offeredTokens + requestedTokens });

    // 9. Notification to poster
    if (theirProf) {
      const myUsername = myProf?.username || 'A player';
      await svc.entities.Notification.create({
        user_id: trade.from_user_id, type: 'trade_accepted',
        title: 'Trade Accepted!', message: `${myUsername} accepted your trade hub offer.`,
        link: '/trade'
      }).catch(() => {});
    }

    // Return updated profile for the caller
    if (!myProf) return Response.json({ ok: true });
    const refreshed = await svc.entities.PlayerProfile.get(myProf.id);
    const capped = await enforceCaps(svc, refreshed);
    return Response.json({ ok: true, profile: publicProfile(capped) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function restoreTrade(svc, tradeId) {
  await svc.entities.TradeRequest.update(tradeId, {
    status: 'pending', is_public: true, to_user_id: 'public'
  }).catch(() => {});
}

async function moveQty(svc, fromUid, toUid, blookId, qty) {
  const fromRecs = await svc.entities.PlayerBlook.filter({ user_id: fromUid, blook_id: blookId });
  if (!fromRecs[0]) throw new Error('missing blook');
  const blookGame = fromRecs[0].game || 'icecreamet';
  const rem = (fromRecs[0].quantity || 0) - qty;
  if (rem <= 0 && (fromRecs[0].shiny_quantity || 0) <= 0) await svc.entities.PlayerBlook.delete(fromRecs[0].id);
  else await svc.entities.PlayerBlook.update(fromRecs[0].id, { quantity: Math.max(0, rem) });

  const toRecs = await svc.entities.PlayerBlook.filter({ user_id: toUid, blook_id: blookId });
  if (toRecs[0]) await svc.entities.PlayerBlook.update(toRecs[0].id, { quantity: (toRecs[0].quantity || 0) + qty });
  else await svc.entities.PlayerBlook.create({ user_id: toUid, blook_id: blookId, quantity: qty, game: blookGame });
}