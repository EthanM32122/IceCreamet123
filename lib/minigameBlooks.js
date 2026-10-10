import { base44 } from '@/api/base44Client';

const cache = {};

export async function getBlooksByPackNames(namePatterns) {
  const key = [...namePatterns].sort().join(',');
  if (cache[key]) return cache[key];

  try {
    const packs = await base44.entities.Pack.filter({ game: 'icecreamet' });
    const lower = namePatterns.map((n) => n.toLowerCase());
    const packIds = packs
      .filter((p) => lower.some((pat) => (p.name || '').toLowerCase().includes(pat)))
      .map((p) => p.id);
    if (packIds.length === 0) return [];

    const allBlooks = await base44.entities.Blook.filter(
      { is_active: true, is_deleted: false, game: 'icecreamet' },
      null,
      2000
    );
    const blooks = allBlooks.filter((b) => packIds.includes(b.pack_id) && b.image_url);
    cache[key] = blooks;
    return blooks;
  } catch (e) {
    return [];
  }
}

export function randomBlookUrl(blooks) {
  if (!blooks || blooks.length === 0) return null;
  return blooks[Math.floor(Math.random() * blooks.length)].image_url;
}