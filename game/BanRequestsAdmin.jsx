import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';

export default function BanRequestsAdmin({ adminProfile }) {
  const [requests, setRequests] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = () => base44.entities.BanRequest.filter({ status: 'pending' }, '-created_date').then(setRequests).catch(() => setRequests([]));

  useEffect(() => {
    load();
    const unsub = base44.entities.BanRequest.subscribe((e) => {
      if (e.type === 'create' || e.type === 'update' || e.type === 'delete') load();
    });
    return unsub;
  }, []);

  const accept = async (req) => {
    if (busy) return;
    setBusy(true);
    try {
      const profiles = await base44.entities.PlayerProfile.filter({ user_id: req.target_user_id });
      if (profiles[0]) await base44.entities.PlayerProfile.update(profiles[0].id, { is_banned: true });
      await base44.entities.BanRequest.update(req.id, { status: 'accepted', reviewer_id: adminProfile.user_id });
      load();
    } finally {
      setBusy(false);
    }
  };

  const reject = async (req) => {
    if (busy) return;
    setBusy(true);
    try {
      await base44.entities.BanRequest.update(req.id, { status: 'rejected', reviewer_id: adminProfile.user_id });
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="font-display text-[#a7fcc9] mb-2">🚨 Ban Requests</h3>
      <p className="text-xs text-white/60 mb-2">Staff-submitted bans pending your approval. The user is not banned until you accept.</p>
      {requests.length === 0 && <p className="text-white/60 text-xs">No pending ban requests.</p>}
      {requests.map(req => (
        <div key={req.id} className="bg-panel rounded-xl border border-white/10 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="font-display text-sm text-white">{req.target_username}</span>
            <span className="text-[10px] text-white/60">requested by {req.requester_username}</span>
          </div>
          <p className="text-xs text-white/80 mb-1"><span className="text-white/50">Reason:</span> {req.reason}</p>
          {req.proof && <p className="text-xs text-white/80 mb-2 break-words"><span className="text-white/50">Proof:</span> {req.proof}</p>}
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={() => accept(req)} disabled={busy} className="text-xs" style={{ backgroundColor: '#ef4444', color: '#fff' }}><Check size={12} className="mr-1" />Accept Ban</Button>
            <Button size="sm" variant="outline" onClick={() => reject(req)} disabled={busy} className="text-xs border-white/20 text-white"><X size={12} className="mr-1" />Reject</Button>
          </div>
        </div>
      ))}
    </div>
  );
}