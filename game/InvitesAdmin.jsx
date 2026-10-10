import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { BOT_USERNAME, getBotAvatar } from '@/lib/botAvatar';
import { ADVERTISER_BADGE_ID } from '@/lib/constants';

const STATUS = {
  pending: { Icon: Clock, className: 'text-amber-300 border-amber-400/40 bg-amber-400/10', label: 'Pending' },
  approved: { Icon: CheckCircle2, className: 'text-green-400 border-green-400/40 bg-green-400/10', label: 'Approved' },
  rejected: { Icon: XCircle, className: 'text-red-400 border-red-400/40 bg-red-400/10', label: 'Rejected' },
};

export default function InvitesAdmin({ adminProfile }) {
  const [apps, setApps] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    const [allApps, allLinks] = await Promise.all([
      base44.entities.InviteApplication.list('-created_date', 300).catch(() => []),
      base44.entities.InviteLink.list('-uses', 300).catch(() => [])
    ]);
    setApps(allApps);
    setLinks(allLinks);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
    const unsub = base44.entities.InviteApplication.subscribe(() => { load(); });
    return unsub;
  }, []);

  const approve = async (app) => {
    setBusy(app.id);
    try {
      await base44.users.inviteUser(app.email, 'user');
      await base44.entities.InviteApplication.update(app.id, { status: 'approved', reviewed_by: adminProfile?.username || '' });

      const targetLinks = await base44.entities.InviteLink.filter({ code: app.code });
      const newUses = (targetLinks[0]?.uses || 0) + 1;
      if (targetLinks[0]) await base44.entities.InviteLink.update(targetLinks[0].id, { uses: newUses });

      // Auto-grant Advertiser badge when inviter reaches 10 approved invites
      if (newUses >= 10 && app.inviter_user_id) {
        const existing = await base44.entities.PlayerBadge.filter({ user_id: app.inviter_user_id, badge_id: ADVERTISER_BADGE_ID });
        if (existing.length === 0) {
          await base44.entities.PlayerBadge.create({ user_id: app.inviter_user_id, badge_id: ADVERTISER_BADGE_ID }).catch(() => {});
        }
      }

      // Reward the inviter with 10,000 coins for each accepted invite.
      if (app.inviter_user_id) {
        const inviterProfiles = await base44.entities.PlayerProfile.filter({ user_id: app.inviter_user_id });
        if (inviterProfiles[0]) {
          await base44.entities.PlayerProfile.update(inviterProfiles[0].id, { tokens: (inviterProfiles[0].tokens || 0) + 10000 });
        }
      }

      const newName = app.discord_username || app.email;
      const avatar = await getBotAvatar();
      await base44.entities.ChatMessage.create({
        content: `🎉 ${app.inviter_username} invited ${newName} and now has ${newUses} invite${newUses === 1 ? '' : 's'}`,
        username: BOT_USERNAME,
        avatar_url: avatar,
        is_system: true,
        user_role: 'admin',
        game: 'icecreamet',
        channel: 'global'
      });

      load();
    } catch (e) {
      alert('Could not send the invite: ' + (e.message || 'unknown error'));
    }
    setBusy(null);
  };

  const reject = async (app) => {
    setBusy(app.id);
    try {
      await base44.entities.InviteApplication.update(app.id, { status: 'rejected', reviewed_by: adminProfile?.username || '' });
      load();
    } catch (e) {
      alert('Failed to reject: ' + (e.message || 'unknown error'));
    }
    setBusy(null);
  };

  if (loading) return <p className="text-white/60 text-xs">Loading...</p>;

  const pending = apps.filter(a => a.status === 'pending');
  const approvedCounts = {};
  apps.filter(a => a.status === 'approved').forEach(a => {
    const name = a.inviter_username || 'Unknown';
    approvedCounts[name] = (approvedCounts[name] || 0) + 1;
  });
  const tracker = Object.entries(approvedCounts).map(([username, count]) => ({ username, count })).sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-[#a7fcc9] mb-1">Pending Applications</h3>
        <p className="text-xs text-white/60 mb-2">Approving sends them an email invite and announces it in chat as the bot.</p>
        {pending.length === 0 && <p className="text-white/60 text-xs">No pending applications.</p>}
        <div className="space-y-2">
          {pending.map(app => (
            <div key={app.id} className="bg-panel rounded-xl border border-white/10 p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display text-sm text-[#a7fcc9]">{app.discord_username}</span>
                <span className="text-[10px] text-white/50">age {app.age}</span>
                <span className="text-[10px] text-white/40 ml-auto">invited by {app.inviter_username}</span>
              </div>
              <p className="text-xs text-white/70 mt-1">{app.reason}</p>
              <p className="text-[10px] text-white/40 mt-1">{app.email}</p>
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={() => approve(app)} disabled={busy === app.id} className="text-xs bg-green-600 hover:bg-green-700 text-white">
                  {busy === app.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} className="mr-1" />} Approve & Invite
                </Button>
                <Button size="sm" variant="outline" onClick={() => reject(app)} disabled={busy === app.id} className="text-xs border-red-500/40 text-red-400">
                  <X size={12} className="mr-1" /> Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-display text-[#a7fcc9] mb-1">Invite Tracker</h3>
        <p className="text-xs text-white/60 mb-2">Who has brought in the most players.</p>
        {tracker.length === 0 ? (
          <p className="text-white/60 text-xs">Nobody has successfully invited anyone yet.</p>
        ) : (
          <div className="space-y-1">
            {tracker.map((t, i) => {
              const link = links.find(l => l.inviter_username === t.username);
              return (
                <div key={t.username} className="bg-panel rounded-xl border border-white/10 px-3 py-2 flex items-center gap-2">
                  <span className="font-display text-sm text-white/50 w-6">#{i + 1}</span>
                  <span className="text-sm text-white flex-1 truncate">{t.username}</span>
                  <span className="text-[10px] text-white/40 font-mono">{link?.code}</span>
                  <span className="text-sm font-display text-[#a7fcc9]">{t.count} invite{t.count === 1 ? '' : 's'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-display text-[#a7fcc9] mb-2">All Applications</h3>
        {apps.length === 0 ? (
          <p className="text-white/60 text-xs">No applications yet.</p>
        ) : (
          <div className="space-y-1">
            {apps.slice(0, 100).map(a => {
              const s = STATUS[a.status] || STATUS.pending;
              const Icon = s.Icon;
              return (
                <div key={a.id} className="bg-panel rounded-xl border border-white/10 px-3 py-2 flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-white">{a.discord_username || a.email}</span>
                  <span className="text-[10px] text-white/40">via {a.inviter_username}</span>
                  <span className={`ml-auto flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${s.className}`}>
                    <Icon size={11} /> {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}