import { base44 } from '@/api/base44Client';
import { SPOOKY_PACK_ID, SPOOKY_PRIZES, parseClaimed, eligibleNewPrizes } from '@/lib/spookyEvent';

let pending = Promise.resolve();

async function savePrizeClaim(prizeName) {
  const user = await base44.auth.me();
  const { items: profiles } = await base44.entities.PlayerProfile.filter({ user_id: user.id }, { limit: 1 });
  const profile = profiles[0];
  if (!profile) throw new Error('Player profile not found.');
  if (profile.is_banned) throw new Error('Banned accounts cannot claim prizes.');
  const claimed = parseClaimed(profile);
  const eligible = eligibleNewPrizes(profile.pumpkin_seeds || 0, claimed);
  if (prizeName && !SPOOKY_PRIZES.some(p => p.name === prizeName)) throw new Error('Unknown prize.');
  if (prizeName && !claimed.includes(prizeName) && !eligible.some(p => p.name === prizeName)) throw new Error('You have not collected enough seeds for this prize.');
  const targets = prizeName ? eligible.filter(p => p.name === prizeName) : eligible;
  if (!targets.length) return { ok: true, claimed, prizes: [] };
  const { items: blooks } = await base44.entities.Blook.filter({
    pack_id: SPOOKY_PACK_ID, game: 'icecreamet', is_deleted: false,
    name: { $in: targets.map(p => p.name) }
  }, { limit: SPOOKY_PRIZES.length });
  if (targets.some(p => !blooks.some(b => b.name === p.name))) throw new Error('A prize blook is missing from the event pack.');
  const { items: owned } = await base44.entities.PlayerBlook.filter({
    user_id: user.id, game: 'icecreamet', blook_id: { $in: blooks.map(b => b.id) }
  }, { limit: SPOOKY_PRIZES.length });
  // Reconcile existing exclusive prizes after a partially completed claim,
  // rather than granting another copy when the profile save is retried.
  const missing = blooks.filter(b => !owned.some(o => o.blook_id === b.id));
  if (missing.length) await base44.entities.PlayerBlook.bulkCreate(missing.map(b => ({
    user_id: user.id, blook_id: b.id, quantity: 1, shiny_quantity: 0, game: 'icecreamet'
  })));
  const empty = owned.filter(o => !(o.quantity > 0));
  if (empty.length) await base44.entities.PlayerBlook.bulkUpdate(empty.map(o => ({ id: o.id, quantity: 1 })));
  const nextClaimed = [...new Set([...claimed, ...targets.map(p => p.name)])];
  await base44.entities.PlayerProfile.update(profile.id, { claimed_spooky_prizes: JSON.stringify(nextClaimed) });
  const prizes = blooks.map(({ name, rarity, image_url }) => ({ name, rarity, image_url }));
  return { ok: true, claimed: nextClaimed, prizes, prize: prizes.length === 1 ? prizes[0] : null };
}

export default function claimSpookyPrize(prizeName) {
  const run = () => navigator.locks
    ? navigator.locks.request('icecreamet-spooky-prize-claim', () => savePrizeClaim(prizeName))
    : savePrizeClaim(prizeName);
  const result = pending.then(run, run);
  pending = result.catch(() => {});
  return result;
}