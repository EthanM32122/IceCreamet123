import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ROLE_HIERARCHY } from '@/lib/constants';
import { ShieldCheck, X } from 'lucide-react';

const canModerate = (viewer, target) => {
  if ((target?.username || '').toLowerCase() === 'icecreamy') return false;
  const v = ROLE_HIERARCHY[viewer?.role] || 0;
  if (v >= ROLE_HIERARCHY.owner) return true;
  return (ROLE_HIERARCHY[target?.role] || 0) < v;
};

export default function BanAppealsAdmin({ adminProfile }) {
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.BanAppeal.list('-created_date', 200);
      setAppeals(all);
    } catch (e) {
      console.error('Appeals load failed', e);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const resolve = async (appeal, action) => {
    if (action === 'unban') {
      if (!canModerate(adminProfile, { username: appeal.username, role: 'player' })) {
        alert('You cannot unban this user.');
        return;
      }
      if (!confirm(`Unban ${appeal.username} and resolve this appeal?`)) return;
      try {
        const prof = await base44.entities.PlayerProfile.filter({ user_id: appeal.user_id });
        if (prof.length) {
          await base44.entities.PlayerProfile.update(prof[0].id, { is_banned: false });
        } else {
          alert('Could not find that player profile.');
          return;
        }
        await base44.entities.BanAppeal.update(appeal.id, { status: 'resolved', reviewer_id: adminProfile.user_id });
      } catch (e) {
        alert('Failed to unban: ' + e.message);
      }
    } else {
      if (!confirm('Dismiss this appeal? The user will remain banned.')) return;
      await base44.entities.BanAppeal.update(appeal.id, { status: 'dismissed', reviewer_id: adminProfile.user_id });
    }
    load();
  };

  if (loading) return <p className="text-white/60 text-xs">Loading appeals...</p>;

  const pending = appeals.filter(a => a.status === 'pending');
  const reviewed = appeals.filter(a => a.status !== 'pending');

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/60">{pending.length} pending appeal(s). Unbanning here also works for accounts banned for alting.</p>
      {pending.length === 0 && <p className="text-white/60 text-xs">No pending appeals.</p>}
      {pending.map(a => (
        <div key={a.id} className="bg-panel rounded-xl border border-white/10 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="font-display text-sm text-[#a7fcc9]">{a.username}</span>
            <span className="text-[10px] text-white/50">{new Date(a.created_date).toLocaleString()}</span>
          </div>
          <p className="text-sm text-white/80 mb-3 whitespace-pre-wrap">{a.reason}</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => resolve(a, 'unban')} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}><ShieldCheck size={12} className="mr-1" />Unban & Resolve</Button>
            <Button size="sm" variant="outline" onClick={() => resolve(a, 'dismiss')} className="border-white/20 text-white"><X size={12} className="mr-1" />Dismiss</Button>
          </div>
        </div>
      ))}
      {reviewed.length > 0 && (
        <div className="mt-4">
          <h3 className="font-display text-[#a7fcc9] text-sm mb-2">Reviewed</h3>
          <div className="space-y-2">
            {reviewed.map(a => (
              <div key={a.id} className="bg-panel rounded-xl border border-white/10 p-3 opacity-60">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-display text-sm text-white">{a.username}</span>
                  <span className="text-[10px] capitalize text-white/50">{a.status}</span>
                </div>
                <p className="text-xs text-white/60 whitespace-pre-wrap">{a.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}