import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trash2, Award } from 'lucide-react';

export default function Credits() {
  const { profile } = useGame();
  const isOwner = profile?.role === 'owner';
  const [credits, setCredits] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [cs, players] = await Promise.all([
        base44.entities.Credit.list('order'),
        base44.entities.PlayerProfile.list('-created_date', 2000)
      ]);
      setCredits(cs);
      const map = {};
      players.forEach(p => { map[p.user_id] = p; });
      setProfiles(map);
    } catch (e) {
      console.error('Credits load failed', e);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Live-update avatars instantly when a profile changes
  useEffect(() => {
    const unsub = base44.entities.PlayerProfile.subscribe((e) => {
      if (e.data?.user_id) {
        setProfiles(prev => ({ ...prev, [e.data.user_id]: e.data }));
      }
    });
    return unsub;
  }, []);

  const addCredit = async () => {
    if (!username.trim() || !reason.trim()) return;
    setSaving(true);
    try {
      const target = Object.values(profiles).find(p => (p.username || '').toLowerCase() === username.trim().toLowerCase());
      if (!target) {
        alert('User not found. They must have logged in at least once.');
        setSaving(false);
        return;
      }
      await base44.entities.Credit.create({ user_id: target.user_id, username: target.username, reason: reason.trim(), order: credits.length });
      setUsername('');
      setReason('');
      setAddOpen(false);
      load();
    } catch (e) {
      alert('Failed: ' + e.message);
    }
    setSaving(false);
  };

  const removeCredit = async (c) => {
    if (!confirm(`Remove ${c.username} from credits?`)) return;
    await base44.entities.Credit.delete(c.id);
    load();
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-display text-[#a7fcc9]">🏆 Credits</h2>
        {isOwner && <Button onClick={() => setAddOpen(true)} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}><Award size={14} className="mr-1" />Add Credit</Button>}
      </div>
      <p className="text-white/60 text-xs mb-4">Special thanks to the people who helped make ICECREAMET possible.</p>
      {loading ? (
        <p className="text-white/60 text-xs">Loading...</p>
      ) : (
        <div className="grid gap-3">
          {credits.map(c => {
            const p = profiles[c.user_id];
            const avatar = p?.avatar_url || '';
            return (
              <div key={c.id} className="bg-panel rounded-xl border border-white/10 p-3 flex items-center gap-3">
                <div className="w-12 h-12 avatar-rounded-square bg-white/10 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {avatar ? <img src={avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-white text-lg">{(c.username || '?')[0]?.toUpperCase()}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-white">{p?.username || c.username}</p>
                  <p className="text-white/60 text-xs">{c.reason}</p>
                </div>
                {isOwner && <Button size="sm" variant="outline" onClick={() => removeCredit(c)} className="border-red-500/40 text-red-400"><Trash2 size={12} /></Button>}
              </div>
            );
          })}
          {credits.length === 0 && <p className="text-white/60 text-xs">No credits yet.</p>}
        </div>
      )}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Credit</DialogTitle></DialogHeader>
          <p className="text-xs text-white/60">Enter the username of the person to credit and why.</p>
          <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" className="bg-white/10 border-white/20 text-white" />
          <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Why are they credited?" rows={3} className="bg-white/10 border-white/20 text-white" />
          <Button onClick={addCredit} disabled={saving || !username.trim() || !reason.trim()} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>{saving ? 'Saving...' : 'Add'}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}