import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { getAllPlayers } from '@/lib/playersCache';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, Users } from 'lucide-react';

const ACCENT = { backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' };

export default function GiveawayDetailDialog({ giveaway, onOpenChange, onChanged }) {
  const { profile } = useGame();
  const [busy, setBusy] = useState(false);

  if (!giveaway) return null;

  const entries = (() => { try { return JSON.parse(giveaway.entries || '[]'); } catch { return []; } })();
  const winners = (() => { try { return JSON.parse(giveaway.winners || '[]'); } catch { return []; } })();
  const now = Date.now();
  const expired = giveaway.status === 'completed' || (giveaway.end_time && new Date(giveaway.end_time).getTime() < now);
  const isCreator = profile && giveaway.creator_id === profile.user_id;
  const entered = profile && entries.includes(profile.user_id);
  const isToken = giveaway.prize_type === 'tokens';

  const enter = async () => {
    if (!profile || busy || entered || isCreator || expired) return;
    setBusy(true);
    try {
      await base44.entities.Giveaway.update(giveaway.id, { entries: JSON.stringify([...entries, profile.user_id]) });
      onChanged();
    } catch (e) { console.error(e); } finally { setBusy(false); }
  };

  const drawWinners = async () => {
    if (!profile || busy || !isCreator || expired) return;
    if (entries.length === 0) { alert('No entries to draw from'); return; }
    setBusy(true);
    try {
      const pool = [...entries];
      const count = Math.min(giveaway.num_winners || 1, pool.length);
      const picked = [];
      for (let i = 0; i < count; i++) picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);

      const allPlayers = await getAllPlayers().catch(() => []);
      const winnerProfiles = picked.map(uid => allPlayers.find(p => p.user_id === uid)).filter(Boolean);

      if (isToken) {
        const amount = giveaway.token_amount || 0;
        for (const wp of winnerProfiles) {
          await base44.entities.PlayerProfile.update(wp.id, { tokens: (wp.tokens || 0) + amount });
        }
      } else if (giveaway.blook_id) {
        for (const wp of winnerProfiles) {
          const existing = await base44.entities.PlayerBlook.filter({ user_id: wp.user_id, blook_id: giveaway.blook_id });
          if (existing[0]) await base44.entities.PlayerBlook.update(existing[0].id, { quantity: (existing[0].quantity || 1) + 1 });
          else await base44.entities.PlayerBlook.create({ user_id: wp.user_id, blook_id: giveaway.blook_id, quantity: 1 });
        }
      }

      const winnersData = winnerProfiles.map(wp => ({ user_id: wp.user_id, username: wp.username }));
      await base44.entities.Giveaway.update(giveaway.id, { status: 'completed', winners: JSON.stringify(winnersData) });
      const names = winnersData.map(w => w.username).join(', ');
      await base44.entities.ChatMessage.create({
        content: `🎉 Giveaway "${giveaway.title}" ended! Winner${winnersData.length !== 1 ? 's' : ''}: ${names}`,
        username: 'Giveaway Bot', is_system: true, user_role: 'admin', game: 'icecreamet'
      });
      onChanged();
    } catch (e) { console.error(e); } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!giveaway} onOpenChange={(o) => { if (!o) onOpenChange(null); }}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {isToken ? <span className="text-3xl">🪙</span> : (giveaway.blook_image_url ? <img src={giveaway.blook_image_url} alt="" className="w-10 h-10 object-contain" /> : <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/0d5e6b887_image.png" alt="" className="w-8 h-8 object-contain" />)}
            <span>{giveaway.title}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-1 text-sm text-white/70 mb-2">
          <Crown size={14} className="text-yellow-400" /> {giveaway.creator_username}
        </div>
        <div className="flex items-center gap-3 text-xs text-white/60 mb-3">
          <span className="flex items-center gap-1"><Users size={12} /> x{giveaway.num_winners} winner{giveaway.num_winners !== 1 ? 's' : ''}</span>
          <span className="px-2 py-0.5 rounded bg-white/10">{giveaway.giveaway_type === 'elimination_wheel' ? 'Elimination Wheel' : '1 Random Winner'}</span>
        </div>
        {giveaway.description && <p className="text-sm text-white/70 mb-3">{giveaway.description}</p>}
        <div className="bg-white/5 rounded-lg p-3 mb-3">
          <p className="text-sm font-display text-[#a7fcc9] mb-1">Prize</p>
          {isToken ? <p className="text-white">🪙 {(giveaway.token_amount || 0).toLocaleString()} tokens</p> : <p className="text-white">{giveaway.blook_name}</p>}
        </div>
        <div className="bg-white/5 rounded-lg p-3 mb-3">
          <p className="text-sm font-display text-[#a7fcc9] mb-1">{entries.length} Entr{entries.length !== 1 ? 'ies' : 'y'}</p>
          {expired && winners.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs text-white/60 mb-1">Winner{winners.length !== 1 ? 's' : ''}:</p>
              {winners.map(w => <p key={w.user_id} className="text-sm text-yellow-300">👑 {w.username}</p>)}
            </div>
          ) : (
            <p className="text-xs text-white/60">{expired ? 'Awaiting winner draw' : 'Enter for a chance to win!'}</p>
          )}
        </div>
        <div className="text-xs text-white/50 mb-3">
          {expired ? 'This giveaway has ended.' : `Ends: ${new Date(giveaway.end_time).toLocaleString()}`}
        </div>
        {!expired && !isCreator && (
          entered ? (
            <Button disabled className="w-full" style={ACCENT}>Entered ✓</Button>
          ) : (
            <Button onClick={enter} disabled={busy} className="w-full" style={ACCENT}>{busy ? 'Entering...' : 'Enter Giveaway'}</Button>
          )
        )}
        {expired && isCreator && giveaway.status !== 'completed' && (
          <Button onClick={drawWinners} disabled={busy} className="w-full" style={ACCENT}>{busy ? 'Drawing...' : 'Draw Winners'}</Button>
        )}
      </DialogContent>
    </Dialog>
  );
}