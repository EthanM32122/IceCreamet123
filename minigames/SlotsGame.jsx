import React, { useState, useEffect } from 'react';
import { useGame } from '@/lib/gameContext';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Coins, Sparkles } from 'lucide-react';

const SLOT_SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'];
const BLOOK_CHANCE = 0.10;

export default function SlotsGame({ locked, lockReason }) {
  const { profile, updateProfile } = useGame();
  const [bet, setBet] = useState(100);
  const [result, setResult] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [displayReels, setDisplayReels] = useState(['🍒', '🍋', '🔔']);
  const [allBlooks, setAllBlooks] = useState([]);
  const [excludedPackIds, setExcludedPackIds] = useState(new Set());
  const [blookWin, setBlookWin] = useState(null);

  useEffect(() => {
    base44.entities.Blook.filter({ is_active: true, is_deleted: false, game: 'icecreamet' }, null, 2000).then(setAllBlooks).catch(() => {});
    base44.entities.Pack.list().then((packs) => {
      setExcludedPackIds(new Set(packs.filter((p) => /golden|summer/i.test(p.name || '')).map((p) => p.id)));
    }).catch(() => {});
  }, []);

  const awardBlook = async () => {
    const pool = allBlooks.filter((b) => !excludedPackIds.has(b.pack_id) && !/icecreamy'?s birthday cake/i.test(b.name || ''));
    if (pool.length === 0) return null;
    const won = pool[Math.floor(Math.random() * pool.length)];
    const existing = await base44.entities.PlayerBlook.filter({ user_id: profile.user_id, blook_id: won.id, game: 'icecreamet' });
    if (existing.length) {
      await base44.entities.PlayerBlook.update(existing[0].id, { quantity: (existing[0].quantity || 1) + 1 });
    } else {
      await base44.entities.PlayerBlook.create({ user_id: profile.user_id, blook_id: won.id, quantity: 1, game: 'icecreamet' });
    }
    return won;
  };

  const playSlots = async () => {
    if (!profile || playing || bet <= 0 || bet > (profile.tokens || 0) || locked) return;
    if (!profile.minigame_window_start && !profile.minigame_cooldown_until) {
      await updateProfile({ minigame_window_start: new Date().toISOString() });
    }
    setPlaying(true);
    setResult(null);
    setSpinning(true);

    const spinInterval = setInterval(() => {
      setDisplayReels([0, 1, 2].map(() => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]));
    }, 80);

    await new Promise((r) => setTimeout(r, 900));
    clearInterval(spinInterval);
    setSpinning(false);

    const reels = [0, 1, 2].map(() => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]);
    setDisplayReels(reels);
    const won = reels[0] === reels[1] && reels[1] === reels[2];
    const twoMatch = !won && (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]);
    let payout = 0;
    if (won) payout = reels[0] === '💎' ? bet * 25 : reels[0] === '7️⃣' ? bet * 15 : bet * 8;
    else if (twoMatch) payout = Math.floor(bet * 1.5);

    let wonBlook = null;
    if (won && Math.random() < BLOOK_CHANCE) {
      wonBlook = await awardBlook();
    }

    if (payout > 0) {
      await updateProfile({ tokens: (profile.tokens || 0) + payout });
    } else {
      await updateProfile({ tokens: (profile.tokens || 0) - bet });
    }

    setResult({ reels, won, twoMatch, payout, blook: wonBlook });
    if (wonBlook) setBlookWin(wonBlook);
    setPlaying(false);
  };

  return (
    <div className="text-center">
      <h3 className="font-display text-xl text-[#a7fcc9] mb-1">🎰 Slots</h3>
      <p className="text-xs text-white/50 mb-4">
        Match 3 for up to 25x · 2 match = 1.5x · <span className="text-[#a7fcc9]">10% bonus blook on a 3-match!</span>
      </p>

      {locked && (
        <div className="bg-red-500/15 border border-red-500/30 rounded-xl p-3 mb-4">
          <p className="text-red-400 font-display text-sm">⏰ Slots locked</p>
          <p className="text-xs text-white/70 mt-1">{lockReason}</p>
        </div>
      )}

      {/* Balance + Bet */}
      <div className="bg-white/5 rounded-xl p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Coins size={16} className="text-[#a7fcc9]" />
            <span className="text-white text-sm">
              Balance: <span className="text-[#a7fcc9] font-display">{(profile?.tokens || 0).toLocaleString()}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-white/50">Bet:</span>
          <Input
            type="number"
            value={bet}
            onChange={(e) => setBet(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-28 bg-white/10 border-white/20 text-white"
          />
          <Button size="sm" variant="outline" onClick={() => setBet(100)} className="border-white/20 text-white">100</Button>
          <Button size="sm" variant="outline" onClick={() => setBet(1000)} className="border-white/20 text-white">1K</Button>
          <Button size="sm" variant="outline" onClick={() => setBet(Math.min(profile?.tokens || 0, 10000))} className="border-white/20 text-white">10K</Button>
        </div>
      </div>

      {/* Reels */}
      <div className="flex justify-center gap-3 mb-4">
        {displayReels.map((s, i) => (
          <div
            key={i}
            className={`w-20 h-20 rounded-xl bg-black/50 border-2 border-white/15 flex items-center justify-center text-5xl ${spinning ? 'animate-pulse' : ''}`}
          >
            {s}
          </div>
        ))}
      </div>

      {/* Result */}
      {result?.reels && !spinning && (
        <div
          className={`mb-4 p-3 rounded-xl ${
            result.payout > 0 || result.blook
              ? 'bg-green-500/15 border border-green-500/30'
              : 'bg-red-500/15 border border-red-500/30'
          }`}
        >
          <p className={result.payout > 0 || result.blook ? 'text-green-400 font-display' : 'text-red-400 font-display'}>
            {result.payout > 0 ? `🎉 Won 🪙 ${result.payout.toLocaleString()}!` : 'No match'}
          </p>
          {result.blook && (
            <p className="text-[#a7fcc9] font-display text-sm mt-1 flex items-center justify-center gap-1">
              <Sparkles size={14} /> Bonus blook: {result.blook.name}!
            </p>
          )}
        </div>
      )}

      <Button
        size="lg"
        onClick={playSlots}
        disabled={playing || bet <= 0 || bet > (profile?.tokens || 0) || locked}
        style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}
        className="text-lg font-display px-10"
      >
        {spinning ? 'Spinning...' : '🎰 Spin'}
      </Button>

      {/* Blook win dialog */}
      <Dialog open={!!blookWin} onOpenChange={(v) => !v && setBlookWin(null)}>
        <DialogContent className="bg-panel border-[#a7fcc9]/40 text-center max-w-sm">
          <h3 className="font-display text-[#a7fcc9] text-xl flex items-center justify-center gap-2">
            <Sparkles size={18} /> Slots Bonus!
          </h3>
          <p className="text-xs text-white/60 mt-1">You won a random blook from the slots!</p>
          {blookWin?.image_url && (
            <img src={blookWin.image_url} alt="" className="w-28 h-28 object-contain mx-auto my-3 animate-blook-rise" />
          )}
          <p className={`font-display text-lg rarity-${blookWin?.rarity}`}>{blookWin?.name}</p>
          <p className="text-xs text-white/50 capitalize">{blookWin?.rarity}</p>
          <Button
            onClick={() => setBlookWin(null)}
            className="mt-4"
            style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}
          >
            Awesome!
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}