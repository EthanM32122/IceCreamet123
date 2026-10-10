import { base44 } from '@/api/base44Client';

/**
 * Awards XP to the clan a user belongs to, using the same leveling
 * formula as pack opening (each level needs level * 500 XP).
 * Returns info about the result, or null if the user is not in a clan.
 */
export async function awardClanXp(userId, xpAmount) {
  if (!userId || !xpAmount || xpAmount <= 0) return null;
  const memberships = await base44.entities.ClanMember.filter({ user_id: userId });
  if (memberships.length === 0) return null;
  const clan = await base44.entities.Clan.get(memberships[0].clan_id);
  if (!clan) return null;
  const oldLevel = clan.level || 1;
  let clanXP = (clan.xp || 0) + xpAmount;
  let clanLevel = oldLevel;
  while (clanXP >= clanLevel * 500) {
    clanXP -= clanLevel * 500;
    clanLevel++;
  }
  await base44.entities.Clan.update(clan.id, { level: clanLevel, xp: clanXP });
  return {
    clanName: clan.name,
    xpGained: xpAmount,
    leveledUp: clanLevel > oldLevel,
    newLevel: clanLevel
  };
}