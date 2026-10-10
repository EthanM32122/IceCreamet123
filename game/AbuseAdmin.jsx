import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { ABUSE_DURATION } from '@/components/game/AdminAbuse';
import { announceAbuse } from '@/components/game/AdminAbuse';
import { getAllPlayers } from '@/lib/playersCache';
import { getActiveBlooks } from '@/lib/gameDataCache';
import { isBlookAdminRestricted } from '@/lib/adminRestrictions';

// Co-owner+ control panel for Admin Abuse. Lives as a tab in the Admin Panel.
export default function AbuseAdmin({ adminProfile }) {
  const { toast } = useToast();
  const [session, setSession] = useState(null);
  const [secsLeft, setSecsLeft] = useState(0);
  const [globalMsg, setGlobalMsg] = useState('');
  const [players, setPlayers] = useState([]);
  const [blooks, setBlooks] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [targetUsername, setTargetUsername] = useState('');
  const [giveMode, setGiveMode] = useState('tokens');
  const [giveAmount, setGiveAmount] = useState(1000);
  const [selectedBlook, setSelectedBlook] = useState('');
  const [giving, setGiving] = useState(false);
  const [search, setSearch] = useState('');
  const [packMap, setPackMap] = useState({});
  const [duration, setDuration] = useState(3);
  const [rainBlook, setRainBlook] = useState('');
  const [blookRaining, setBlookRaining] = useState(false);
  const [diamondAmt, setDiamondAmt] = useState(1);
  const [diamondRaining, setDiamondRaining] = useState(false);
  const [luckyWinners, setLuckyWinners] = useState(3);
  const [luckyAmount, setLuckyAmount] = useState(5000);
  const [luckyDrawing, setLuckyDrawing] = useState(false);

  const loadSession = useCallback(async () => {
    try {
      const rows = await base44.entities.AdminAbuse.list({ limit: 5 });
      const active = (rows.items || rows).find(r => r.active);
      setSession(active || null);
    } catch { setSession(null); }
  }, []);

  useEffect(() => { loadSession(); }, [loadSession]);

  // Live seconds-left countdown while a session runs.
  useEffect(() => {
    if (!session?.active || !session.ends_at) return;
    const tick = () => {
      const left = Math.max(0, new Date(session.ends_at).getTime() - Date.now());
      setSecsLeft(Math.ceil(left / 1000));
      if (left <= 0) loadSession();
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [session, loadSession]);

  useEffect(() => { getAllPlayers().then(setPlayers).catch(() => {}); }, []);
  useEffect(() => {
    getActiveBlooks().then(setBlooks).catch(() => {});
    base44.entities.Pack.filter({}).then(packs => {
      const m = {};
      (packs.items || packs).forEach(p => { if (p && p.id) m[p.id] = p; });
      setPackMap(m);
    }).catch(() => {});
  }, []);

  // Blooks that admins are NOT allowed to grant (Hivelands, PAC3, Summer, Golden, Spooky, trophies, etc.)
  const grantableBlooks = blooks.filter(b => !isBlookAdminRestricted(b, packMap));

  const start = async () => {
    try {
      const recs = await base44.entities.AdminAbuse.list({ limit: 5 });
      const record = (recs.items || recs)[0];
      const now = Date.now();
      const payload = {
        active: true,
        started_at: new Date(now).toISOString(),
        ends_at: new Date(now + duration * 60 * 1000).toISOString(),
        host_id: adminProfile?.user_id || '',
        host_username: adminProfile?.username || ''
      };
      if (record) {
        await base44.entities.AdminAbuse.update(record.id, payload);
      } else {
        await base44.entities.AdminAbuse.create(payload);
      }
      toast({ title: '🎉 Admin Abuse Started!', description: `${adminProfile?.username} turned on Admin Abuse for 3 minutes. Click blooks for tokens!` });
      await announceAbuse(`🚨 ADMIN ABUSE! ${adminProfile?.username} turned on the giveaway for 3 minutes — click the blooks on screen for tokens!`);
      await loadSession();
    } catch (e) {
      toast({ title: 'Failed to start', description: e?.message || 'Unknown error', variant: 'destructive' });
    }
  };

  const stop = async () => {
    if (!session) return;
    try {
      await base44.entities.AdminAbuse.update(session.id, { active: false, ends_at: new Date().toISOString() });
      toast({ title: 'Admin Abuse ended', description: 'Thanks for playing!' });
      await announceAbuse(`🛑 Admin Abuse has ended. Thanks for playing!`);
      await loadSession();
    } catch (e) {
      toast({ title: 'Failed to end', description: e?.message || 'Unknown error', variant: 'destructive' });
    }
  };

  const sendGlobal = async () => {
    if (!globalMsg.trim()) return;
    await announceAbuse(`📣 ${adminProfile?.username}: ${globalMsg.trim()}`);
    setGlobalMsg('');
    toast({ title: 'Sent to global chat' });
  };

  const giveToUser = async () => {
    // Resolve target from typed username first, then fall back to the dropdown.
    const typed = targetUsername.trim().replace(/^@/, '');
    const target = typed
      ? players.find(p => (p.username || '').toLowerCase() === typed.toLowerCase())
      : players.find(p => p.user_id === selectedUser);
    if (!target) {
      toast({ title: typed ? `User "@${typed}" not found` : 'Select a user first', variant: 'destructive' });
      return;
    }
    if (target.user_id === adminProfile?.user_id) {
      toast({ title: "You can't give items to yourself", variant: 'destructive' });
      return;
    }
    setGiving(true);
    try {
      if (giveMode === 'tokens') {
        const amt = parseInt(giveAmount) || 0;
        if (amt <= 0) throw new Error('Enter a token amount');
        await base44.entities.PlayerProfile.update(target.id, { tokens: (target.tokens || 0) + amt });
        await announceAbuse(`🎁 ${adminProfile?.username} gave ${target.username} ${amt.toLocaleString()} tokens!`);
      } else {
        if (!selectedBlook) { toast({ title: 'Select a blook first', variant: 'destructive' }); return; }
        const blook = grantableBlooks.find(b => b.id === selectedBlook);
        if (!blook) { toast({ title: 'That blook cannot be granted', variant: 'destructive' }); setGiving(false); return; }
        const existing = await base44.entities.PlayerBlook.filter({ user_id: target.user_id, blook_id: selectedBlook });
        if (existing.length) {
          await base44.entities.PlayerBlook.update(existing[0].id, { quantity: (existing[0].quantity || 0) + 1 });
        } else {
          await base44.entities.PlayerBlook.create({ user_id: target.user_id, blook_id: selectedBlook, quantity: 1, game: blook?.game || 'icecreamet' });
        }
        await announceAbuse(`🎁 ${adminProfile?.username} gave ${target.username} a ${blook?.name || 'blook'}!`);
      }
      toast({ title: 'Given! Announced in global chat.' });
    } catch (e) {
      toast({ title: 'Failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    }
    setGiving(false);
  };

  // Add 30 seconds to the running session.
  const extendSession = async () => {
    if (!session?.active || !session.ends_at) { toast({ title: 'No active session', variant: 'destructive' }); return; }
    try {
      const baseEnd = Math.max(Date.now(), new Date(session.ends_at).getTime());
      const newEnd = new Date(baseEnd + 30000).toISOString();
      await base44.entities.AdminAbuse.update(session.id, { ends_at: newEnd });
      await announceAbuse(`⏱ ${adminProfile?.username} extended Admin Abuse by 30 seconds!`);
      toast({ title: '+30 seconds!' });
      await loadSession();
    } catch (e) {
      toast({ title: 'Failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    }
  };

  // Give tokens to every known player at once (mega token rain).
  const [raining, setRaining] = useState(false);
  const megaTokenRain = async () => {
    if (players.length === 0) { toast({ title: 'No players loaded', variant: 'destructive' }); return; }
    setRaining(true);
    try {
      const amt = parseInt(giveAmount) || 500;
      const updates = players.map(p => ({
        id: p.id,
        tokens: (p.tokens || 0) + amt
      }));
      await base44.entities.PlayerProfile.bulkUpdate(updates);
      await announceAbuse(`🌧 MEGA TOKEN RAIN! ${adminProfile?.username} rained ${amt.toLocaleString()} tokens on ALL ${players.length} players!`);
      toast({ title: `Rained ${amt.toLocaleString()} tokens on ${players.length} players!` });
    } catch (e) {
      toast({ title: 'Failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    }
    setRaining(false);
  };

  // Give a random blook to a random player.
  const [randGiving, setRandGiving] = useState(false);
  const randomBlookRain = async () => {
    if (players.length === 0 || grantableBlooks.length === 0) { toast({ title: 'No players/blooks loaded', variant: 'destructive' }); return; }
    setRandGiving(true);
    try {
      const target = players[Math.floor(Math.random() * players.length)];
      const blook = grantableBlooks[Math.floor(Math.random() * grantableBlooks.length)];
      if (!blook?.id) throw new Error('No blook');
      const existing = await base44.entities.PlayerBlook.filter({ user_id: target.user_id, blook_id: blook.id });
      if (existing.length) {
        await base44.entities.PlayerBlook.update(existing[0].id, { quantity: (existing[0].quantity || 0) + 1 });
      } else {
        await base44.entities.PlayerBlook.create({ user_id: target.user_id, blook_id: blook.id, quantity: 1, game: blook?.game || 'icecreamet' });
      }
      await announceAbuse(`🍀 ${adminProfile?.username} dropped a random ${blook.name} on @${target.username}!`);
      toast({ title: `Dropped ${blook.name} on @${target.username}!` });
    } catch (e) {
      toast({ title: 'Failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    }
    setRandGiving(false);
  };

  // Give a specific blook to every player at once (blook rain).
  const blookRain = async () => {
    if (players.length === 0 || !rainBlook) { toast({ title: 'Select a blook and load players', variant: 'destructive' }); return; }
    const blook = grantableBlooks.find(b => b.id === rainBlook);
    if (!blook) { toast({ title: 'That blook cannot be granted', variant: 'destructive' }); return; }
    setBlookRaining(true);
    try {
      const existing = await base44.entities.PlayerBlook.filter({ blook_id: rainBlook });
      const existingMap = {};
      existing.forEach(p => { existingMap[p.user_id] = p; });
      const toUpdate = [];
      const toCreate = [];
      for (const p of players) {
        const ex = existingMap[p.user_id];
        if (ex) {
          toUpdate.push({ id: ex.id, quantity: (ex.quantity || 0) + 1 });
        } else {
          toCreate.push({ user_id: p.user_id, blook_id: rainBlook, quantity: 1, game: blook?.game || 'icecreamet' });
        }
      }
      if (toUpdate.length) await base44.entities.PlayerBlook.bulkUpdate(toUpdate);
      if (toCreate.length) await base44.entities.PlayerBlook.bulkCreate(toCreate);
      await announceAbuse(`🌧 BLOOK RAIN! ${adminProfile?.username} rained a ${blook.name} on ALL ${players.length} players!`);
      toast({ title: `Rained ${blook.name} on ${players.length} players!` });
    } catch (e) {
      toast({ title: 'Failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    }
    setBlookRaining(false);
  };

  // Give diamonds to every player at once.
  const diamondRain = async () => {
    if (players.length === 0) { toast({ title: 'No players loaded', variant: 'destructive' }); return; }
    setDiamondRaining(true);
    try {
      const amt = parseInt(diamondAmt) || 1;
      const updates = players.map(p => ({ id: p.id, diamonds: (p.diamonds || 0) + amt }));
      await base44.entities.PlayerProfile.bulkUpdate(updates);
      await announceAbuse(`💎 DIAMOND RAIN! ${adminProfile?.username} rained ${amt} diamond${amt > 1 ? 's' : ''} on ALL ${players.length} players!`);
      toast({ title: `Rained ${amt} diamond${amt > 1 ? 's' : ''} on ${players.length} players!` });
    } catch (e) {
      toast({ title: 'Failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    }
    setDiamondRaining(false);
  };

  // Pick N random winners and give each tokens.
  const luckyDraw = async () => {
    if (players.length === 0) { toast({ title: 'No players loaded', variant: 'destructive' }); return; }
    setLuckyDrawing(true);
    try {
      const n = Math.min(parseInt(luckyWinners) || 1, players.length);
      const amt = parseInt(luckyAmount) || 1000;
      const shuffled = [...players].sort(() => Math.random() - 0.5);
      const winners = shuffled.slice(0, n);
      const updates = winners.map(p => ({ id: p.id, tokens: (p.tokens || 0) + amt }));
      await base44.entities.PlayerProfile.bulkUpdate(updates);
      const winnerNames = winners.map(w => `@${w.username}`).join(', ');
      await announceAbuse(`🍀 LUCKY DRAW! ${adminProfile?.username} drew ${n} winner${n > 1 ? 's' : ''} — ${winnerNames} each won ${amt.toLocaleString()} tokens!`);
      toast({ title: `${n} winner${n > 1 ? 's' : ''} drawn!` });
    } catch (e) {
      toast({ title: 'Failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    }
    setLuckyDrawing(false);
  };

  const filteredPlayers = players.filter(p => p.username?.toLowerCase().includes(search.toLowerCase())).slice(0, 50);
  const filteredBlooks = grantableBlooks.filter(b => b.image_url && b.name?.toLowerCase().includes(search.toLowerCase())).slice(0, 50);
  const live = session?.active && secsLeft > 0;
  const typedUsername = targetUsername.trim().replace(/^@/, '');
  const resolvedTarget = typedUsername
    ? players.find(p => (p.username || '').toLowerCase() === typedUsername.toLowerCase())
    : null;
  const isSelfTarget = resolvedTarget?.user_id === adminProfile?.user_id;
  const canGive = (typedUsername || selectedUser) && (resolvedTarget || selectedUser) && !isSelfTarget;

  return (
    <div className="space-y-4">
      <div className="bg-panel rounded-xl border border-white/10 p-4">
        <h3 className="font-display text-[#a7fcc9] mb-2">⚡ Admin Abuse</h3>
        <p className="text-xs text-white/60 mb-3">Co-owner+ only. Blooks float across every player's screen; clicking gives tokens (Pumpkin King gives a seed, 1% chance to spawn).</p>
        <div className="flex items-center gap-3 flex-wrap">
          {!live && (
            <select value={duration} onChange={e => setDuration(parseInt(e.target.value))} className="bg-white/10 border border-white/20 rounded-md px-2 py-1.5 text-sm text-white">
              <option value={1}>1 min</option>
              <option value={3}>3 min</option>
              <option value={5}>5 min</option>
              <option value={10}>10 min</option>
            </select>
          )}
          <Button onClick={live ? stop : start} style={{ backgroundColor: live ? '#ef4444' : '#a7fcc9', color: live ? '#fff' : 'rgb(var(--user-sidebar))' }}>
            {live ? `⏱ End Session (${secsLeft}s)` : `▶ Start Abuse (${duration} min)`}
          </Button>
          {live && (
            <>
              <Button onClick={extendSession} variant="outline" className="border-white/20 text-white hover:bg-white/10">
                +30s
              </Button>
              <span className="text-xs font-display text-green-400 animate-pulse">LIVE — clicking blooks gives tokens!</span>
            </>
          )}
        </div>
      </div>

      {/* Mass giveaway actions */}
      <div className="bg-panel rounded-xl border border-white/10 p-4">
        <h3 className="font-display text-[#a7fcc9] mb-2">🌧 Mass Giveaways</h3>
        <p className="text-xs text-white/60 mb-3">Hit the whole server at once. Announced in global chat.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <Button onClick={megaTokenRain} disabled={raining || players.length === 0} style={{ backgroundColor: '#facc15', color: 'rgb(var(--user-sidebar))' }}>
            {raining ? 'Raining...' : `🌧 Token Rain (${parseInt(giveAmount)||500} ea)`}
          </Button>
          <div className="flex items-center gap-1">
            <Input type="number" value={diamondAmt} onChange={e => setDiamondAmt(e.target.value)} className="w-16 h-9 bg-white/10 border-white/20 text-white" />
            <Button onClick={diamondRain} disabled={diamondRaining || players.length === 0} style={{ backgroundColor: '#60a5fa', color: '#fff' }}>
              {diamondRaining ? 'Raining...' : '💎 Diamond Rain'}
            </Button>
          </div>
          <Button onClick={randomBlookRain} disabled={randGiving || players.length === 0 || blooks.length === 0} variant="outline" className="border-white/20 text-white hover:bg-white/10">
            {randGiving ? 'Dropping...' : '🍀 Random Blook → Random Player'}
          </Button>
        </div>

        {/* Blook Rain */}
        <div className="flex flex-wrap items-end gap-2 mb-3 pt-3 border-t border-white/10">
          <div className="flex-1 min-w-[200px]">
            <p className="text-xs text-white/50 mb-1">Blook Rain — give 1 of this blook to ALL players</p>
            <select value={rainBlook} onChange={e => setRainBlook(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-md px-2 py-1.5 text-sm text-white">
              <option value="">Select blook...</option>
              {grantableBlooks.filter(b => b.image_url).slice(0, 100).map(b => <option key={b.id} value={b.id}>{b.name} ({b.rarity})</option>)}
            </select>
          </div>
          <Button onClick={blookRain} disabled={blookRaining || !rainBlook || players.length === 0} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
            {blookRaining ? 'Raining...' : '🌧 Rain Blook'}
          </Button>
        </div>

        {/* Lucky Draw */}
        <div className="flex flex-wrap items-end gap-2 pt-3 border-t border-white/10">
          <div>
            <p className="text-xs text-white/50 mb-1">Winners</p>
            <Input type="number" value={luckyWinners} onChange={e => setLuckyWinners(e.target.value)} className="w-20 bg-white/10 border-white/20 text-white" />
          </div>
          <div>
            <p className="text-xs text-white/50 mb-1">Tokens each</p>
            <Input type="number" value={luckyAmount} onChange={e => setLuckyAmount(e.target.value)} className="w-28 bg-white/10 border-white/20 text-white" />
          </div>
          <Button onClick={luckyDraw} disabled={luckyDrawing || players.length === 0} style={{ backgroundColor: '#f472b6', color: '#fff' }}>
            {luckyDrawing ? 'Drawing...' : '🍀 Lucky Draw'}
          </Button>
        </div>
        <p className="text-xs text-white/40 mt-2">Token Rain uses the amount from the "Give to a User" box below.</p>
      </div>

      {/* Global chat message */}
      <div className="bg-panel rounded-xl border border-white/10 p-4">
        <h3 className="font-display text-[#a7fcc9] mb-2">📣 Global Chat Message</h3>
        <div className="flex gap-2">
          <Input value={globalMsg} onChange={e => setGlobalMsg(e.target.value)} placeholder="Send a message to global chat..." className="flex-1 bg-white/10 border-white/20 text-white" maxLength={500} />
          <Button onClick={sendGlobal} disabled={!globalMsg.trim()} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Send</Button>
        </div>
      </div>

      {/* Give to a user */}
      <div className="bg-panel rounded-xl border border-white/10 p-4">
        <h3 className="font-display text-[#a7fcc9] mb-2">🎁 Give to a User</h3>
        <p className="text-xs text-white/60 mb-3">Type the player's username, then give tokens or a blook. The award is announced in global chat. You can't give to yourself.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-white/50 mb-1">Username</p>
            <Input
              value={targetUsername}
              onChange={e => setTargetUsername(e.target.value)}
              placeholder="Type username (e.g. icecreamy)"
              className="bg-white/10 border-white/20 text-white"
            />
            {typedUsername && !resolvedTarget && (
              <p className="text-xs text-red-400 mt-1">User "{typedUsername}" not found</p>
            )}
            {isSelfTarget && (
              <p className="text-xs text-red-400 mt-1">You can't give items to yourself</p>
            )}
          </div>
          <div>
            <p className="text-xs text-white/50 mb-1">Reward</p>
            <select value={giveMode} onChange={e => setGiveMode(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-md px-2 py-1.5 text-sm text-white">
              <option value="tokens">Tokens</option>
              <option value="blook">Blook</option>
            </select>
          </div>
        </div>
        {giveMode === 'tokens' ? (
          <div className="mt-2">
            <p className="text-xs text-white/50 mb-1">Amount</p>
            <Input type="number" value={giveAmount} onChange={e => setGiveAmount(e.target.value)} placeholder="Token amount" className="bg-white/10 border-white/20 text-white" />
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-xs text-white/50 mb-1">Blook</p>
            <select value={selectedBlook} onChange={e => setSelectedBlook(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-md px-2 py-1.5 text-sm text-white">
              <option value="">Select blook...</option>
              {filteredBlooks.map(b => <option key={b.id} value={b.id}>{b.name} ({b.rarity})</option>)}
            </select>
            <p className="text-[10px] text-white/40 mt-1">Restricted blooks (Hivelands, PAC3, Summer, Golden, Spooky) are hidden.</p>
          </div>
        )}
        <Button onClick={giveToUser} disabled={giving || !canGive} className="mt-3" style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
          {giving ? 'Giving...' : 'Give & Announce'}
        </Button>
      </div>
    </div>
  );
}