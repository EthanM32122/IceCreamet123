import { base44 } from '@/api/base44Client';

export async function getActiveInstGtb() {
  const rows = await base44.entities.GameSettings.filter({ key: 'instgtb' });
  if (!rows[0] || !rows[0].value) return null;
  try { return JSON.parse(rows[0].value); } catch { return null; }
}

export async function setActiveInstGtb(blook) {
  const payload = JSON.stringify({
    blook_id: blook.id,
    name: blook.name,
    image_url: blook.image_url || '',
    started_at: Date.now()
  });
  const rows = await base44.entities.GameSettings.filter({ key: 'instgtb' });
  if (rows[0]) await base44.entities.GameSettings.update(rows[0].id, { value: payload });
  else await base44.entities.GameSettings.create({ key: 'instgtb', value: payload, category: 'general' });
  return JSON.parse(payload);
}