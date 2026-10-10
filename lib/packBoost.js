import { base44 } from '@/api/base44Client';

// Boosters stack multiplicatively: each active booster contributes a 2x
// multiplier. Two boosters = 4x, three = 8x, etc. The personal luck booster
// (luck_booster_until on PlayerProfile) also stacks with global boosters.
export const getActiveBoost = async () => {
  const settings = await base44.entities.GameSettings.filter({ key: 'pack_boost' });
  if (!settings.length) return null;
  try {
    const boosts = JSON.parse(settings[0].value);
    const now = new Date();
    const active = Array.isArray(boosts) ? boosts.filter(b => b.end_time && new Date(b.end_time) > now) : [];
    if (active.length === 0) return null;
    const multiplier = 2 * active.length;
    const earliestEnd = active.map(b => new Date(b.end_time)).sort((a, b) => a - b)[0];
    return { multiplier, end_time: earliestEnd.toISOString(), count: active.length, id: settings[0].id };
  } catch (e) {
    return null;
  }
};

export const setBoost = async (boosterUsername, durationMs = 1800000) => {
  const settings = await base44.entities.GameSettings.filter({ key: 'pack_boost' });
  const now = new Date();
  const newBoost = { booster_username: boosterUsername, multiplier: 2, end_time: new Date(Date.now() + durationMs).toISOString() };
  if (settings.length) {
    let existing = [];
    try { existing = JSON.parse(settings[0].value); } catch (e) {}
    const active = Array.isArray(existing) ? existing.filter(b => b.end_time && new Date(b.end_time) > now) : [];
    const updated = [...active, newBoost];
    return base44.entities.GameSettings.update(settings[0].id, { value: JSON.stringify(updated) });
  }
  return base44.entities.GameSettings.create({ key: 'pack_boost', value: JSON.stringify([newBoost]), category: 'general' });
};