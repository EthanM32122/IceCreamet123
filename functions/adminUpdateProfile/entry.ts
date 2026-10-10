import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const ROLE_HIERARCHY = { player: 1, helper: 2, moderator: 3, biggie: 3, admin: 4, 'co-owner': 5, 'executive-manager': 6, owner: 7 };

const allowedRolesFor = (rank) => {
  if (rank >= ROLE_HIERARCHY.owner) return ['player', 'helper', 'moderator', 'admin', 'co-owner', 'executive-manager', 'owner', 'biggie'];
  if (rank >= ROLE_HIERARCHY['executive-manager']) return ['player', 'helper', 'moderator', 'admin', 'co-owner', 'biggie'];
  if (rank >= ROLE_HIERARCHY['co-owner']) return ['player', 'helper', 'moderator', 'admin', 'biggie'];
  if (rank >= ROLE_HIERARCHY.admin) return ['player', 'helper', 'moderator', 'biggie'];
  return [];
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { targetUserId, patch } = body || {};
    if (!targetUserId || !patch || typeof patch !== 'object') {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    // Caller's authoritative role (PlayerRole, falling back to the legacy
    // PlayerProfile.role mirror only if no PlayerRole record exists).
    const callerRoles = await svc.entities.PlayerRole.filter({ user_id: user.id });
    const callerProfiles = await svc.entities.PlayerProfile.filter({ user_id: user.id });
    const callerProfile = callerProfiles[0];
    let callerRole = callerRoles.length > 0 ? callerRoles[0].role : 'player';
    const callerRank = ROLE_HIERARCHY[callerRole] || 0;

    const targetProfiles = await svc.entities.PlayerProfile.filter({ user_id: targetUserId });
    if (!targetProfiles.length) return Response.json({ error: 'Target not found' }, { status: 404 });
    const targetProfile = targetProfiles[0];
    const targetRoles = await svc.entities.PlayerRole.filter({ user_id: targetUserId });
    const targetRole = targetRoles.length > 0 ? targetRoles[0].role : 'player';
    const targetRank = ROLE_HIERARCHY[targetRole] || 0;
    const isProtected = (targetProfile.username || '').toLowerCase() === 'icecreamy';
    const canModerate = !isProtected && callerRank > targetRank;

    if (patch.role !== undefined) {
      const newRole = patch.role;
      if (user.id === targetUserId) {
        return Response.json({ error: 'You cannot change your own role.' }, { status: 403 });
      }
      if (!allowedRolesFor(callerRank).includes(newRole)) {
        return Response.json({ error: 'You cannot assign that role.' }, { status: 403 });
      }
      if (callerRank < ROLE_HIERARCHY.owner && targetRank >= callerRank) {
        return Response.json({ error: 'You cannot modify a user at or above your rank.' }, { status: 403 });
      }
      if (targetRoles.length) await svc.entities.PlayerRole.update(targetRoles[0].id, { role: newRole });
      else await svc.entities.PlayerRole.create({ user_id: targetUserId, role: newRole });
      await svc.entities.PlayerProfile.update(targetProfile.id, { role: newRole });
      return Response.json({ ok: true, role: newRole });
    }

    if (patch.is_banned !== undefined) {
      if (patch.is_banned) {
        // Ban: canModerate required (blocks banning protected users like icecreamy).
        // Moderators and above can directly ban. Helpers only submit a ban
        // request for the owner to review.
        if (!canModerate) return Response.json({ error: 'Not permitted' }, { status: 403 });
        if (callerRank < ROLE_HIERARCHY.moderator) {
          await svc.entities.BanRequest.create({
            target_user_id: targetUserId,
            target_username: targetProfile.username || '',
            requester_id: user.id,
            requester_username: callerProfile?.username || '',
            reason: patch.ban_reason || 'Ban request from helper',
            proof: '',
            status: 'pending'
          });
          return Response.json({ ok: true, ban_request: true, message: 'Ban request submitted. The owner will review it.' });
        }
        await svc.entities.PlayerProfile.update(targetProfile.id, { is_banned: true, ban_reason: patch.ban_reason || 'Banned by staff', banned_by: patch.banned_by || callerProfile?.username || 'Staff' });
        await svc.entities.ChatMessage.create({
          content: `🔨 ${targetProfile.username} has been banned by ${callerProfile?.username || 'an admin'}.`,
          username: 'ICECREAMET Bot',
          avatar_url: '',
          is_system: true,
          user_role: 'admin',
          game: 'icecreamet',
          channel: 'global'
        });
        return Response.json({ ok: true });
      }
      // Unban: moderator+ (allowed even for protected users like icecreamy)
      if (callerRank < ROLE_HIERARCHY.moderator) return Response.json({ error: 'Only moderators+ can unban' }, { status: 403 });
      await svc.entities.PlayerProfile.update(targetProfile.id, { is_banned: false, ban_reason: '', banned_by: '' });
      return Response.json({ ok: true });
    }

    if (patch.is_muted !== undefined) {
      const selfMute = (user.id === targetUserId && callerRank >= ROLE_HIERARCHY['co-owner']);
      if (!canModerate && !selfMute) return Response.json({ error: 'Not permitted' }, { status: 403 });
      await svc.entities.PlayerProfile.update(targetProfile.id, { is_muted: !!patch.is_muted, mute_until: patch.mute_until ?? null, muted_by: patch.is_muted ? (patch.muted_by || callerProfile?.username || 'Admin') : '' });
      return Response.json({ ok: true });
    }

    if (patch.tokens !== undefined) {
      if (callerRank < ROLE_HIERARCHY.admin) return Response.json({ error: 'Not permitted' }, { status: 403 });
      await svc.entities.PlayerProfile.update(targetProfile.id, { tokens: patch.tokens });
      return Response.json({ ok: true });
    }

    if (patch.avatar_url !== undefined) {
      if (callerRank < ROLE_HIERARCHY['co-owner']) return Response.json({ error: 'Not permitted' }, { status: 403 });
      await svc.entities.PlayerProfile.update(targetProfile.id, { avatar_url: patch.avatar_url });
      return Response.json({ ok: true });
    }

    if (patch.name_color !== undefined || patch.chat_color !== undefined) {
      if (callerRank < ROLE_HIERARCHY['co-owner']) return Response.json({ error: 'Not permitted' }, { status: 403 });
      const update = {};
      if (patch.name_color !== undefined) update.name_color = patch.name_color;
      if (patch.chat_color !== undefined) update.chat_color = patch.chat_color;
      await svc.entities.PlayerProfile.update(targetProfile.id, update);
      return Response.json({ ok: true });
    }

    if (patch.reset_security !== undefined) {
      if (callerRank < ROLE_HIERARCHY['co-owner']) return Response.json({ error: 'Not permitted' }, { status: 403 });
      if (!canModerate && callerRank < ROLE_HIERARCHY.owner) return Response.json({ error: 'Not permitted' }, { status: 403 });
      await svc.entities.PlayerProfile.update(targetProfile.id, { verification_answers: '[]', verification_questions: '', verified_until: null });
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'No supported action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}