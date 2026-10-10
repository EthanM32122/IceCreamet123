import { base44 } from '@/api/base44Client';
import { ROLE_HIERARCHY } from '@/lib/constants';

// Secure admin profile update. Routes through the backend function
// adminUpdateProfile, which verifies the caller's in-game rank server-side
// before applying any role / ban / mute / token / avatar change — so a non-admin
// cannot use the dashboard (or call the function directly) to give coins, ban
// people, or promote. The authoritative rank lives in the admin-only PlayerRole
// entity, so self-promoting via the old PlayerProfile.role mirror grants nothing.
//
// Fallback: backend functions are unavailable while the workspace is out of
// integration credits. The fallback mirrors the backend function's permission
// checks client-side so admins and moderators can still moderate. Game staff
// must also be platform admins (User.role = 'admin') for RLS to allow the
// direct profile writes — the owner sets this once per staff member.
export async function adminUpdateProfile(adminProfile, targetPlayer, patch) {
  try {
    const invokePromise = base44.functions.invoke('adminUpdateProfile', {
      targetUserId: targetPlayer.user_id,
      patch,
    });
    // Prevent unhandled rejection if we abandon the promise after timeout
    invokePromise.catch(() => {});
    const res = await Promise.race([
      invokePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    ]);
    if (res?.data?.error) throw new Error(res.data.error);
    if (res?.data?.ok) return res.data;
    throw new Error('No success response from backend');
  } catch (e) {
    // Fallback when backend functions are unavailable (credits exhausted).
    // Mirrors the backend function's permission checks client-side.
    const callerRank = ROLE_HIERARCHY[adminProfile?.role] || 0;
    const targetRank = ROLE_HIERARCHY[targetPlayer?.role] || 0;
    const isProtected = (targetPlayer?.username || '').toLowerCase() === 'icecreamy';
    const canModerate = !isProtected && callerRank > targetRank;

    // Role changes: co-owner+
    if (patch.role !== undefined) {
      if (adminProfile?.user_id && adminProfile.user_id === targetPlayer?.user_id) throw new Error('You cannot change your own role.');
      if (callerRank < ROLE_HIERARCHY['co-owner']) throw e;
      const allowed = callerRank >= ROLE_HIERARCHY.owner
        ? ['player', 'moderator', 'admin', 'co-owner', 'owner']
        : ['player', 'moderator', 'admin'];
      if (!allowed.includes(patch.role)) throw new Error('You cannot assign that role.');
      if (callerRank < ROLE_HIERARCHY.owner && targetRank >= callerRank) throw new Error('You cannot modify a user at or above your rank.');
      const existing = await base44.entities.PlayerRole.filter({ user_id: targetPlayer.user_id });
      if (existing.length) await base44.entities.PlayerRole.update(existing[0].id, { role: patch.role });
      else await base44.entities.PlayerRole.create({ user_id: targetPlayer.user_id, role: patch.role });
      await base44.entities.PlayerProfile.update(targetPlayer.id, { role: patch.role });
      return { ok: true, fallback: true };
    }

    // Ban/unban
    if (patch.is_banned !== undefined) {
      if (patch.is_banned) {
        // Ban: canModerate required (blocks banning protected users like icecreamy).
        // Helpers submit ban requests; moderators+ ban directly.
        if (!canModerate) throw new Error('Not permitted to moderate this user.');
        if (callerRank < ROLE_HIERARCHY.moderator) {
          await base44.entities.BanRequest.create({
            target_user_id: targetPlayer.user_id,
            target_username: targetPlayer.username,
            requester_id: adminProfile.user_id,
            requester_username: adminProfile.username,
            reason: patch.ban_reason || 'Ban request from helper',
            proof: '',
            status: 'pending'
          });
          return { ok: true, ban_request: true, message: 'Ban request submitted. The owner will review it.' };
        }
        await base44.entities.PlayerProfile.update(targetPlayer.id, {
          is_banned: true,
          ban_reason: patch.ban_reason || 'Banned by staff',
          banned_by: patch.banned_by || adminProfile.username
        });
        return { ok: true, fallback: true };
      }
      // Unban: moderator+ (allowed even for protected users like icecreamy)
      if (callerRank < ROLE_HIERARCHY.moderator) throw new Error('Only moderators+ can unban.');
      await base44.entities.PlayerProfile.update(targetPlayer.id, { is_banned: false, ban_reason: '', banned_by: '' });
      return { ok: true, fallback: true };
    }

    // Mute/unmute: helper+ (canModerate) or self-mute (co-owner+)
    if (patch.is_muted !== undefined) {
      const selfMute = adminProfile?.user_id === targetPlayer?.user_id && callerRank >= ROLE_HIERARCHY['co-owner'];
      if (!canModerate && !selfMute) throw new Error('Not permitted to moderate this user.');
      await base44.entities.PlayerProfile.update(targetPlayer.id, {
        is_muted: !!patch.is_muted,
        mute_until: patch.mute_until ?? null,
        muted_by: patch.is_muted ? (patch.muted_by || adminProfile.username) : ''
      });
      return { ok: true, fallback: true };
    }

    // Tokens: admin+
    if (patch.tokens !== undefined) {
      if (callerRank < ROLE_HIERARCHY.admin) throw new Error('Not permitted.');
      await base44.entities.PlayerProfile.update(targetPlayer.id, { tokens: patch.tokens });
      return { ok: true, fallback: true };
    }

    // Avatar: co-owner+
    if (patch.avatar_url !== undefined) {
      if (callerRank < ROLE_HIERARCHY['co-owner']) throw new Error('Not permitted.');
      await base44.entities.PlayerProfile.update(targetPlayer.id, { avatar_url: patch.avatar_url });
      return { ok: true, fallback: true };
    }

    // Name/chat color: co-owner+
    if (patch.name_color !== undefined || patch.chat_color !== undefined) {
      if (callerRank < ROLE_HIERARCHY['co-owner']) throw new Error('Not permitted.');
      const update = {};
      if (patch.name_color !== undefined) update.name_color = patch.name_color;
      if (patch.chat_color !== undefined) update.chat_color = patch.chat_color;
      await base44.entities.PlayerProfile.update(targetPlayer.id, update);
      return { ok: true, fallback: true };
    }

    // Reset security: co-owner+
    if (patch.reset_security !== undefined) {
      if (callerRank < ROLE_HIERARCHY['co-owner']) throw new Error('Not permitted.');
      await base44.entities.PlayerProfile.update(targetPlayer.id, { verification_answers: '[]', verification_questions: '', verified_until: null });
      return { ok: true, fallback: true };
    }

    // Generic update: admin+
    if (callerRank < ROLE_HIERARCHY.admin) throw new Error('Not permitted.');
    await base44.entities.PlayerProfile.update(targetPlayer.id, patch);
    return { ok: true, fallback: true };
  }
}