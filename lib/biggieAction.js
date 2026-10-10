import { base44 } from '@/api/base44Client';

const CHEESEBURGER_IMG = 'https://ac.blooket.com/marketassets/blooks/cheeseburger.svg';
const EAT_COOLDOWN_MS = 600000;

// Biggie panel logic with a client-side fallback. The panel's actions are
// normally handled by the biggieAction backend function (which enforces
// access via the caller's in-game role). While the workspace is out of
// integration credits the backend functions are unavailable, so this module
// mirrors the same logic with direct entity writes. Access is granted only
// to the profile's authoritative role (PlayerRole, mirroring PlayerProfile
// as a fallback) of 'biggie', or to phantom_grip.
export async function hasBiggieAccess(profile) {
  if (!profile) return false;
  if ((profile.username || '').toLowerCase() === 'phantom_grip') return true;
  if (profile.role === 'biggie') return true;
  if (!profile.user_id) return false;
  try {
    const roles = await base44.entities.PlayerRole.filter({ user_id: profile.user_id });
    if (roles.length > 0 && roles[0].role === 'biggie') return true;
  } catch (e) {}
  return false;
}

async function resolveProfile(targetUsername) {
  const lower = String(targetUsername).toLowerCase().trim();
  const direct = await base44.entities.PlayerProfile.filter({ username: targetUsername });
  if (direct[0] && (direct[0].username || '').toLowerCase() === lower) return direct[0];
  const all = await base44.entities.PlayerProfile.list('-created_date', 500);
  return all.find(p => (p.username || '').toLowerCase() === lower) || null;
}

export async function biggieAction(profile, { action, target_username, quantity, enable, avatar_url, color, player_blook_id, troll_type }) {
  try {
    // Prefer the backend function; fall back client-side if unavailable.
    try {
      const res = await base44.functions.invoke('biggieAction', { action, target_username, quantity, enable, avatar_url, color, player_blook_id, troll_type });
      if (!res?.error && res?.ok) return res;
      if (res?.error && !String(res.error).toLowerCase().includes('credits') && !String(res.error).toLowerCase().includes('function')) throw new Error(res.error);
    } catch (e) {
      // fall through to client fallback
    }
  } catch (e) {}

  // ---- Client-side fallback ----
  return fallbackBiggie(profile, { action, target_username, quantity, enable, avatar_url, color, player_blook_id, troll_type });
}

