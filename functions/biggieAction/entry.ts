import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;

    // Get caller profile
    const callerProfiles = await svc.entities.PlayerProfile.filter({ user_id: user.id });
    const caller = callerProfiles[0];
    if (!caller) return Response.json({ error: 'Profile not found' }, { status: 403 });

    const callerLower = (caller.username || '').toLowerCase();

    // Check panel access: phantom_grip always, or has biggie role
    const hasPanelAccess = callerLower === 'phantom_grip' || caller.role === 'biggie';

    const body = await req.json().catch(() => ({}));
    const { action } = body || {};

    // check_access: returns whether caller has panel access (no target needed)
    if (action === 'check_access') {
      return Response.json({ ok: true, has_access: hasPanelAccess, username: caller.username });
    }

    // load_forced: no target needed
    if (action === 'load_forced') {
      if (!hasPanelAccess) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const settings = await svc.entities.GameSettings.filter({ key: 'cheeseburger_forced_users' });
      const list = (settings[0]?.value || '').split(',').filter(Boolean);
      return Response.json({ ok: true, list });
    }

    // list_forced: legacy alias
    if (action === 'list_forced') {
      if (!hasPanelAccess) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const settings = await svc.entities.GameSettings.filter({ key: 'cheeseburger_forced_users' });
      const list = (settings[0]?.value || '').split(',').filter(Boolean);
      return Response.json({ ok: true, list });
    }

    if (!hasPanelAccess) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { target_username } = body || {};
    if (!target_username) return Response.json({ error: 'Missing target_username' }, { status: 400 });
    const targetLower = String(target_username).toLowerCase().trim();

    // icecreamy is immune to all biggie actions
    if (targetLower === 'icecreamy') {
      return Response.json({ error: 'Cannot target this user' }, { status: 403 });
    }

    // Find target profile (case-insensitive)
    let target;
    const directMatch = await svc.entities.PlayerProfile.filter({ username: target_username });
    if (directMatch[0] && (directMatch[0].username || '').toLowerCase() === targetLower) {
      target = directMatch[0];
    } else {
      const all = await svc.entities.PlayerProfile.list('-created_date', 500);
      target = all.find(p => (p.username || '').toLowerCase() === targetLower);
    }
    if (!target) return Response.json({ error: 'User not found' }, { status: 404 });

    if (action === 'give_cheeseburgers') {
      const qty = Math.max(1, Math.min(99999, body.quantity || 1));
      const allBlooks = await svc.entities.Blook.filter({});
      const cheeseburger = allBlooks.find(b => (b.name || '').toLowerCase().includes('cheeseburger'));
      if (!cheeseburger) return Response.json({ error: 'Cheeseburger blook not found' }, { status: 404 });

      const existing = await svc.entities.PlayerBlook.filter({ user_id: target.user_id, blook_id: cheeseburger.id });
      if (existing[0]) {
        await svc.entities.PlayerBlook.update(existing[0].id, { quantity: (existing[0].quantity || 0) + qty });
      } else {
        await svc.entities.PlayerBlook.create({ user_id: target.user_id, blook_id: cheeseburger.id, quantity: qty, game: 'icecreamet' });
      }
      return Response.json({ ok: true, message: `🍔 Gave ${qty.toLocaleString()} Cheeseburger${qty > 1 ? 's' : ''} to ${target.username}!` });
    }

    if (action === 'force_pulls') {
      const settings = await svc.entities.GameSettings.filter({ key: 'cheeseburger_forced_users' });
      const setting = settings[0];
      let list = (setting?.value || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      if (body.enable) {
        if (!list.includes(targetLower)) list.push(targetLower);
      } else {
        list = list.filter(u => u !== targetLower);
      }
      const value = list.join(',');
      if (setting) {
        await svc.entities.GameSettings.update(setting.id, { value });
      } else {
        await svc.entities.GameSettings.create({ key: 'cheeseburger_forced_users', value, category: 'general' });
      }
      return Response.json({ ok: true, forced: !!body.enable, list });
    }

    if (action === 'give_theme') {
      await svc.entities.PlayerProfile.update(target.id, { theme_bg: 'cheeseburger' });
      return Response.json({ ok: true, message: `🎨 Gave Cheeseburger theme to ${target.username}!` });
    }

    if (action === 'set_avatar') {
      await svc.entities.PlayerProfile.update(target.id, { avatar_url: body.avatar_url || 'https://ac.blooket.com/marketassets/blooks/cheeseburger.svg' });
      return Response.json({ ok: true, message: `🖼️ Set Cheeseburger avatar for ${target.username}!` });
    }

    if (action === 'set_name_color') {
      await svc.entities.PlayerProfile.update(target.id, { name_color: body.color || '#FFD700' });
      return Response.json({ ok: true, message: `✨ Set golden name color for ${target.username}!` });
    }

    if (action === 'load_blooks') {
      const playerBlooks = await svc.entities.PlayerBlook.filter({ user_id: target.user_id });
      const allBlooks = await svc.entities.Blook.filter({});
      const blookMap = new Map(allBlooks.map(b => [b.id, b]));
      const enriched = playerBlooks.map(pb => {
        const blook = blookMap.get(pb.blook_id);
        return {
          playerBlookId: pb.id, blookId: pb.blook_id, quantity: pb.quantity || 1,
          name: blook?.name || 'Unknown', image: blook?.image_url || '', rarity: blook?.rarity || 'uncommon'
        };
      }).filter(b => b.name !== 'Unknown');
      return Response.json({ ok: true, blooks: enriched });
    }

    if (action === 'eat_blook') {
      // Check cooldown
      const cooldownSettings = await svc.entities.GameSettings.filter({ key: 'biggie_last_eat' });
      const lastEat = parseInt(cooldownSettings[0]?.value || '0');
      const cooldownMs = 600000; // 10 minutes
      if (Date.now() - lastEat < cooldownMs) {
        const remaining = cooldownMs - (Date.now() - lastEat);
        return Response.json({ error: `⏳ Cooldown active: ${Math.floor(remaining / 60000)}m ${Math.floor((remaining % 60000) / 1000)}s` }, { status: 429 });
      }

      const playerBlookId = body.player_blook_id;
      const eatQty = Math.max(1, Math.min(999, body.quantity || 1));

      const pbRecords = await svc.entities.PlayerBlook.filter({ id: playerBlookId, user_id: target.user_id });
      const pb = pbRecords[0];
      if (!pb) return Response.json({ error: 'Blook not found' }, { status: 404 });

      const allBlooks = await svc.entities.Blook.filter({});
      const blook = allBlooks.find(b => b.id === pb.blook_id);

      const actualQty = Math.min(eatQty, pb.quantity || 1);
      if ((pb.quantity || 1) > actualQty) {
        await svc.entities.PlayerBlook.update(pb.id, { quantity: (pb.quantity || 1) - actualQty });
      } else {
        await svc.entities.PlayerBlook.delete(pb.id);
      }

      await svc.entities.BiggieEatEvent.create({
        target_username: target.username,
        target_avatar: target.avatar_url || '',
        blook_name: actualQty > 1 ? `${blook?.name || 'Unknown'} x${actualQty}` : (blook?.name || 'Unknown'),
        blook_image: blook?.image_url || '',
        eater_username: caller.username
      });

      // Update cooldown
      if (cooldownSettings[0]) {
        await svc.entities.GameSettings.update(cooldownSettings[0].id, { value: String(Date.now()) });
      } else {
        await svc.entities.GameSettings.create({ key: 'biggie_last_eat', value: String(Date.now()), category: 'general' });
      }

      return Response.json({ ok: true, message: `🍔 Ate ${actualQty}x ${blook?.name || 'Unknown'} from ${target.username}! Nom nom nom!` });
    }

    if (action === 'troll') {
      const trollType = body.troll_type;
      const validTrolls = ['rain', 'flip', 'quake', 'fog', 'disco', 'sit'];
      if (!validTrolls.includes(trollType)) return Response.json({ error: 'Invalid troll type' }, { status: 400 });

      await svc.entities.BiggieTrollEvent.create({
        target_user_id: target.user_id,
        target_username: target.username,
        troll_type: trollType,
        eater_username: caller.username
      });

      const labels = { rain: '🍔 Burger rain', flip: '🔄 Screen flipped', quake: '🫨 Earthquake', fog: '🌫️ Burger fog', disco: '🪩 Disco mode', sit: '🫃 Sat on them' };
      return Response.json({ ok: true, message: `${labels[trollType] || 'Trolled'} on ${target.username}!` });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}