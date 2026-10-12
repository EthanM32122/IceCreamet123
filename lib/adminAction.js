import { base44 } from '@/api/base44Client';
import { ROLE_HIERARCHY } from '@/lib/constants';

/**
 * Admin profile updates. Backend functions are often blocked; PlayerProfile
 * RLS only allows own-row or Base44 platform admin. Unban therefore creates a
 * BanOverride record staff can write, and the banned user clears their own ban.
 */
export async function adminUpdateProfile(adminProfile, targetPlayer, patch) {
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
    try {
      await base44.entities.PlayerProfile.update(profileId, { role: patch.role });
    } catch (_) {
      /* PlayerRole is authoritative */
    }
    return { ok: true, fallback: true };
  }

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
      try {
        await base44.entities.PlayerProfile.update(profileId, {
          is_banned: true,
          ban_reason: patch.ban_reason || 'Banned by staff',
          banned_by: patch.banned_by || adminProfile.username,
        });
        return { ok: true, fallback: true };
      } catch (err) {
        throw new Error(
          'Ban failed: Permission denied on PlayerProfile. Your Base44 login needs platform Admin role (not only in-game co-owner). ' +
            (err?.message || '')
        );
      }
    }

    // UNBAN
    if (callerRank < ROLE_HIERARCHY.moderator) {
      throw new Error('Only moderators+ can unban.');
    }

    // 1) Try direct profile update (works for Base44 platform admins)
    let profileUpdated = false;
    try {
      await base44.entities.PlayerProfile.update(profileId, {
        is_banned: false,
        ban_reason: '',
        banned_by: '',
      });
      profileUpdated = true;
    } catch (_) {
      try {
        const rows = await base44.entities.PlayerProfile.filter({ user_id: targetPlayer.user_id });
        if (rows?.[0]) {
          await base44.entities.PlayerProfile.update(rows[0].id, {
            is_banned: false,
            ban_reason: '',
            banned_by: '',
          });
          profileUpdated = true;
        }
      } catch (_) {
        /* use BanOverride path */
      }
    }

    // 2) Always write BanOverride so the banned player can self-clear on next load
    //    (their own PlayerProfile row IS writable by them under RLS)
    try {
      await base44.entities.BanOverride.create({
        target_user_id: targetPlayer.user_id,
        target_username: targetPlayer.username || '',
        staff_user_id: adminProfile.user_id,
        staff_username: adminProfile.username || '',
        active: true,
        note: 'Unban by ' + (adminProfile.username || 'staff'),
      });
    } catch (overrideErr) {
      if (!profileUpdated) {
        throw new Error(
          'Unban failed: cannot update PlayerProfile (need Base44 platform Admin) and BanOverride entity is missing. ' +
            'In Base44 dashboard: add entity BanOverride (see entities/BanOverride.jsonc), OR set your user Role to admin. ' +
            (overrideErr?.message || '')
        );
      }
    }

    return {
      ok: true,
      fallback: true,
      unbanned: true,
      profileUpdated,
      message: profileUpdated
        ? 'User unbanned.'
        : 'Unban override saved. The player will be unbanned automatically the next time they open the game.',
    };
  }

  if (patch.is_muted !== undefined) {
    const selfMute =
      adminProfile?.user_id === targetPlayer?.user_id && callerRank >= ROLE_HIERARCHY['co-owner'];
    if (!canModerate && !selfMute) throw new Error('Not permitted to moderate this user.');
    try {
      await base44.entities.PlayerProfile.update(profileId, {
        is_muted: !!patch.is_muted,
        mute_until: patch.mute_until ?? null,
        muted_by: patch.is_muted ? patch.muted_by || adminProfile.username : '',
      });
    } catch (err) {
      throw new Error('Mute failed (need Base44 platform Admin): ' + (err?.message || ''));
    }
    return { ok: true, fallback: true };
  }

  if (patch.tokens !== undefined) {
    if (callerRank < ROLE_HIERARCHY.admin) throw new Error('Not permitted.');
    try {
      await base44.entities.PlayerProfile.update(profileId, { tokens: patch.tokens });
    } catch (err) {
      throw new Error('Token update failed (need Base44 platform Admin): ' + (err?.message || ''));
    }
    return { ok: true, fallback: true };
  }

  if (patch.avatar_url !== undefined) {
    if (callerRank < ROLE_HIERARCHY['co-owner']) throw new Error('Not permitted.');
    try {
      await base44.entities.PlayerProfile.update(profileId, { avatar_url: patch.avatar_url });
    } catch (err) {
      throw new Error('Avatar update failed (need Base44 platform Admin): ' + (err?.message || ''));
    }
    return { ok: true, fallback: true };
  }

  if (patch.name_color !== undefined || patch.chat_color !== undefined) {
    if (callerRank < ROLE_HIERARCHY['co-owner']) throw new Error('Not permitted.');
    const update = {};
    if (patch.name_color !== undefined) update.name_color = patch.name_color;
    if (patch.chat_color !== undefined) update.chat_color = patch.chat_color;
    try {
      await base44.entities.PlayerProfile.update(profileId, update);
    } catch (err) {
      throw new Error('Color update failed (need Base44 platform Admin): ' + (err?.message || ''));
    }
    return { ok: true, fallback: true };
  }

  if (patch.reset_security !== undefined) {
    if (callerRank < ROLE_HIERARCHY['co-owner']) throw new Error('Not permitted.');
    try {
      await base44.entities.PlayerProfile.update(profileId, {
        verification_answers: '[]',
        verification_questions: '',
        verified_until: null,
      });
    } catch (err) {
      throw new Error('Security reset failed (need Base44 platform Admin): ' + (err?.message || ''));
    }
    return { ok: true, fallback: true };
  }

  if (callerRank < ROLE_HIERARCHY.admin) throw new Error('Not permitted.');
  try {
    await base44.entities.PlayerProfile.update(profileId, patch);
  } catch (err) {
    throw new Error('Update failed (need Base44 platform Admin): ' + (err?.message || ''));
  }
  return { ok: true, fallback: true };
}
