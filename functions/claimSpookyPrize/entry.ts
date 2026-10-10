import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { SPOOKY_PACK_ID, SPOOKY_PRIZES } from '../../shared/spookyEvent.ts';

// Owner-managed prizes live in the SpookyPrize entity. If none are configured
// (or the read fails), fall back to the hardcoded list so the event still works.
async function loadPrizes(svc) {
  try {
    const page = await svc.entities.SpookyPrize.filter(
      { active: true },
      { sort: 'seeds', limit: 500, fields: ['name', 'seeds'] }
    );
    const rows = page.items || [];
    if (rows.length > 0) {
      return rows.map(r => ({ name: r.name, seeds: r.seeds }));
    }
  } catch {}
  return SPOOKY_PRIZES;
}

// Reconcile endpoint for the SPOOKY MONTH event.
// - With `prizeName`: claims exactly that one prize (back-compat with the manual claim button).
// - Without `prizeName`: idempotently claims EVERY prize the player has enough seeds for.
// Eligibility is always recomputed from the authoritative profile on the server,
// so the client can safely call this once per session / per collection to grant
// everything earned. Because it batches, it uses far fewer entity ops than the
// old per-click loop, which keeps it well under the app's read-traffic budget.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const prizeName = body?.prizeName || null;

    // Authoritative profile — never trust client-sent seed counts.
    const profiles = await svc.entities.PlayerProfile.filter({ user_id: user.id });
    const profile = profiles[0];
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });
    if (profile.is_banned) return Response.json({ error: 'Account banned' }, { status: 403 });

    const seeds = profile.pumpkin_seeds || 0;

    let claimed = [];
    try { claimed = JSON.parse(profile.claimed_spooky_prizes || '[]'); } catch {}

    // Resolve the prizes to claim. Owner-managed prizes take priority; the
    // hardcoded list is only a fallback when none are configured.
    const PRIZES = await loadPrizes(svc);
    let targets;
    if (prizeName) {
      const prize = PRIZES.find(p => p.name === prizeName);
      if (!prize) return Response.json({ error: 'Unknown prize' }, { status: 400 });
      targets = [prize];
    } else {
      // All prizes the player has enough seeds for but hasn't claimed yet.
      targets = PRIZES.filter(p => seeds >= p.seeds && !claimed.includes(p.name));
    }

    if (targets.length === 0) {
      return Response.json({ ok: true, claimed: claimed, prizes: [] });
    }

    // Load the event blooks once for the whole batch.
    const blooksPage = await svc.entities.Blook.filter({
      pack_id: SPOOKY_PACK_ID, is_deleted: false, game: 'icecreamet'
    }, { limit: 500, fields: ['id', 'name', 'rarity', 'image_url'] });
    const blookByKey = {};
    for (const b of blooksPage.items) blookByKey[b.name] = b;

    const granted = [];
    for (const prize of targets) {
      if (claimed.includes(prize.name)) continue;
      const blook = blookByKey[prize.name];
      if (!blook) continue;

      // Grant the blook (create or increment quantity, exactly one copy).
      const existing = await svc.entities.PlayerBlook.filter({
        user_id: user.id, blook_id: blook.id, game: 'icecreamet'
      });
      if (existing[0]) {
        await svc.entities.PlayerBlook.update(existing[0].id, { quantity: (existing[0].quantity || 0) + 1 });
      } else {
        await svc.entities.PlayerBlook.create({
          user_id: user.id, blook_id: blook.id, quantity: 1, shiny_quantity: 0, game: 'icecreamet'
        });
      }
      claimed.push(prize.name);
      granted.push({ name: blook.name, rarity: blook.rarity, image_url: blook.image_url });
    }

    // Persist the claimed list once per batch. Never drain seeds — the
    // leaderboard counts lifetime seeds.
    if (granted.length > 0) {
      await svc.entities.PlayerProfile.update(profile.id, { claimed_spooky_prizes: JSON.stringify(claimed) });
    }

    return Response.json({
      ok: true,
      // Single-prize call returns the granted prize under `.prize` for back-compat.
      prize: granted.length === 1 ? granted[0] : null,
      prizes: granted,
      claimed: claimed
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}