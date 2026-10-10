import { base44 } from '@/api/base44Client';
import { TROPHY_BLOOKS, VERIFIED_BADGE_ID, ICECREAMETUBER_BADGE_ID, ARTIST_BADGE_ID } from '@/lib/constants';

// Checks a player's eligibility for the four award trophies and grants any
// they've earned but don't yet own. Safe to call repeatedly — it skips trophies
// the player already has.
export async function checkAndGrantTrophies(profile) {
  if (!profile) return;
  try {
    const [myBlooks, myBadges] = await Promise.all([
      base44.entities.PlayerBlook.filter({ user_id: profile.user_id }),
      base44.entities.PlayerBadge.filter({ user_id: profile.user_id })
    ]);
    const ownedBlookIds = new Set(myBlooks.map(b => b.blook_id));
    const myBadgeIds = new Set(myBadges.map(b => b.badge_id));

    const toGrant = [];

    // Verified Trophy — owns the Verified badge
    if (myBadgeIds.has(VERIFIED_BADGE_ID) && !ownedBlookIds.has(TROPHY_BLOOKS.verified)) {
      toGrant.push(TROPHY_BLOOKS.verified);
    }
    // Icecreametuber Trophy — owns the Icecreametuber badge
    if (myBadgeIds.has(ICECREAMETUBER_BADGE_ID) && !ownedBlookIds.has(TROPHY_BLOOKS.icecreametuber)) {
      toGrant.push(TROPHY_BLOOKS.icecreametuber);
    }
    // Artist Trophy — owns the Artist badge
    if (myBadgeIds.has(ARTIST_BADGE_ID) && !ownedBlookIds.has(TROPHY_BLOOKS.artist)) {
      toGrant.push(TROPHY_BLOOKS.artist);
    }
    // Blook Trophy — owns 350 distinct blooks
    if (!ownedBlookIds.has(TROPHY_BLOOKS.blook) && ownedBlookIds.size >= 350) {
      toGrant.push(TROPHY_BLOOKS.blook);
    }

    if (toGrant.length > 0) {
      await base44.entities.PlayerBlook.bulkCreate(
        toGrant.map(blook_id => ({ user_id: profile.user_id, blook_id, quantity: 1 }))
      );
    }
  } catch (e) {
    console.error('Trophy award check failed', e);
  }
}