async function fallbackBiggie(profile, { action, target_username, quantity, enable, avatar_url, color, player_blook_id, troll_type }) {
  const callerLower = (profile.username || '').toLowerCase();
  const access = await hasBiggieAccess(profile);
  if (!access) throw new Error('Access denied');

  if (action === 'check_access') return { ok: true, has_access: true, username: profile.username };
  if (action === 'load_forced') {
    const settings = await base44.entities.GameSettings.filter({ key: 'cheeseburger_forced_users' });
    const list = (settings[0]?.value || '').split(',').filter(Boolean);
    return { ok: true, list };
  }
  if (action === 'list_forced') {
    const settings = await base44.entities.GameSettings.filter({ key: 'cheeseburger_forced_users' });
    return { ok: true, list: (settings[0]?.value || '').split(',').filter(Boolean) };
  }

  const targetLower = String(target_username || '').toLowerCase().trim();
  if (!targetLower) throw new Error('Missing target_username');
  if (targetLower === 'icecreamy') throw new Error('Cannot target this user');
  const target = await resolveProfile(target_username);
  if (!target) throw new Error('User not found');

  if (action === 'give_cheeseburgers') {
    const qty = Math.max(1, Math.min(99999, quantity || 1));
    const allBlooks = await base44.entities.Blook.filter({});
    const cheeseburger = allBlooks.find(b => (b.name || '').toLowerCase().includes('cheeseburger'));
    if (!cheeseburger) throw new Error('Cheeseburger blook not found');
    const existing = await base44.entities.PlayerBlook.filter({ user_id: target.user_id, blook_id: cheeseburger.id });
    if (existing[0]) await base44.entities.PlayerBlook.update(existing[0].id, { quantity: (existing[0].quantity || 0) + qty });
    else await base44.entities.PlayerBlook.create({ user_id: target.user_id, blook_id: cheeseburger.id, quantity: qty, game: 'icecreamet' });
    return { ok: true, message: `🍔 Gave ${qty.toLocaleString()} Cheeseburger${qty > 1 ? 's' : ''} to ${target.username}!` };
  }

  if (action === 'force_pulls') {
    const settings = await base44.entities.GameSettings.filter({ key: 'cheeseburger_forced_users' });
    const setting = settings[0];
    let list = (setting?.value || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (enable) { if (!list.includes(targetLower)) list.push(targetLower); }
    else list = list.filter(u => u !== targetLower);
    const value = list.join(',');
    if (setting) await base44.entities.GameSettings.update(setting.id, { value });
    else await base44.entities.GameSettings.create({ key: 'cheeseburger_forced_users', value, category: 'general' });
    return { ok: true, forced: !!enable, list };
  }

  if (action === 'give_theme') {
    await base44.entities.PlayerProfile.update(target.id, { theme_bg: 'cheeseburger' });
    return { ok: true, message: `🎨 Gave Cheeseburger theme to ${target.username}!` };
  }

  if (action === 'set_avatar') {
    await base44.entities.PlayerProfile.update(target.id, { avatar_url: avatar_url || CHEESEBURGER_IMG });
    return { ok: true, message: `🖼️ Set Cheeseburger avatar for ${target.username}!` };
  }

  if (action === 'set_name_color') {
    await base44.entities.PlayerProfile.update(target.id, { name_color: color || '#FFD700' });
    return { ok: true, message: `✨ Set golden name color for ${target.username}!` };
  }

  if (action === 'load_blooks') {
    const playerBlooks = await base44.entities.PlayerBlook.filter({ user_id: target.user_id });
    const allBlooks = await base44.entities.Blook.filter({});
    const blookMap = new Map(allBlooks.map(b => [b.id, b]));
    const enriched = playerBlooks.map(pb => {
      const blook = blookMap.get(pb.blook_id);
      return {
        playerBlookId: pb.id, blookId: pb.blook_id, quantity: pb.quantity || 1,
        name: blook?.name || 'Unknown', image: blook?.image_url || '', rarity: blook?.rarity || 'uncommon'
      };
    }).filter(b => b.name !== 'Unknown');
    return { ok: true, blooks: enriched };
  }

  if (action === 'eat_blook') {
    const cooldownSettings = await base44.entities.GameSettings.filter({ key: 'biggie_last_eat' });
    const lastEat = parseInt(cooldownSettings[0]?.value || '0');
    if (Date.now() - lastEat < EAT_COOLDOWN_MS) {
      const remaining = EAT_COOLDOWN_MS - (Date.now() - lastEat);
      throw new Error(`⏳ Cooldown active: ${Math.floor(remaining / 60000)}m ${Math.floor((remaining % 60000) / 1000)}s`);
    }
    const eatQty = Math.max(1, Math.min(999, quantity || 1));
    const pbRecords = await base44.entities.PlayerBlook.filter({ id: player_blook_id, user_id: target.user_id });
    const pb = pbRecords[0];
    if (!pb) throw new Error('Blook not found');
    const allBlooks = await base44.entities.Blook.filter({});
    const blook = allBlooks.find(b => b.id === pb.blook_id);
    const actualQty = Math.min(eatQty, pb.quantity || 1);
    if ((pb.quantity || 1) > actualQty) await base44.entities.PlayerBlook.update(pb.id, { quantity: (pb.quantity || 1) - actualQty });
    else await base44.entities.PlayerBlook.delete(pb.id);
    await base44.entities.BiggieEatEvent.create({
      target_username: target.username, target_avatar: target.avatar_url || '',
      blook_name: actualQty > 1 ? `${blook?.name || 'Unknown'} x${actualQty}` : (blook?.name || 'Unknown'),
      blook_image: blook?.image_url || '', eater_username: profile.username
    });
    if (cooldownSettings[0]) await base44.entities.GameSettings.update(cooldownSettings[0].id, { value: String(Date.now()) });
    else await base44.entities.GameSettings.create({ key: 'biggie_last_eat', value: String(Date.now()), category: 'general' });
    return { ok: true, message: `🍔 Ate ${actualQty}x ${blook?.name || 'Unknown'} from ${target.username}! Nom nom nom!` };
  }

  if (action === 'troll') {
    const validTrolls = ['rain', 'flip', 'quake', 'fog', 'disco', 'sit'];
    if (!validTrolls.includes(troll_type)) throw new Error('Invalid troll type');
    await base44.entities.BiggieTrollEvent.create({
      target_user_id: target.user_id, target_username: target.username, troll_type, eater_username: profile.username
    });
    const labels = { rain: '🍔 Burger rain', flip: '🔄 Screen flipped', quake: '🫨 Earthquake', fog: '🌫️ Burger fog', disco: '🪩 Disco mode', sit: '🫃 Sat on them' };
    return { ok: true, message: `${labels[troll_type] || 'Trolled'} on ${target.username}!` };
  }

  throw new Error('Unknown action');
}