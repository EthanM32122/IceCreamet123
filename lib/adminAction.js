import { base44 } from '@/api/base44Client';
import { ROLE_HIERARCHY } from '@/lib/constants';

/**
 * Admin profile updates. Backend function is often blocked (credits / domain),
 * so we try a short invoke then always fall back to direct entity writes.
 */
export async function adminUpdateProfile(adminProfile, targetPlayer, patch) {
  // Try backend briefly; ignore failures and use client fallback
  try {
    const invokePromise = base44.functions.invoke('adminUpdateProfile', {
      targetUserId: targetPlayer.user_id,
      patch,
    });
    invokePromise.catch(() => {});
    const res = await Promise.race([
      invokePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500)),
    ]);
    if (res?.data?.ok) return res.data;
    // If backend returned an error, still try fallback below
  } catch (_) {
    /* fall through */
  }

  return runClientFallback(adminProfile, targetPlayer, patch);
}

async function resolveProfileId(targetPlayer) {
  if (targetPlayer?.id) return targetPlayer.id;
  const rows = await base44.entities.PlayerProfile.filter({ user_id: targetPlayer.user_id });
  if (!rows?.length) throw new Error('Player profile not found.');
  return rows[0].id;
}

async function runClientFallback(adminProfile, targetPlayer, patch) {
  const callerRank = ROLE_HIERARCHY[adminProfile?.role] || 0;
  const targetRank = ROLE_HIERARCHY[targetPlayer?.role] || 0;
  const isProtected = (targetPlayer?.username || '').toLowerCase() === 'icecreamy';
  const canModerate = !isProtected && (callerRank >= ROLE_HIERARCHY.owner || callerRank > targetRank);
  const profileId = await resolveProfileId(targetPlayer);

  // Role changes: co-owner+
  if (patch.role !== undefined) {
    if (adminProfile?.user_id && adminProfile.user_id === targetPlayer?.user_id) {
      throw new Error('You cannot change your own role.');
    }
    if (callerRank < ROLE_HIERARCHY['co-owner']) throw new Error('Only co-owner+ can change roles.');
    const allowed =
      callerRank >= ROLE_HIERARCHY.owner
        ? ['player', 'helper', 'moderator', 'admin', 'co-owner', 'executive-manager', 'owner', 'biggie']
        : ['player', 'helper', 'moderator', 'admin', 'biggie'];
    if (!allowed.includes(patch.role)) throw new Error('You cannot assign that role.');
    if (targetRank >= callerRank && callerRank < ROLE_HIERARCHY.owner) {
      throw new Error('You cannot change the role of someone at your rank or higher.');
    }
    const existing = await base44.entities.PlayerRole.filter({ user_id: targetPlayer.user_id });
    if (existing.length) await base44.entities.PlayerRole.update(existing[0].id, { role: patch.role });
    else await base44.entities.PlayerRole.create({ user_id: targetPlayer.user_id, role: patch.role });
    await base44.entities.PlayerProfile.update(profileId, { role: patch.role });
    return { ok: true, fallback: true };
  }

  // Ban / Unban
  if (patch.is_banned !== undefined) {
    if (patch.is_banned) {
      if (isProtected) throw new Error('Cannot ban this protected user.');
      if (!canModerate) throw new Error('Not permitted to ban this user.');
      if (callerRank < ROLE_HIERARCHY.moderator) {
        await base44.entities.BanRequest.create({
          target_user_id: targetPlayer.user_id,
          target_username: targetPlayer.username,
          requester_id: adminProfile.user_id,
          requester_username: adminProfile.username,
          reason: patch.ban_reason || 'Ban request from helper',
          proof: '',
          status: 'pending',
        });
        return { ok: true, ban_request: true, message: 'Ban request submitted.' };
      }
      await base44.entities.PlayerProfile.update(profileId, {
        is_banned: true,
        ban_reason: patch.ban_reason || 'Banned by staff',
        banned_by: patch.banned_by || adminProfile.username,
      });
      return { ok: true, fallback: true };
    }

    // UNBAN — moderator+ can always unban (except need rank)
    if (callerRank < ROLE_HIERARCHY.moderator) {
      throw new Error('Only moderators+ can unban.');
    }
    try {
      await base44.entities.PlayerProfile.update(profileId, {
        is_banned: false,
        ban_reason: '',
        banned_by: '',
      });
    } catch (err) {
      // Retry via filter lookup (stale id)
      const rows = await base44.entities.PlayerProfile.filter({ user_id: targetPlayer.user_id });
      if (!rows?.length) throw new Error('Unban failed: profile not found. ' + (err?.message || ''));
      await base44.entities.PlayerProfile.update(rows[0].id, {
        is_banned: false,
        ban_reason: '',
        banned_by: '',
      });
    }
    return { ok: true, fallback: true, unbanned: true };
  }

  // Mute / unmute
  if (patch.is_muted !== undefined) {
    const selfMute =
      adminProfile?.user_id === targetPlayer?.user_id && callerRank >= ROLE_HIERARCHY['co-owner'];
    if (!canModerate && !selfMute) throw new Error('Not permitted to moderate this user.');
    await base44.entities.PlayerProfile.update(profileId, {
      is_muted: !!patch.is_muted,
      mute_until: patch.mute_until ?? null,
      muted_by: patch.is_muted ? patch.muted_by || adminProfile.username : '',
    });
    return { ok: true, fallback: true };
  }

  // Tokens: admin+
  if (patch.tokens !== undefined) {
    if (callerRank < ROLE_HIERARCHY.admin) throw new Error('Not permitted.');
    await base44.entities.PlayerProfile.update(profileId, { tokens: patch.tokens });
    return { ok: true, fallback: true };
  }

  // Avatar: co-owner+
  if (patch.avatar_url !== undefined) {
    if (callerRank < ROLE_HIERARCHY['co-owner']) throw new Error('Not permitted.');
    await base44.entities.PlayerProfile.update(profileId, { avatar_url: patch.avatar_url });
    return { ok: true, fallback: true };
  }

  // Name/chat color: co-owner+
  if (patch.name_color !== undefined || patch.chat_color !== undefined) {
    if (callerRank < ROLE_HIERARCHY['co-owner']) throw new Error('Not permitted.');
    const update = {};
    if (patch.name_color !== undefined) update.name_color = patch.name_color;
    if (patch.chat_color !== undefined) update.chat_color = patch.chat_color;
    await base44.entities.PlayerProfile.update(profileId, update);
    return { ok: true, fallback: true };
  }

  // Reset security: co-owner+
  if (patch.reset_security !== undefined) {
    if (callerRank < ROLE_HIERARCHY['co-owner']) throw new Error('Not permitted.');
    await base44.entities.PlayerProfile.update(profileId, {
      verification_answers: '[]',
      verification_questions: '',
      verified_until: null,
    });
    return { ok: true, fallback: true };
  }

  // Generic: admin+
  if (callerRank < ROLE_HIERARCHY.admin) throw new Error('Not permitted.');
  await base44.entities.PlayerProfile.update(profileId, patch);
  return { ok: true, fallback: true };
}
