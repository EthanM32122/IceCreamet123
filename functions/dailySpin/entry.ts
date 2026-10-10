import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  SPIN_PRIZES, SPIN_COOLDOWN_MS, enforceCaps, publicProfile
} from '../../shared/economy.ts';

// Hourly token spin. The server checks the cooldown, rolls the prize, and
// grants the tokens — the client cannot spin early or fabricate a reward.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;
    let profile = await getProfileSafe(svc, user.id);
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });
    if (profile.is_banned) return Response.json({ error: 'Account banned' }, { status: 403 });

    // Check cooldown (server-side, never trust client-sent time)
    if (profile.last_spin_time) {
      const elapsed = Date.now() - new Date(profile.last_spin_time).getTime();
      if (elapsed < SPIN_COOLDOWN_MS) {
        return Response.json({ error: 'Cooldown active', status: 400 });
      }
    }

    // Roll the prize
    const prize = SPIN_PRIZES[Math.floor(Math.random() * SPIN_PRIZES.length)];

    // Grant tokens + update spin time
    profile = await svc.entities.PlayerProfile.update(profile.id, {
      tokens: (profile.tokens || 0) + prize,
      last_spin_time: new Date().toISOString()
    });

    profile = await enforceCaps(svc, profile);

    return Response.json({
      ok: true,
      prize,
      profile: publicProfile(profile)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function getProfileSafe(svc, userId) {
  const profiles = await svc.entities.PlayerProfile.filter({ user_id: userId });
  return profiles[0] || null;
}