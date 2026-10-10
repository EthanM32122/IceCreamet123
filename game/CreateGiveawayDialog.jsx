import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DURATIONS = [
  { label: '1 Hour', ms: 3600000 },
  { label: '6 Hours', ms: 21600000 },
  { label: '1 Day', ms: 86400000 },
  { label: '3 Days', ms: 259200000 },
  { label: '1 Week', ms: 604800000 },
];

const ACCENT = { backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' };

export default function CreateGiveawayDialog({ open, onOpenChange, onCreated }) {
  const { profile, updateProfile } = useGame();
  const [myBlooks, setMyBlooks] = useState([]);
  const [allBlooks, setAllBlooks] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [prizeType, setPrizeType] = useState('tokens');
  const [tokenAmount, setTokenAmount] = useState(1000);
  const [selectedBlook, setSelectedBlook] = useState(null);
  const [numWinners, setNumWinners] = useState(1);
  const [giveawayType, setGiveawayType] = useState('random_winner');
  const [duration, setDuration] = useState(86400000);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile || !open) return;
    Promise.all([
      base44.entities.PlayerBlook.filter({ user_id: profile.user_id, game: 'icecreamet' }),
      base44.entities.Blook.filter({ game: 'icecreamet', is_deleted: false })
    ]).then(([pb, ab]) => {
      setMyBlooks(pb);
      setAllBlooks(ab);
    });
  }, [profile, open]);

  const blookMap = {};
  allBlooks.forEach(b => { blookMap[b.id] = b; });
  const ownedList = myBlooks.map(pb => ({ ...blookMap[pb.blook_id], pbId: pb.id, quantity: pb.quantity })).filter(b => b && b.id);

  const reset = () => {
    setTitle(''); setDescription(''); setTokenAmount(1000); setSelectedBlook(null);
    setNumWinners(1); setGiveawayType('random_winner'); setPrizeType('tokens'); setDuration(86400000);
  };

  const submit = async () => {
    if (!profile || busy || !title.trim()) return;
    if (prizeType === 'tokens' && (!tokenAmount || Number(tokenAmount) <= 0)) return;
    if (prizeType === 'blook' && !selectedBlook) return;
    if (prizeType === 'tokens' && (profile.tokens || 0) < Number(tokenAmount)) { alert('Not enough tokens'); return; }
    setBusy(true);
    try {
      let blookId = '', blookName = '', blookImage = '';
      if (prizeType === 'blook') {
        const sel = ownedList.find(b => b.id === selectedBlook);
        blookId = sel.id; blookName = sel.name; blookImage = sel.image_url || '';
        if (sel.quantity <= 1) await base44.entities.PlayerBlook.delete(sel.pbId);
        else await base44.entities.PlayerBlook.update(sel.pbId, { quantity: sel.quantity - 1 });
      } else {
        await updateProfile({ tokens: (profile.tokens || 0) - Number(tokenAmount) });
      }
      await base44.entities.Giveaway.create({
        creator_id: profile.user_id,
        creator_username: profile.username,
        creator_avatar: profile.avatar_url || '',
        title: title.trim(),
        description: description.trim(),
        prize_type: prizeType,
        blook_id: blookId,
        blook_name: blookName,
        blook_image_url: blookImage,
        token_amount: prizeType === 'tokens' ? Number(tokenAmount) : 0,
        num_winners: Math.max(1, Number(numWinners) || 1),
        giveaway_type: giveawayType,
        status: 'active',
        end_time: new Date(Date.now() + duration).toISOString(),
        entries: '[]',
        winners: '[]'
      });
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e) {
      console.error('create giveaway failed', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>List a Giveaway</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Giveaway title" />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
          </div>
          <div>
            <Label>Prize Type</Label>
            <div className="flex gap-2">
              <Button size="sm" variant={prizeType === 'tokens' ? 'default' : 'outline'} onClick={() => setPrizeType('tokens')} style={prizeType === 'tokens' ? ACCENT : {}}>Tokens</Button>
              <Button size="sm" variant={prizeType === 'blook' ? 'default' : 'outline'} onClick={() => setPrizeType('blook')} style={prizeType === 'blook' ? ACCENT : {}}>Blook</Button>
            </div>
          </div>
          {prizeType === 'tokens' ? (
            <div>
              <Label>Token Amount</Label>
              <Input type="number" value={tokenAmount} onChange={e => setTokenAmount(e.target.value)} />
              <p className="text-[10px] text-white/50 mt-1">Balance: 🪙 {(profile.tokens || 0).toLocaleString()}</p>
            </div>
          ) : (
            <div>
              <Label>Select a blook from your inventory</Label>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                {ownedList.map(b => (
                  <button key={b.id} onClick={() => setSelectedBlook(b.id)} className={`rounded-lg border-2 p-1 ${selectedBlook === b.id ? 'border-[#a7fcc9] bg-[#a7fcc9]/20' : 'border-white/10'}`}>
                    {b.image_url ? <img src={b.image_url} alt={b.name} className="w-full aspect-square object-contain" /> : <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/0d5e6b887_image.png" alt="" className="w-8 h-8 object-contain" />}
                    <p className="text-[9px] text-white/60 truncate mt-0.5">x{b.quantity}</p>
                  </button>
                ))}
                {ownedList.length === 0 && <p className="col-span-full text-white/50 text-sm text-center py-4">No blooks available</p>}
              </div>
            </div>
          )}
          <div>
            <Label>Number of Winners</Label>
            <Input type="number" min="1" value={numWinners} onChange={e => setNumWinners(e.target.value)} />
          </div>
          <div>
            <Label>Giveaway Type</Label>
            <div className="flex gap-2">
              <Button size="sm" variant={giveawayType === 'random_winner' ? 'default' : 'outline'} onClick={() => setGiveawayType('random_winner')} style={giveawayType === 'random_winner' ? ACCENT : {}}>1 Random Winner</Button>
              <Button size="sm" variant={giveawayType === 'elimination_wheel' ? 'default' : 'outline'} onClick={() => setGiveawayType('elimination_wheel')} style={giveawayType === 'elimination_wheel' ? ACCENT : {}}>Elimination Wheel</Button>
            </div>
          </div>
          <div>
            <Label>Duration</Label>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map(d => (
                <Button key={d.ms} size="sm" variant={duration === d.ms ? 'default' : 'outline'} onClick={() => setDuration(d.ms)} style={duration === d.ms ? ACCENT : {}}>{d.label}</Button>
              ))}
            </div>
          </div>
          <Button onClick={submit} disabled={busy || !title.trim()} className="w-full" style={ACCENT}>{busy ? 'Creating...' : 'Create Giveaway'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}