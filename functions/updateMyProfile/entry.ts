import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Whitelist of fields a user may set on their own profile via this function.
// Economy/security fields (tokens, diamonds, role, bans, level, xp, etc.)
// are deliberately excluded — they can only change via dedicated economy
// functions (openPack, sellBlook, purchaseStoreItem, etc.).
const ALLOWED_FIELDS = new Set([
  'avatar_url', 'username', 'name_color', 'chat_color',
  'theme_bg', 'unlocked_themes', 'shiny_theme', 'shiny_avatar',
  'equipped_banner_id', 'has_seen_news', 'has_seen_rules',
  'has_set_username', 'verification_answers', 'verification_questions',
  'verified_until', 'last_seen', 'last_chat_time', 'chat_spam_count',
  'messages_sent', 'minigame_window_start', 'minigame_cooldown_until',
  'pac_starter_opened', 'email_disconnected', 'profile_locked',
  'gtb_streak', 'bart_clicks', 'mine_slots', 'gradient_unlocked'
]);

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { patch } = body || {};
    if (!patch || typeof patch !== 'object') {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Filter to allowed fields only — silently drops any economy field the
    // client tries to sneak in (tokens, diamonds, role, is_banned, etc.)
    const safePatch = {};
    for (const [key, value] of Object.entries(patch)) {
      if (ALLOWED_FIELDS.has(key)) {
        safePatch[key] = value;
      }
    }

    if (Object.keys(safePatch).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const profiles = await svc.entities.PlayerProfile.filter({ user_id: user.id });
    if (!profiles.length) return Response.json({ error: 'Profile not found' }, { status: 404 });

    // Server-side enforcement of profile lock: avatar and shiny_avatar are
    // frozen while profile_locked is true. The lock itself can still be
    // toggled by admins via adminUpdateProfile (which bypasses this function).
    if (profiles[0].profile_locked && ('avatar_url' in safePatch || 'shiny_avatar' in safePatch)) {
      return Response.json({ error: 'Profile is locked — avatar cannot be changed' }, { status: 403 });
    }

    const updated = await svc.entities.PlayerProfile.update(profiles[0].id, safePatch);
    return Response.json({ ok: true, profile: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}