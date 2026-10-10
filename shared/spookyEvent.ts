// SPOOKY MONTH event — shared by the claim backend function and (mirrored in
// src/lib/spookyEvent.js for the client). Prize thresholds + rarity reference.

export const SPOOKY_PACK_ID = '6abdc8898281b760c964c249';

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

// Smallest seed count before the first prize, used to short-circuit the
// leaderboard/prize queries when a player has nothing collected.
export const SPOOKY_FIRST_PRIZE = 35;