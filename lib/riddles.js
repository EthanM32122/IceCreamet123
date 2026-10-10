import { base44 } from '@/api/base44Client';

export const RIDDLE_MULTIPLIERS = { easy: 2, medium: 3, hard: 5 };
export const RIDDLE_REWARDS = { easy: 75, medium: 150, hard: 300 };

export const RIDDLES = {
  easy: [
    { q: 'I have hands but cannot clap. What am I?', a: 'clock' },
    { q: 'What has four legs but cannot walk?', a: 'table' },
    { q: 'What goes up but never comes down?', a: 'age' },
    { q: "I'm tall when I'm young and short when I'm old. What am I?", a: 'candle' },
    { q: 'What gets wetter the more it dries?', a: 'towel' },
    { q: 'What has a neck but no head?', a: 'bottle' },
    { q: 'What has an eye but cannot see?', a: 'needle' },
    { q: 'I follow you all day but when night falls I go away. What am I?', a: 'shadow' },
    { q: 'I show you things but I cannot see. What am I?', a: 'mirror' },
    { q: 'I have teeth but cannot bite. What am I?', a: 'comb' }
  ],
  medium: [
    { q: "I speak without a mouth and hear without ears. I have no body but come alive with the wind. What am I?", a: 'echo' },
    { q: 'The more you take, the more you leave behind. What are they?', a: 'footsteps' },
    { q: 'What can travel around the world while staying in a corner?', a: 'stamp' },
    { q: 'What has cities but no houses, forests but no trees, and water but no fish?', a: 'map' },
    { q: 'What is full of holes but still holds water?', a: 'sponge' },
    { q: 'I am not alive but I have five fingers. What am I?', a: 'glove' },
    { q: "What has many keys but can't open a single lock?", a: 'piano' },
    { q: 'I have colors but no paint, I appear after rain but I am not water. What am I?', a: 'rainbow' },
    { q: 'I go up when rain comes down. What am I?', a: 'umbrella' },
    { q: 'If you share me I no longer exist. What am I?', a: 'secret' }
  ],
  hard: [
    { q: "The man who invented it doesn't want it. The man who bought it doesn't need it. The man who needs it doesn't know it. What is it?", a: 'coffin' },
    { q: 'What can run but never walks, has a mouth but never talks, has a head but never weeps, has a bed but never sleeps?', a: 'river' },
    { q: 'I have no eyes, but once I did see. I once had thoughts, but now I am white and empty. What am I?', a: 'skull' },
    { q: 'What does man love more than life, fear more than death? The poor have it, the rich need it. What is it?', a: 'nothing' },
    { q: 'Forward I am heavy, but backward I am not. What am I?', a: 'ton' },
    { q: 'I am a word of letters three; add two letters and fewer there will be. What word am I?', a: 'few' },
    { q: 'The more of me you have, the less you see. What am I?', a: 'darkness' },
    { q: 'I can be broken without being held. What am I?', a: 'promise' },
    { q: 'Feed me and I live, give me drink and I die. What am I?', a: 'fire' },
    { q: 'I have no beginning, end, or middle. What am I?', a: 'donut' }
  ]
};

export function pickRiddle(difficulty) {
  const pool = RIDDLES[difficulty] || RIDDLES.easy;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function normalizeAnswer(s) {
  return (s || '').toLowerCase().trim()
    .replace(/^(a|an|the)\s+/, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function getActiveRiddle() {
  const active = await base44.entities.GameSettings.filter({ key: 'riddle_answer' });
  if (!active[0]?.value) return null;
  try { return JSON.parse(active[0].value); } catch (e) { return null; }
}

export async function clearRiddle() {
  const active = await base44.entities.GameSettings.filter({ key: 'riddle_answer' });
  if (active.length > 0) await base44.entities.GameSettings.update(active[0].id, { value: '' });
}