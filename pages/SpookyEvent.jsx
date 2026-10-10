import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useGame } from '@/lib/gameContext';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import {
  SPOOKY_PRIZES, SPAWN_INTERVAL, SPAWN_UP_TIME, SEEDS_PER_SPAWN,
  isEventLive, EVENT_START, EVENT_END, parseClaimed, claimPrize, loadPrizes
} from '@/lib/spookyEvent';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';


const SPOOKY_HEADER = 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/ff29f309f_file_00000000f44081f59d87dcc8174b7ebd.png';

export default function SpookyEvent() {
  const { profile, updateProfile } = useGame();
  const { toast } = useToast();
  const [claimed, setClaimed] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [busy, setBusy] = useState(null);
  const [blooks, setBlooks] = useState([]);
  const [totalSeeds, setTotalSeeds] = useState(null);
  const [prizes, setPrizes] = useState(SPOOKY_PRIZES);
  const [adminOpen, setAdminOpen] = useState(false);
  const [newBlookId, setNewBlookId] = useState('');
  const [newSeeds, setNewSeeds] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);

  const isOwner = profile?.role === 'owner' || profile?.role === 'admin';

  // Live global seed total — sum of every player's pumpkin_seeds. Refreshed on
  // a slow interval instead of a realtime PlayerProfile subscription: that
  // broadcast fires on EVERY profile write in the whole app (every chat
  // message, token change, etc.), which re-ran this expensive cross-collection
  // aggregate each time and blew past the per-app rate limit under load.
  const refreshTotal = useCallback(() => {
    base44.entities.PlayerProfile.aggregate({ sum: 'pumpkin_seeds' })
      .then(res => setTotalSeeds(res?.sum_pumpkin_seeds ?? 0))
      .catch(() => setTotalSeeds(0));
  }, []);

  useEffect(() => { refreshTotal(); }, [refreshTotal]);

  useEffect(() => {
    const interval = setInterval(refreshTotal, 60000);
    const onFocus = () => refreshTotal();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, [refreshTotal]);

  // Build a name -> image map for prizes from the SPOOKY MONTH pack.
  useEffect(() => {
    if (blooks.length > 0) return;
    base44.entities.Blook.filter({ is_active: true, game: 'icecreamet', pack_id: '6abdc8898281b760c964c249' })
      .then(setBlooks).catch(() => {});
  }, [blooks]);

  // Load owner-managed prizes (falls back to hardcoded list).
  const refreshPrizes = useCallback(() => {
    loadPrizes().then(setPrizes).catch(() => {});
  }, []);
  useEffect(() => { refreshPrizes(); }, [refreshPrizes]);

  useEffect(() => {
    if (profile) setClaimed(parseClaimed(profile));
  }, [profile]);

  const loadLeaderboard = useCallback(() => {
    base44.entities.PlayerProfile.filter(
      { pumpkin_seeds: { $gt: 0 } },
      { sort: '-pumpkin_seeds', limit: 50, fields: ['username', 'pumpkin_seeds', 'avatar_url'] }
    ).then(page => setLeaderboard(page.items || [])).catch(() => {});
  }, []);

  useEffect(() => { loadLeaderboard(); }, [loadLeaderboard]);

  const seeds = profile?.pumpkin_seeds || 0;
  const blookMap = {};
  blooks.forEach(b => { blookMap[b.name] = b; });

  const handleClaim = async (prize) => {
    if (busy) return;
    setBusy(prize.name);
    try {
      const res = await claimPrize(prize.name);
      if (res?.ok) {
        const serverClaimed = res.claimed || [...claimed, prize.name];
        setClaimed(serverClaimed);
        // Persist the server's authoritative claim list into the live profile
        // so the whole app (counters, inventory reload, other tabs) reflects it
        // immediately instead of waiting for the next heartbeat.
        try { await updateProfile({ claimed_spooky_prizes: JSON.stringify(serverClaimed) }); } catch (e) {}
        toast({ title: `🎃 ${prize.name} Unlocked!`, description: `Added to your SPOOKY MONTH pack.` });
      } else {
        toast({ title: 'Could not claim', description: res?.error || 'Try again.', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Could not claim', description: e?.message || 'Try again.', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const claimedCount = claimed.length;
  const nextPrize = prizes.find(p => !claimed.includes(p.name) && seeds < p.seeds);
  const daysLeft = Math.max(0, Math.ceil((EVENT_END - Date.now()) / 86400000));

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl overflow-hidden border border-orange-400/40 mb-6 relative">
        <img src={SPOOKY_HEADER} alt="SPOOKY MONTH" className="w-full h-40 object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-display text-2xl drop-shadow spooky-month-gradient inline-block">SPOOKY MONTH EVENT</h2>
            <p className="text-white/80 text-xs mt-1">
              {daysLeft} day{daysLeft !== 1 ? 's' : ''} left · Collect 🎃 Pumpkin Seeds to unlock exclusive blooks!
            </p>
          </div>
          <Link to="/blooks" className="text-xs text-[#a7fcc9] hover:underline">View my blooks →</Link>
        </div>
      </div>

      {/* How to play + seed counter */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-panel rounded-2xl border border-white/10 p-4 sm:col-span-2">
          <h3 className="font-display text-[#a7fcc9] mb-2">How it works</h3>
          <ul className="text-sm text-white/80 space-y-1.5">
            <li>🕐 Every {SPAWN_INTERVAL / 60000} minutes, {SEEDS_PER_SPAWN} pumpkin seeds randomly pop up on your screen.</li>
            <li>🎯 Click them within {SPAWN_UP_TIME / 1000} seconds. Each seed = <span className="text-orange-300 font-display">1 🎃 seed collected</span>.</li>
            <li>🏆 Collect more seeds to unlock blooks below — your total goes to the event leaderboard.</li>
            <li>🧠 Seeds you earn stay saved, and prizes unlock automatically the moment you reach each milestone.</li>
          </ul>
          <p className="text-xs text-white/50 mt-3">
            Event runs {new Date(EVENT_START).toLocaleDateString()} → {new Date(EVENT_END).toLocaleDateString()}.
          </p>
        </div>
        {/* Live global tracker */}
        <div className="bg-panel rounded-2xl border border-[#a7fcc9]/40 p-4 sm:col-span-3 flex flex-col items-center justify-center text-center">
          <p className="text-xs text-white/60 uppercase tracking-wide mb-1">🌍 Total Seeds Collected</p>
          <p className="text-4xl font-display text-[#a7fcc9] my-2">
            {totalSeeds === null ? <span className="text-lg text-white/40">Loading…</span> : `🎃 ${totalSeeds.toLocaleString()}`}
          </p>
          <p className="text-[11px] text-white/50">across all players, live</p>
        </div>
        <div className="bg-panel rounded-2xl border border-orange-400/40 p-4 flex flex-col items-center justify-center text-center">
          <p className="text-xs text-white/60 uppercase tracking-wide mb-1">My Pumpkin Seeds</p>
          <p className="text-5xl font-display text-orange-300 my-2">🎃 {seeds}</p>
          <p className="text-[11px] text-white/50">
            {claimedCount}/{prizes.length} prizes unlocked
          </p>
          {!isEventLive() && <p className="text-xs text-red-300 mt-2">Event is not live right now.</p>}
        </div>
      </div>

      {/* Next prize goal */}
      {nextPrize && (
        <div className="bg-panel rounded-2xl border border-white/10 p-3 mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-white/60">Next prize:</span>
            <span className="text-sm font-display text-white truncate">{nextPrize.name}</span>
            <span className="text-[10px] uppercase rounded bg-orange-400/20 text-orange-200 px-2 py-0.5">{nextPrize.seeds} seeds</span>
          </div>
          <span className="text-xs text-white/60 shrink-0">{Math.min(seeds, nextPrize.seeds)}/{nextPrize.seeds}</span>
        </div>
      )}

      {/* Prizes */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-xl text-white">Prizes</h3>
        {isOwner && (
          <Button size="sm" variant="outline" onClick={() => setAdminOpen(o => !o)} className="border-orange-400/40 text-orange-300">
            {adminOpen ? 'Close Admin' : '⚙ Manage Prizes'}
          </Button>
        )}
      </div>

      {isOwner && adminOpen && (
        <div className="bg-panel rounded-2xl border border-orange-400/40 p-4 mb-6">
          <h4 className="font-display text-sm text-orange-300 mb-3">Add a Spooky Prize</h4>
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <select
              value={newBlookId}
              onChange={e => setNewBlookId(e.target.value)}
              className="flex-1 rounded-md bg-black/40 border border-white/20 text-white text-sm px-2 py-2"
            >
              <option value="">Pick a blook from the SPOOKY pack…</option>
              {blooks.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.rarity})</option>
              ))}
            </select>
            <Input
              type="number"
              min="1"
              value={newSeeds}
              onChange={e => setNewSeeds(e.target.value)}
              placeholder="Seeds needed"
              className="sm:w-40 bg-black/40 border-white/20 text-white placeholder:text-white/40"
            />
            <Button
              size="sm"
              disabled={!newBlookId || !newSeeds || adminBusy}
              onClick={async () => {
                const blook = blooks.find(b => b.id === newBlookId);
                if (!blook) return;
                setAdminBusy(true);
                try {
                  await base44.entities.SpookyPrize.create({
                    name: blook.name,
                    blook_id: blook.id,
                    seeds: Number(newSeeds),
                    active: true,
                    order: prizes.length
                  });
                  setNewBlookId('');
                  setNewSeeds('');
                  refreshPrizes();
                  toast({ title: 'Prize added', description: `${blook.name} — ${newSeeds} seeds` });
                } catch (e) {
                  toast({ title: 'Could not add prize', description: e?.message || 'Try again.', variant: 'destructive' });
                } finally {
                  setAdminBusy(false);
                }
              }}
              style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}
            >
              <Plus size={14} className="mr-1" /> Add
            </Button>
          </div>

          <div className="space-y-1.5">
            {prizes.filter(p => p.id).map(p => (
              <div key={p.id} className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-1.5">
                <span className="flex-1 text-sm text-white truncate">{p.name}</span>
                <span className="text-xs text-orange-300 font-display">{p.seeds} seeds</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-red-400 hover:text-red-300"
                  onClick={async () => {
                    try {
                      await base44.entities.SpookyPrize.delete(p.id);
                      refreshPrizes();
                    } catch (e) {
                      toast({ title: 'Could not remove', description: e?.message, variant: 'destructive' });
                    }
                  }}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
            {prizes.filter(p => !p.id).length > 0 && (
              <p className="text-[11px] text-white/40 pt-1">Default prizes are showing because no custom prizes have been added yet.</p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {prizes.map(prize => {
          const blook = blookMap[prize.name];
          const isUnlocked = claimed.includes(prize.name);
          const isClaimable = !isUnlocked && seeds >= prize.seeds;
          return (
            <div
              key={prize.name}
              className={`bg-panel rounded-2xl border p-3 transition-colors ${isUnlocked ? 'border-orange-400/60' : isClaimable ? 'border-[#a7fcc9]' : 'border-white/10'}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/40 shrink-0 flex items-center justify-center">
                  {blook?.image_url ? (
                    <img src={blook.image_url} alt={prize.name} className="w-full h-full object-contain" style={isUnlocked ? {} : { filter: 'brightness(0.4)' }} />
                  ) : (
                    <span className="text-2xl">{isUnlocked ? '🎃' : '🔒'}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm text-white truncate">{prize.name}</p>
                  <p className="text-[10px] uppercase text-white/50"><span className={`rarity-${blook?.rarity || 'unique'}`}>{blook?.rarity || 'Unique'}</span> · {prize.seeds} seeds</p>
                </div>
              </div>
              <div className="mt-3">
                {isUnlocked ? (
                  <span className="w-full block text-center text-xs font-display text-orange-300 border border-orange-400/40 rounded-lg py-1.5">Unlocked ✔</span>
                ) : (
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!isClaimable || busy !== null}
                    onClick={() => handleClaim(prize)}
                    style={isClaimable ? { backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' } : {}}
                  >
                    {busy === prize.name ? 'Claiming...' : isClaimable ? 'Claim' : `${prize.seeds - seeds} more`}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Leaderboard */}
      <h3 className="font-display text-xl text-white mb-3">Event Leaderboard</h3>
      <div className="bg-panel rounded-2xl border border-white/10 overflow-hidden mb-6">
        {leaderboard.length === 0 ? (
          <p className="text-white/60 text-sm text-center py-8">No seeds collected yet — be the first!</p>
        ) : (
          <div className="divide-y divide-white/5">
            {leaderboard.map((p, i) => {
              const isMe = profile && p.user_id === profile.user_id;
              return (
                <div key={p.id || i} className={`flex items-center gap-3 px-4 py-2.5 ${isMe ? 'bg-orange-400/10' : ''}`}>
                  <span className={`w-6 text-center font-display ${i === 0 ? 'text-yellow-300' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-white/50'}`}>{i + 1}</span>
                  <div className="w-8 h-8 avatar-rounded-square bg-white/10 overflow-hidden shrink-0">
                    {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-contain" /> : <div className="w-full h-full flex items-center justify-center text-xs text-white">{p.username?.[0]?.toUpperCase()}</div>}
                  </div>
                  <span className={`flex-1 truncate text-sm ${isMe ? 'text-orange-300' : 'text-white'}`}>{p.username}{isMe ? ' (you)' : ''}</span>
                  <span className="text-sm font-display text-orange-300">🎃 {p.pumpkin_seeds}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-center pb-4">
        <Button variant="outline" size="sm" asChild className="border-white/20 text-white">
          <Link to="/stats">← Back to Locker</Link>
        </Button>
      </div>
    </div>
  );
}