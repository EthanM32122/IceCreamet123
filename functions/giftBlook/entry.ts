import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isBlookAdminRestricted, buildPackMap } from '../../shared/economy.ts';

// SPOOKY MONTH event pack — its blooks are exclusive event rewards that
// can only be earned by collecting pumpkin seeds. They cannot be gifted.
const SPOOKY_PACK_ID = '6abdc8898281b760c964c249';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { receiver_user_id, blook_id, quantity, is_shiny } = body || {};
    if (!receiver_user_id || !blook_id) return Response.json({ error: 'Missing fields' }, { status: 400 });
    const qty = Math.max(1, Math.min(1000000, quantity || 1));
    if (receiver_user_id === user.id) return Response.json({ error: 'Cannot gift to yourself' }, { status: 400 });

    const svc = base44.asServiceRole;

    const senderProfiles = await svc.entities.PlayerProfile.filter({ user_id: user.id });
    const senderProfile = senderProfiles[0];
    if (!senderProfile) return Response.json({ error: 'Profile not found' }, { status: 404 });
    if (senderProfile.is_banned) return Response.json({ error: 'Account banned' }, { status: 403 });

    const receiverProfiles = await svc.entities.PlayerProfile.filter({ user_id: receiver_user_id });
    if (!receiverProfiles[0]) return Response.json({ error: 'Recipient not found' }, { status: 404 });

    const senderBlooks = await svc.entities.PlayerBlook.filter({ user_id: user.id, blook_id });
    const senderRec = senderBlooks[0];
    if (!senderRec) return Response.json({ error: 'You do not own this blook' }, { status: 400 });

    if (is_shiny) {
      if ((senderRec.shiny_quantity || 0) < qty) return Response.json({ error: 'Insufficient shiny quantity' }, { status: 400 });
    } else {
      if ((senderRec.quantity || 0) < qty) return Response.json({ error: 'Insufficient quantity' }, { status: 400 });
    }

    const blook = await svc.entities.Blook.get(blook_id);

    // Spooky Month event blooks are exclusive seed rewards — never giftable.
    if (blook && blook.pack_id === SPOOKY_PACK_ID) {
      return Response.json({ error: 'SPOOKY MONTH event blooks cannot be gifted' }, { status: 400 });
    }

    // Admin-restricted blooks (Hivelands, PAC3, Summer, Golden, Spooky, trophies, etc.)
    // cannot be gifted by anyone — they must be earned through their intended systems.
    if (blook) {
      const packs = await svc.entities.Pack.filter({});
      if (isBlookAdminRestricted(blook, buildPackMap(packs))) {
        return Response.json({ error: `${blook.name} cannot be gifted — it's an exclusive reward` }, { status: 400 });
      }
    }

    const game = senderRec.game || 'icecreamet';

    if (is_shiny) {
      const newSq = (senderRec.shiny_quantity || 0) - qty;
      if (newSq <= 0 && (senderRec.quantity || 0) <= 0) await svc.entities.PlayerBlook.delete(senderRec.id);
      else await svc.entities.PlayerBlook.update(senderRec.id, { shiny_quantity: Math.max(0, newSq) });
    } else {
      const newQty = (senderRec.quantity || 0) - qty;
      if (newQty <= 0 && (senderRec.shiny_quantity || 0) <= 0) await svc.entities.PlayerBlook.delete(senderRec.id);
      else await svc.entities.PlayerBlook.update(senderRec.id, { quantity: Math.max(0, newQty) });
    }

    const receiverBlooks = await svc.entities.PlayerBlook.filter({ user_id: receiver_user_id, blook_id });
    const receiverRec = receiverBlooks[0];
    if (receiverRec) {
      if (is_shiny) {
        await svc.entities.PlayerBlook.update(receiverRec.id, { shiny_quantity: (receiverRec.shiny_quantity || 0) + qty });
      } else {
        await svc.entities.PlayerBlook.update(receiverRec.id, { quantity: (receiverRec.quantity || 0) + qty });
      }
    } else {
      await svc.entities.PlayerBlook.create({
        user_id: receiver_user_id, blook_id,
        quantity: is_shiny ? 0 : qty,
        shiny_quantity: is_shiny ? qty : 0,
        game
      });
    }

    await svc.entities.Notification.create({
      user_id: receiver_user_id, type: 'gift_received',
      title: '🎁 Blook Gift!',
      message: `${senderProfile.username} gifted you ${qty}× ${blook?.name || 'a blook'}${is_shiny ? ' ✨' : ''}!`,
      link: '/blooks'
    }).catch(() => {});

    return Response.json({ ok: true, blook_name: blook?.name, quantity: qty });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}