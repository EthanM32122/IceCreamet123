import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { enforceCaps, publicProfile } from '../../shared/economy.ts';

// Executes a trade when both players have accepted. The server re-validates
// ownership and balances before transferring anything — no client-side
// inventory mutation can fake or duplicate items.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { room_id } = body;
    if (!room_id) return Response.json({ error: 'Missing room_id' }, { status: 400 });

    const svc = base44.asServiceRole;

    // 1. Atomic claim: only succeeds if status is still 'active'. This prevents
    // the double-execution race where both players' clients fire executeTrade
    // simultaneously and the backend transfers blooks twice.
    await svc.entities.TradeRoom.updateMany(
      { id: room_id, status: 'active', a_accepted: true, b_accepted: true },
      { $set: { status: 'completing' } }
    );
    // Re-read to get the room data and verify the claim succeeded
    const room = await svc.entities.TradeRoom.get(room_id);
    if (!room) return Response.json({ error: 'Trade room not found' }, { status: 404 });
    if (room.status !== 'completing') return Response.json({ error: 'Trade is not active or already processing' }, { status: 400 });
    // Either player can trigger execution
    if (room.player_a_id !== user.id && room.player_b_id !== user.id) {
      // Release the claim since this caller isn't a participant
      await svc.entities.TradeRoom.update(room_id, { status: 'active' }).catch(() => {});
      return Response.json({ error: 'Not a participant' }, { status: 403 });
    }

    const game = room.game || 'icecreamet';
    const aOffer = JSON.parse(room.a_blooks || '[]');
    const bOffer = JSON.parse(room.b_blooks || '[]');
    const aTokens = room.a_tokens || 0;
    const bTokens = room.b_tokens || 0;

    // 3. Fetch both players' profiles + inventory
    const [aPb, bPb, aPs, bPs] = await Promise.all([
      svc.entities.PlayerBlook.filter({ user_id: room.player_a_id }),
      svc.entities.PlayerBlook.filter({ user_id: room.player_b_id }),
      svc.entities.PlayerProfile.filter({ user_id: room.player_a_id }),
      svc.entities.PlayerProfile.filter({ user_id: room.player_b_id })
    ]);
    const aProf = aPs[0], bProf = bPs[0];

    // 4. Parse offers into normal/shiny counts
    const parseOffer = (offer) => {
      const normal = {}, shiny = {};
      offer.forEach(entry => {
        if (typeof entry === 'string' && entry.endsWith(':shiny')) {
          const id = entry.slice(0, -6);
          shiny[id] = (shiny[id] || 0) + 1;
        } else {
          normal[entry] = (normal[entry] || 0) + 1;
        }
      });
      return { normal, shiny };
    };
    const aParsed = parseOffer(aOffer);
    const bParsed = parseOffer(bOffer);

    // 5. Validate ownership
    const aOwned = {}, aOwnedShiny = {}, bOwned = {}, bOwnedShiny = {};
    aPb.forEach(p => {
      aOwned[p.blook_id] = (aOwned[p.blook_id] || 0) + (p.quantity || 0);
      aOwnedShiny[p.blook_id] = (aOwnedShiny[p.blook_id] || 0) + (p.shiny_quantity || 0);
    });
    bPb.forEach(p => {
      bOwned[p.blook_id] = (bOwned[p.blook_id] || 0) + (p.quantity || 0);
      bOwnedShiny[p.blook_id] = (bOwnedShiny[p.blook_id] || 0) + (p.shiny_quantity || 0);
    });

    for (const id in aParsed.normal) if ((aOwned[id] || 0) < aParsed.normal[id]) return await failTrade(svc, room_id, 'Player A no longer has all offered blooks');
    for (const id in aParsed.shiny) if ((aOwnedShiny[id] || 0) < aParsed.shiny[id]) return await failTrade(svc, room_id, 'Player A no longer has all offered shiny blooks');
    for (const id in bParsed.normal) if ((bOwned[id] || 0) < bParsed.normal[id]) return await failTrade(svc, room_id, 'Player B no longer has all offered blooks');
    for (const id in bParsed.shiny) if ((bOwnedShiny[id] || 0) < bParsed.shiny[id]) return await failTrade(svc, room_id, 'Player B no longer has all offered shiny blooks');

    if ((aProf?.tokens || 0) < aTokens) return await failTrade(svc, room_id, 'Player A has insufficient tokens');
    if ((bProf?.tokens || 0) < bTokens) return await failTrade(svc, room_id, 'Player B has insufficient tokens');

    // 6. Move blooks A -> B
    for (const id in aParsed.normal) await moveQty(svc, room.player_a_id, room.player_b_id, id, aParsed.normal[id], game);
    for (const id in aParsed.shiny) await moveShinyQty(svc, room.player_a_id, room.player_b_id, id, aParsed.shiny[id], game);

    // 7. Move blooks B -> A
    for (const id in bParsed.normal) await moveQty(svc, room.player_b_id, room.player_a_id, id, bParsed.normal[id], game);
    for (const id in bParsed.shiny) await moveShinyQty(svc, room.player_b_id, room.player_a_id, id, bParsed.shiny[id], game);

    // 8. Move tokens
    if (aProf) await svc.entities.PlayerProfile.update(aProf.id, { tokens: (aProf.tokens || 0) - aTokens + bTokens });
    if (bProf) await svc.entities.PlayerProfile.update(bProf.id, { tokens: (bProf.tokens || 0) - bTokens + aTokens });

    // 9. Complete
    await svc.entities.TradeRoom.update(room_id, { status: 'completed' });
    await svc.entities.TradeMessage.create({
      room_id, is_system: true, username: 'Trade Bot', content: '✅ Trade completed!'
    });

    // Return updated profile for the caller
    const callerProfile = user.id === room.player_a_id ? aProf : bProf;
    const refreshed = await svc.entities.PlayerProfile.get(callerProfile.id);
    const capped = await enforceCaps(svc, refreshed);
    return Response.json({ ok: true, profile: publicProfile(capped) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function failTrade(svc, roomId, message) {
  await svc.entities.TradeRoom.update(roomId, { status: 'active', a_accepted: false, b_accepted: false }).catch(() => {});
  await svc.entities.TradeMessage.create({
    room_id: roomId, is_system: true, username: 'Trade Bot', content: '⚠️ ' + message
  }).catch(() => {});
  return Response.json({ error: message }, { status: 400 });
}

async function moveQty(svc, fromUid, toUid, blookId, qty, game) {
  const fromRecs = await svc.entities.PlayerBlook.filter({ user_id: fromUid, blook_id: blookId });
  if (!fromRecs[0]) throw new Error('missing blook');
  const blookGame = fromRecs[0].game || game;
  const rem = (fromRecs[0].quantity || 0) - qty;
  if (rem <= 0 && (fromRecs[0].shiny_quantity || 0) <= 0) await svc.entities.PlayerBlook.delete(fromRecs[0].id);
  else await svc.entities.PlayerBlook.update(fromRecs[0].id, { quantity: Math.max(0, rem) });

  const toRecs = await svc.entities.PlayerBlook.filter({ user_id: toUid, blook_id: blookId });
  if (toRecs[0]) await svc.entities.PlayerBlook.update(toRecs[0].id, { quantity: (toRecs[0].quantity || 0) + qty });
  else await svc.entities.PlayerBlook.create({ user_id: toUid, blook_id: blookId, quantity: qty, game: blookGame });
}

async function moveShinyQty(svc, fromUid, toUid, blookId, qty, game) {
  const fromRecs = await svc.entities.PlayerBlook.filter({ user_id: fromUid, blook_id: blookId });
  if (!fromRecs[0]) throw new Error('missing shiny blook');
  const blookGame = fromRecs[0].game || game;
  const rem = (fromRecs[0].shiny_quantity || 0) - qty;
  if (rem <= 0 && (fromRecs[0].quantity || 0) <= 0) await svc.entities.PlayerBlook.delete(fromRecs[0].id);
  else await svc.entities.PlayerBlook.update(fromRecs[0].id, { shiny_quantity: Math.max(0, rem) });

  const toRecs = await svc.entities.PlayerBlook.filter({ user_id: toUid, blook_id: blookId });
  if (toRecs[0]) await svc.entities.PlayerBlook.update(toRecs[0].id, { shiny_quantity: (toRecs[0].shiny_quantity || 0) + qty });
  else await svc.entities.PlayerBlook.create({ user_id: toUid, blook_id: blookId, quantity: 0, shiny_quantity: qty, game: blookGame });
}