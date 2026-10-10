import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ArrowLeft, Trophy, Users, Send } from 'lucide-react';
import { getActiveBlooks } from '@/lib/gameDataCache';
import { pullEveryblook, awardBlookToUser } from '@/lib/everyblookCrate';

const ROUND_SECONDS = 30;
const WIN_SCORE = 10;

export default function GTBLive() {
  const { lobbyId } = useParams();
  const navigate = useNavigate();
  const { profile, updateProfile } = useGame();
  const [lobby, setLobby] = useState(null);
  const [messages, setMessages] = useState([]);
  const [guess, setGuess] = useState('');
  const [loading, setLoading] = useState(true);
  const [reveal, setReveal] = useState(null);
  const [blooks, setBlooks] = useState([]);
  const [now, setNow] = useState(Date.now());

  const renderedMessages = useMemo(() => {
    const visible = messages.slice(-100);
    return visible.map(m => (
      m.is_system ? (
        <div key={m.id} className="text-center text-xs text-[#a7fcc9] py-1">{m.content}</div>
      ) : (
        <div key={m.id} className={`flex items-start gap-2 ${m.is_correct ? 'bg-green-500/20 rounded-lg p-1.5' : ''}`}>
          <div className="w-6 h-6 avatar-rounded-square bg-white/10 overflow-hidden flex items-center justify-center flex-shrink-0">
            {m.avatar_url ? <img src={m.avatar_url} className="w-full h-full object-cover" alt="" /> : <span className="text-[10px] text-white">{m.username?.[0]?.toUpperCase()}</span>}
          </div>
          <div className="min-w-0">
            <span className="text-xs text-white/70">{m.username}</span>
            <p className={`text-sm ${m.is_correct ? 'text-green-400 font-display' : 'text-white'}`}>{m.content}</p>
          </div>
        </div>
      )
    ));
  }, [messages]);

  const lobbyRef = useRef(null);
  const profileRef = useRef(null);
  const blooksRef = useRef([]);
  const endedHandledRef = useRef(null);
  const leftRef = useRef(false);
  const roundTimerRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => { lobbyRef.current = lobby; }, [lobby]);
  useEffect(() => { profileRef.current = profile; }, [profile]);
  useEffect(() => { blooksRef.current = blooks; }, [blooks]);
  useEffect(() => {
    if (lobby?.status !== 'playing' || !lobby?.round_active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lobby?.status, lobby?.round_active]);

  // load blook pool for host picks
  useEffect(() => {
    getActiveBlooks('icecreamet')
      .then(bs => setBlooks(bs.filter(b => !b.is_deleted && b.is_active !== false && b.image_url)))
      .catch(() => {});
  }, []);

  const pickBlook = () => {
    const pool = blooksRef.current;
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const startRoundTimer = () => {
    if (roundTimerRef.current) clearTimeout(roundTimerRef.current);
    roundTimerRef.current = setTimeout(() => {
      const l = lobbyRef.current;
      if (!l || l.status !== 'playing' || !l.round_active) return;
      base44.entities.GTBLobby.update(l.id, { round_active: false }).catch(() => {});
      base44.entities.GTBMessage.create({ lobby_id: l.id, username: 'GTB Bot', is_system: true, content: `⏰ Time's up! The blook was "${l.current_blook_name}".` }).catch(() => {});
      setTimeout(() => nextRound(), 3500);
    }, ROUND_SECONDS * 1000);
  };

  const nextRound = async () => {
    const l = lobbyRef.current;
    if (!l || l.status !== 'playing') return;
    const b = pickBlook();
    if (!b) return;
    await base44.entities.GTBLobby.update(l.id, {
      round: (l.round || 1) + 1,
      round_active: true,
      round_started_at: new Date().toISOString(),
      current_blook_id: b.id,
      current_blook_name: b.name,
      current_blook_image: b.image_url
    });
    await base44.entities.GTBMessage.create({ lobby_id: l.id, username: 'GTB Bot', is_system: true, content: `Round ${(l.round || 1) + 1} — guess the blook!` });
    startRoundTimer();
  };

  const startGame = async () => {
    const l = lobbyRef.current;
    if (!l || l.host_id !== profileRef.current?.user_id) return;
    const b = pickBlook();
    if (!b) { alert('No blooks available.'); return; }
    const resetPlayers = JSON.parse(l.players || '[]').map(p => ({ ...p, score: 0 }));
    await base44.entities.GTBLobby.update(l.id, {
      status: 'playing',
      round: 1,
      round_active: true,
      round_started_at: new Date().toISOString(),
      current_blook_id: b.id,
      current_blook_name: b.name,
      current_blook_image: b.image_url,
      winner_id: '',
      winner_username: '',
      players: JSON.stringify(resetPlayers)
    });
    await base44.entities.GTBMessage.create({ lobby_id: l.id, username: 'GTB Bot', is_system: true, content: '🎮 Game started! First to 10 points wins. Guess the blook!' });
    startRoundTimer();
  };

  const processGuess = async (msg) => {
    const l = lobbyRef.current;
    const prof = profileRef.current;
    if (!l || !prof) return;
    if (msg.is_system) return;
    if (l.host_id !== prof.user_id) return; // only the host adjudicates
    if (l.status !== 'playing' || !l.round_active) return;
    const guessText = (msg.content || '').trim().toLowerCase();
    const answer = (l.current_blook_name || '').trim().toLowerCase();
    if (!answer || guessText !== answer) return;

    const ps = JSON.parse(l.players || '[]');
    const idx = ps.findIndex(p => p.user_id === msg.user_id);
    if (idx === -1) return;
    ps[idx].score = (ps[idx].score || 0) + 1;
    const newScore = ps[idx].score;

    if (roundTimerRef.current) clearTimeout(roundTimerRef.current);
    await base44.entities.GTBLobby.update(l.id, { round_active: false, players: JSON.stringify(ps) });
    await base44.entities.GTBMessage.update(msg.id, { is_correct: true });
    await base44.entities.GTBMessage.create({ lobby_id: l.id, username: 'GTB Bot', is_system: true, content: `✅ ${msg.username} guessed "${l.current_blook_name}"! +1 point` });

    if (newScore >= WIN_SCORE) {
      await base44.entities.GTBLobby.update(l.id, { status: 'ended', winner_id: msg.user_id, winner_username: msg.username });
      await base44.entities.GTBMessage.create({ lobby_id: l.id, username: 'GTB Bot', is_system: true, content: `🏆 ${msg.username} wins the game!` });
    } else {
      setTimeout(() => nextRound(), 3500);
    }
  };

  // load + subscribe
  useEffect(() => {
    if (!lobbyId) return;
    setLoading(true);
    base44.entities.GTBLobby.get(lobbyId).then(l => { setLobby(l); setLoading(false); }).catch(() => setLoading(false));
    const unsubLobby = base44.entities.GTBLobby.subscribe((e) => {
      if (e.data?.id === lobbyId) setLobby(e.data);
    });
    base44.entities.GTBMessage.filter({ lobby_id: lobbyId }).then(msgs => {
      setMessages(msgs.sort((a, b) => new Date(a.created_date) - new Date(b.created_date)));
    }).catch(() => {});
    const unsubMsg = base44.entities.GTBMessage.subscribe((e) => {
      if (e.data?.lobby_id !== lobbyId) return;
      setMessages(prev => {
        if (e.type === 'create') return prev.find(m => m.id === e.data.id) ? prev : [...prev, e.data];
        if (e.type === 'update') return prev.map(m => m.id === e.data.id ? e.data : m);
        if (e.type === 'delete') return prev.filter(m => m.id !== e.data.id);
        return prev;
      });
      if (e.type === 'create') processGuess(e.data);
    });
    return () => {
      unsubLobby && unsubLobby();
      unsubMsg && unsubMsg();
      if (roundTimerRef.current) clearTimeout(roundTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyId]);

  // ensure I'm in the lobby
  useEffect(() => {
    if (!lobby || !profile) return;
    if (lobby.status !== 'waiting') return;
    let ps;
    try { ps = JSON.parse(lobby.players || '[]'); } catch { ps = []; }
    if (ps.find(p => p.user_id === profile.user_id)) return;
    if (ps.length >= 10) return;
    ps.push({ user_id: profile.user_id, username: profile.username, avatar_url: profile.avatar_url, score: 0 });
    base44.entities.GTBLobby.update(lobby.id, { players: JSON.stringify(ps) }).catch(() => {});
    base44.entities.GTBMessage.create({ lobby_id: lobby.id, username: 'GTB Bot', is_system: true, content: `👋 ${profile.username} joined the lobby!` }).catch(() => {});
    // Invite the global chat to play
    base44.entities.ChatMessage.create({
      user_id: profile.user_id,
      username: 'GTB Bot',
      is_system: true,
      content: `🎮 ${profile.username} is playing GTB LIVE! Go to Minigames → GTB Live to join the game!`,
      channel: 'global'
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobby?.id, profile?.user_id]);

  // auto-scroll chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // handle game end: award crate / update streak
  useEffect(() => {
    if (!lobby || !profile) return;
    if (lobby.status !== 'ended') return;
    if (endedHandledRef.current === lobby.id) return;
    let ps;
    try { ps = JSON.parse(lobby.players || '[]'); } catch { ps = []; }
    if (!ps.find(p => p.user_id === profile.user_id)) return;
    endedHandledRef.current = lobby.id;
    const handleEnd = async () => {
      if (lobby.winner_id === profile.user_id) {
        const newStreak = (profile.gtb_streak || 0) + 1;
        const version = newStreak >= 5 ? 2 : 1;
        await updateProfile({ gtb_streak: newStreak });
        const pulled = await pullEveryblook(version);
        if (pulled) {
          await awardBlookToUser(profile.user_id, pulled);
          setReveal({ blook: pulled, version, streak: newStreak });
        }
      } else {
        if ((profile.gtb_streak || 0) > 0) {
          await updateProfile({ gtb_streak: 0 });
        }
      }
    };
    handleEnd().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobby?.status, profile?.user_id]);

  // leave on unmount
  useEffect(() => {
    return () => {
      if (leftRef.current) return;
      const l = lobbyRef.current;
      const prof = profileRef.current;
      if (!l || !prof) return;
      let ps;
      try { ps = JSON.parse(l.players || '[]'); } catch { ps = []; }
      const remaining = ps.filter(p => p.user_id !== prof.user_id);
      if (remaining.length === 0) {
        base44.entities.GTBLobby.update(l.id, { status: 'ended', players: '[]', round_active: false }).catch(() => {});
      } else {
        const newHost = l.host_id === prof.user_id ? remaining[0].user_id : l.host_id;
        base44.entities.GTBLobby.update(l.id, { players: JSON.stringify(remaining), host_id: newHost }).catch(() => {});
      }
    };
  }, []);

  const leaveLobby = async () => {
    leftRef.current = true;
    const l = lobbyRef.current;
    const prof = profileRef.current;
    if (l && prof) {
      let ps;
      try { ps = JSON.parse(l.players || '[]'); } catch { ps = []; }
      const remaining = ps.filter(p => p.user_id !== prof.user_id);
      if (remaining.length === 0) {
        await base44.entities.GTBLobby.update(l.id, { status: 'ended', players: '[]', round_active: false }).catch(() => {});
      } else {
        const newHost = l.host_id === prof.user_id ? remaining[0].user_id : l.host_id;
        await base44.entities.GTBLobby.update(l.id, { players: JSON.stringify(remaining), host_id: newHost }).catch(() => {});
      }
    }
    navigate('/minigames');
  };

  const sendGuess = async () => {
    if (!guess.trim() || !lobby || lobby.status !== 'playing' || !lobby.round_active) return;
    await base44.entities.GTBMessage.create({ lobby_id: lobby.id, user_id: profile.user_id, username: profile.username, avatar_url: profile.avatar_url, content: guess.trim() });
    setGuess('');
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-panel/30 border-t-panel rounded-full animate-spin" /></div>;
  if (!lobby) return <div className="text-center py-12 text-white/60">Lobby not found. <Link to="/minigames" className="text-[#a7fcc9] underline">Back to Minigames</Link></div>;

  let players = [];
  try { players = JSON.parse(lobby.players || '[]'); } catch { players = []; }
  const isHost = lobby.host_id === profile?.user_id;
  const myScore = players.find(p => p.user_id === profile?.user_id)?.score || 0;
  const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

  const roundStart = lobby.round_started_at ? new Date(lobby.round_started_at).getTime() : 0;
  const remaining = lobby.round_active ? Math.max(0, ROUND_SECONDS - Math.floor((now - roundStart) / 1000)) : 0;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Link to="/minigames" onClick={(e) => { e.preventDefault(); leaveLobby(); }} className="text-white/70 hover:text-white"><ArrowLeft size={20} /></Link>
          <h2 className="text-2xl font-display text-[#a7fcc9] flex items-center gap-2"><Trophy size={20} /> GTB LIVE</h2>
          {profile?.gtb_streak > 0 && <span className="text-xs text-amber-400 font-display">🔥 Streak: {profile.gtb_streak}</span>}
        </div>
        <Button size="sm" variant="outline" onClick={leaveLobby} className="border-white/20 text-white">Leave</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Game panel */}
        <div className="bg-panel rounded-2xl border border-white/10 p-4">
          {/* Scoreboard */}
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-[#a7fcc9]" />
            <h3 className="font-display text-[#a7fcc9]">Scoreboard</h3>
            <span className="text-xs text-white/50 ml-auto">First to {WIN_SCORE}</span>
          </div>
          <div className="space-y-1 mb-4">
            {sortedPlayers.map((p, i) => (
              <div key={p.user_id} className={`flex items-center gap-2 rounded-lg p-2 ${p.user_id === profile?.user_id ? 'bg-[#a7fcc9]/20' : 'bg-white/5'}`}>
                <span className="text-xs text-white/50 w-4">{i + 1}</span>
                <div className="w-7 h-7 avatar-rounded-square bg-white/10 overflow-hidden flex items-center justify-center">
                  {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" alt="" /> : <span className="text-xs text-white">{p.username?.[0]?.toUpperCase()}</span>}
                </div>
                <span className="text-sm text-white flex-1 truncate">{p.username}{p.user_id === lobby.host_id && ' 👑'}</span>
                <span className="font-display text-[#a7fcc9]">{p.score || 0}</span>
              </div>
            ))}
            {players.length === 0 && <p className="text-white/60 text-xs">No players yet.</p>}
          </div>

          {/* Blook / status */}
          <div className="rounded-xl bg-black/20 border border-white/10 p-4 text-center min-h-[180px] flex flex-col items-center justify-center">
            {lobby.status === 'waiting' && (
              <>
                <p className="font-display text-white mb-1">Waiting for players…</p>
                <p className="text-sm text-white/60 mb-3">{players.length}/10 joined · need 5 to start</p>
                {isHost ? (
                  <Button onClick={startGame} disabled={players.length < 5} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
                    {players.length < 5 ? `Need ${5 - players.length} more` : 'Start Game'}
                  </Button>
                ) : (
                  <p className="text-xs text-white/50">The host will start the game when 5+ players have joined.</p>
                )}
              </>
            )}
            {lobby.status === 'playing' && lobby.current_blook_image && (
              <>
                <div className="w-28 h-28 mx-auto flex items-center justify-center mb-2">
                  <img src={lobby.current_blook_image} alt="?" className="w-full h-full object-contain" style={lobby.round_active ? { filter: 'brightness(0) drop-shadow(0 0 1px rgba(255,255,255,0.4))' } : {}} />
                </div>
                {lobby.round_active ? (
                  <>
                    <p className="text-sm text-white/80">Guess this blook! Type the name in chat.</p>
                    <p className="text-xs text-amber-400 font-display mt-1">⏱ {remaining}s</p>
                  </>
                ) : (
                  <p className="text-sm text-[#a7fcc9] font-display">It was: {lobby.current_blook_name}</p>
                )}
              </>
            )}
            {lobby.status === 'ended' && (
              <>
                <p className="text-3xl mb-1">🏆</p>
                <p className="font-display text-[#a7fcc9] text-lg">{lobby.winner_username} wins!</p>
                {lobby.winner_id === profile?.user_id && <p className="text-xs text-amber-400 mt-1">Check your crate reward →</p>}
                <Button size="sm" variant="outline" onClick={leaveLobby} className="mt-3 border-white/20 text-white">Back to Minigames</Button>
              </>
            )}
          </div>
        </div>

        {/* Chat panel */}
        <div className="bg-panel rounded-2xl border border-white/10 p-4 flex flex-col" style={{ minHeight: 360, maxHeight: '70vh' }}>
          <h3 className="font-display text-[#a7fcc9] mb-2">Guess Chat</h3>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1" style={{ maxHeight: '50vh' }}>
            {renderedMessages}
            {messages.length === 0 && <p className="text-white/40 text-xs text-center py-4">No messages yet.</p>}
            <div ref={chatEndRef} />
          </div>
          <div className="flex gap-2 mt-2">
            <Input
              value={guess}
              onChange={e => setGuess(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendGuess(); }}
              placeholder={lobby.status === 'playing' && lobby.round_active ? 'Type your guess…' : 'Waiting for round…'}
              disabled={lobby.status !== 'playing' || !lobby.round_active}
              className="bg-white/10 border-white/20 text-white"
            />
            <Button size="icon" onClick={sendGuess} disabled={lobby.status !== 'playing' || !lobby.round_active || !guess.trim()} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
              <Send size={16} />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={!!reveal} onOpenChange={(open) => { if (!open) setReveal(null); }}>
        <DialogContent className="max-w-sm text-center">
          <p className="font-display text-[#a7fcc9] mb-1">🎉 You won GTB LIVE!</p>
          <p className="text-xs text-white/60 mb-2">EVERYBLOOK V{reveal?.version} crate · 🔥 Streak {reveal?.streak}</p>
          {reveal?.blook && (
            <>
              <div className="w-32 h-32 mx-auto flex items-center justify-center mb-3">
                {reveal.blook.image_url ? <img src={reveal.blook.image_url} alt={reveal.blook.name} className="w-full h-full object-contain animate-blook-rise" /> : <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/0d5e6b887_image.png" alt="" className="w-16 h-16 object-contain" />}
              </div>
              <p className={`font-display text-xl mb-1 rarity-${reveal.blook.rarity}`}>{reveal.blook.name}</p>
              <p className={`text-xs capitalize mb-4 rarity-${reveal.blook.rarity}`}>{reveal.blook.rarity}</p>
            </>
          )}
          <Button onClick={() => setReveal(null)} className="w-full" style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Keep</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}