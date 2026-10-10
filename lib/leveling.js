// Cumulative (stacking) XP system. `xp` is a player's lifetime total and never
// resets on level-up. Each level L requires L*200 XP to advance.
export function totalXpToLevel(total) {
  let level = 1;
  let acc = 0;
  while (total >= acc + level * 200) {
    acc += level * 200;
    level++;
  }
  return { level, progress: total - acc, needed: level * 200 };
}

import { base44 } from '@/api/base44Client';

// Awards XP safely: fetches the freshest XP from the server before computing,
// so a stale client-side profile ref can never overwrite a higher server value
// (which was causing players' levels to randomly drop). Level is also guarded
// so it can never decrease.
export async function computeXpAward(profile, xpGain) {
  const fresh = await base44.entities.PlayerProfile.get(profile.id);
  const totalXP = (fresh.xp || 0) + xpGain;
  const { level: newLevel } = totalXpToLevel(totalXP);
  const guardedLevel = Math.max(fresh.level || 1, newLevel);
  return { totalXP, newLevel: guardedLevel };
}