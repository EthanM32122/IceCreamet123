import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { waitUntil } from 'base44:runtime';
import { enforceCaps, publicProfile } from '../../shared/economy.ts';

// Handles giveaway operations: create, enter, and draw winners.
// All prize funding and distribution is server-side.
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
      case 'create': {
        const { title, description, prize_type, blook_id, token_amount, num_winners, giveaway_type, duration_ms } = body;
        if (!title || !title.trim()) return Response.json({ error: 'Title required' }, { status: 400 });
        const numWinners = Math.max(1, parseInt(num_winners) || 1);
        const duration = parseInt(duration_ms) || 86400000;

        let giveBlookId = '', giveBlookName = '', giveBlookImage = '';
        let giveTokenAmount = 0;

        if (prize_type === 'tokens') {
          giveTokenAmount = parseInt(token_amount) || 0;
          if (giveTokenAmount <= 0) return Response.json({ error: 'Invalid token amount' }, { status: 400 });
          if ((profile.tokens || 0) < giveTokenAmount) return Response.json({ error: 'Insufficient funds' }, { status: 400 });
          // Deduct tokens from creator
          profile = await svc.entities.PlayerProfile.update(profile.id, {
            tokens: profile.tokens - giveTokenAmount
          });
        } else if (prize_type === 'blook') {
          if (!blook_id) return Response.json({ error: 'Missing blook_id' }, { status: 400 });
          // Validate ownership
          const records = await svc.entities.PlayerBlook.filter({ user_id: user.id, blook_id, game: 'icecreamet' });
          if (records.length === 0 || (records[0].quantity || 0) < 1) {
            return Response.json({ error: 'You do not own this blook' }, { status: 400 });
          }
          const blook = await svc.entities.Blook.get(blook_id);
          if (!blook) return Response.json({ error: 'Blook not found' }, { status: 404 });
          giveBlookId = blook_id;
          giveBlookName = blook.name;
          giveBlookImage = blook.image_url || '';
          // Remove blook from creator
          const rem = (records[0].quantity || 0) - 1;
          if (rem <= 0 && (records[0].shiny_quantity || 0) <= 0) await svc.entities.PlayerBlook.delete(records[0].id);
          else await svc.entities.PlayerBlook.update(records[0].id, { quantity: Math.max(0, rem) });
        } else {
          return Response.json({ error: 'Invalid prize type' }, { status: 400 });
        }

        const giveaway = await svc.entities.Giveaway.create({
          creator_id: user.id, creator_username: profile.username,
          creator_avatar: profile.avatar_url || '',
          title: title.trim(), description: (description || '').trim(),
          prize_type, blook_id: giveBlookId, blook_name: giveBlookName,
          blook_image_url: giveBlookImage, token_amount: giveTokenAmount,
          num_winners: numWinners, giveaway_type: giveaway_type || 'random_winner',
          status: 'active', end_time: new Date(Date.now() + duration).toISOString(),
          entries: '[]', winners: '[]'
        });

        profile = await enforceCaps(svc, profile);
        return Response.json({ ok: true, giveaway, profile: publicProfile(profile) });
      }

      case 'enter': {
        const { giveaway_id } = body;
        if (!giveaway_id) return Response.json({ error: 'Missing giveaway_id' }, { status: 400 });

        const giveaway = await svc.entities.Giveaway.get(giveaway_id);
        if (!giveaway || giveaway.status !== 'active') return Response.json({ error: 'Giveaway not active' }, { status: 400 });
        if (giveaway.end_time && new Date(giveaway.end_time).getTime() < Date.now()) {
          return Response.json({ error: 'Giveaway ended' }, { status: 400 });
        }
        if (giveaway.creator_id === user.id) return Response.json({ error: 'Cannot enter your own giveaway' }, { status: 400 });

        const entries = JSON.parse(giveaway.entries || '[]');
        if (entries.includes(user.id)) return Response.json({ error: 'Already entered' }, { status: 400 });

        entries.push(user.id);
        await svc.entities.Giveaway.update(giveaway_id, { entries: JSON.stringify(entries) });
        return Response.json({ ok: true });
      }

      case 'draw': {
        const { giveaway_id } = body;
        if (!giveaway_id) return Response.json({ error: 'Missing giveaway_id' }, { status: 400 });

        const giveaway = await svc.entities.Giveaway.get(giveaway_id);
        if (!giveaway) return Response.json({ error: 'Giveaway not found' }, { status: 404 });
        if (giveaway.status !== 'active') return Response.json({ error: 'Giveaway not active' }, { status: 400 });
        if (giveaway.creator_id !== user.id) return Response.json({ error: 'Only the creator can draw' }, { status: 403 });
        if (giveaway.end_time && new Date(giveaway.end_time).getTime() >= Date.now()) {
          return Response.json({ error: 'Giveaway not ended yet' }, { status: 400 });
        }

        const entries = JSON.parse(giveaway.entries || '[]');
        if (entries.length === 0) return Response.json({ error: 'No entries to draw from' }, { status: 400 });

        // Pick winners
        const pool = [...entries];
        const count = Math.min(giveaway.num_winners || 1, pool.length);
        const picked = [];
        for (let i = 0; i < count; i++) picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);

        // Get winner profiles
        const winnerProfiles = [];
        for (const uid of picked) {
          const ps = await svc.entities.PlayerProfile.filter({ user_id: uid });
          if (ps[0]) winnerProfiles.push(ps[0]);
        }

        // Distribute prizes
        if (giveaway.prize_type === 'tokens') {
          const amount = giveaway.token_amount || 0;
          for (const wp of winnerProfiles) {
            await svc.entities.PlayerProfile.update(wp.id, { tokens: (wp.tokens || 0) + amount });
          }
        } else if (giveaway.blook_id) {
          for (const wp of winnerProfiles) {
            const existing = await svc.entities.PlayerBlook.filter({ user_id: wp.user_id, blook_id: giveaway.blook_id, game: 'icecreamet' });
            if (existing[0]) await svc.entities.PlayerBlook.update(existing[0].id, { quantity: (existing[0].quantity || 0) + 1 });
            else await svc.entities.PlayerBlook.create({ user_id: wp.user_id, blook_id: giveaway.blook_id, quantity: 1, game: 'icecreamet' });
          }
        }

        const winnersData = winnerProfiles.map(wp => ({ user_id: wp.user_id, username: wp.username }));
        await svc.entities.Giveaway.update(giveaway_id, { status: 'completed', winners: JSON.stringify(winnersData) });

        // Announce in chat (fire-and-forget)
        waitUntil(svc.entities.ChatMessage.create({
          content: `🎉 Giveaway "${giveaway.title}" ended! Winner${winnersData.length !== 1 ? 's' : ''}: ${winnersData.map(w => w.username).join(', ')}`,
          username: 'Giveaway Bot', is_system: true, user_role: 'admin', game: 'icecreamet'
        }).catch(() => {}));

        return Response.json({ ok: true, winners: winnersData });
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