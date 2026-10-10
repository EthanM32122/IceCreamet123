import claimSpookyPrize from '@/lib/claimSpookyPrize';

// SPOOKY MONTH event — client mirror of base44/shared/spookyEvent.ts
export const SPOOKY_PACK_ID = '6abdc8898281b760c964c249';

// Month-long event window (America/New_York local times).
export const EVENT_START = new Date('2026-09-30T00:00:00-04:00').getTime();
export const EVENT_END = new Date('2026-11-01T00:00:00-04:00').getTime();

export const SPAWN_INTERVAL = 30 * 60 * 1000; // spawn every 30 minutes
export const SEEDS_PER_SPAWN = 10;
export const SPAWN_UP_TIME = 20000; // seeds stay on screen & clickable for 20 seconds

export const SPOOKY_PRIZES = [
  { name: 'UndeadKoala', seeds: 35 },
  { name: 'Mummy Cat', seeds: 50 },
  { name: 'Zombie Horse', seeds: 85 },
  { name: 'Pickle Monster', seeds: 120 },
  { name: 'Poisonous Spider', seeds: 150 },
  { name: 'Drunkee The Egg', seeds: 300 },
  { name: '... The Egg', seeds: 400 },
  { name: 'Supa Kool Kat In The Hat', seeds: 500 },
  { name: 'Werewolf Minti', seeds: 750 },
  { name: 'Haunted Graveyard', seeds: 1000 },
  { name: 'Skid And Pump', seeds: 2000 }
];

export function isEventLive() {
  const now = Date.now();
  return now >= EVENT_START && now <= EVENT_END;
}

// Milliseconds until the next aligned 30-minute spawn boundary.
export function msToNextSpawn(now = Date.now()) {
  const boundary = now + (SPAWN_INTERVAL - (now % SPAWN_INTERVAL));
  return boundary - now;
}

export function parseClaimed(profile) {
  try {
    const arr = JSON.parse(profile?.claimed_spooky_prizes || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// Prizes the player has enough seeds for but hasn't claimed yet.
export function eligibleNewPrizes(seeds, claimed) {
  return SPOOKY_PRIZES.filter(p => !claimed.includes(p.name) && seeds >= p.seeds);
}

export async function claimPrize(prizeName) {
  return claimSpookyPrize(prizeName);
}

// Owner-managed prizes live in the SpookyPrize entity. Returns the hardcoded
// SPOOKY_PRIZES as a fallback when the entity read fails or is empty, so the
// event page always has something to show.
export async function loadPrizes() {
  try {
    const { base44 } = await import('@/api/base44Client');
    const page = await base44.entities.SpookyPrize.filter(
      { active: true },
      { sort: 'seeds', limit: 500, fields: ['name', 'seeds', 'blook_id', 'order'] }
    );
    const rows = page.items || [];
    if (rows.length > 0) {
      return rows
        .map(r => ({ name: r.name, seeds: r.seeds, id: r.id }))
        .sort((a, b) => a.seeds - b.seeds);
    }
  } catch {}
  return SPOOKY_PRIZES;
}