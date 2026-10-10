// Hourly token rates for mined blooks — escalates by rarity
export const MINES_HOURLY_RATES = {
  uncommon: 10,
  rare: 25,
  epic: 60,
  legendary: 150,
  chroma: 300,
  supreme: 500,
  mythical: 1000,
  iridescent: 2000,
  unique: 3000,
  icecreamacle: 5000,
  paradox: 10000
};

export const getHourlyRate = (rarity) => MINES_HOURLY_RATES[rarity] || 10;