import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { Button } from '@/components/ui/button';
import { Copy, Check, Clock, CheckCircle2, XCircle } from 'lucide-react';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 8 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

const STATUS = {
  pending: { icon: Clock, className: 'text-amber-300 border-amber-400/40 bg-amber-400/10', label: 'Waiting for admin' },
  approved: { icon: CheckCircle2, className: 'text-green-400 border-green-400/40 bg-green-400/10', label: 'Approved' },
  rejected: { icon: XCircle, className: 'text-red-400 border-red-400/40 bg-red-400/10', label: 'Rejected' },
};

export default function Invites() {
  const { profile } = useGame();
  const [link, setLink] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    (async () => {
      try {
        let existing = await base44.entities.InviteLink.filter({ inviter_user_id: profile.user_id });
        if (existing.length === 0) {
          const created = await base44.entities.InviteLink.create({
            code: makeCode(),
            inviter_user_id: profile.user_id,
            inviter_username: profile.username,
            inviter_avatar: profile.avatar_url || ''
          });
          existing = [created];
        }
        if (!active) return;
        setLink(existing[0]);
        const apps = await base44.entities.InviteApplication.filter({ inviter_user_id: profile.user_id }, '-created_date', 100);
        if (active) setApplications(apps);
      } catch (e) {
        if (active) setApplications([]);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [profile?.user_id]);

  if (!profile || loading) {
    return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-[#a7fcc9]/30 border-t-[#a7fcc9] rounded-full animate-spin" /></div>;
  }

  const inviteUrl = link ? `${window.location.origin}/join/${link.code}` : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  return (
    <div>
      <h2 className="text-2xl font-display text-[#a7fcc9] mb-1">🔗 Invites</h2>
      <p className="text-sm text-white/60 mb-4">Share your personal link. Everyone who applies through it shows up here, and an admin has to approve them before they can join.</p>

      <div className="bg-panel rounded-2xl border border-white/10 p-4 mb-4">
        <p className="text-xs text-white/60 mb-2">Your invite link (unique to you)</p>
        <div className="flex gap-2 flex-wrap">
          <div className="flex-1 min-w-[220px] bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white overflow-x-auto whitespace-nowrap">
            {inviteUrl}
          </div>
          <Button onClick={copy} style={{ backgroundColor: copied ? '#22c55e' : '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <p className="text-[11px] text-white/40 mt-2">{link?.uses || 0} player{link?.uses === 1 ? '' : 's'} approved through your link</p>
      </div>

      <div className="bg-panel rounded-2xl border border-white/10 p-4">
        <h3 className="font-display text-[#a7fcc9] mb-3">People you invited</h3>
        {applications.length === 0 ? (
          <p className="text-white/60 text-sm">Nobody has applied through your link yet.</p>
        ) : (
          <div className="space-y-2">
            {applications.map(a => {
              const s = STATUS[a.status] || STATUS.pending;
              const Icon = s.icon;
              return (
                <div key={a.id} className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-white">{a.discord_username || a.email}</span>
                    <span className={`ml-auto flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${s.className}`}>
                      <Icon size={12} /> {s.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/50 mt-1">Age {a.age} • {a.reason}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}