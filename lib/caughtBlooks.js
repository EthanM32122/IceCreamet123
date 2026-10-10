// Bonus-token rewards for catching jumping blooks on the auth pages.
// Caught blooks are stored in localStorage so logged-out users can catch
// them and redeem the bonus once they sign in.

const STORAGE_KEY = 'icecreamet_caught_blooks';

export const CATCH_REWARDS = {
  uncommon: 5,
  rare: 10,
  epic: 20,
  legendary: 50,
  mythical: 75,
  chroma: 100,
  supreme: 150,
  iridescent: 200,
  unique: 250,
  icecreamacle: 300,
  paradox: 500
};

export const getCatchReward = (rarity) => CATCH_REWARDS[rarity] || 5;

export const catchBlook = (blook) => {
  const reward = getCatchReward(blook.rarity);
  const entry = {
    blook_id: blook.id,
    name: blook.name,
    rarity: blook.rarity,
    reward
  };
  try {
    const existing = getCaughtBlooks();
    existing.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch (e) { /* ignore */ }
  return reward;
};

export const getCaughtBlooks = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (e) {
    return [];
  }
};

export const clearCaughtBlooks = () => {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
};