import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Link, useNavigate } from 'react-router-dom';
import GameDetailPanel from '@/components/minigames/GameDetailPanel';
import SlotsGame from '@/components/minigames/SlotsGame';
import BasicGtb from '@/components/minigames/BasicGtb';

const FLAPPY_IMG = 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/519c29a6d_Screenshot_20260823-213520_2-removebg-preview.png';
const CUBE_IMG = 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/b2af7d599_file_00000000a6a481f58b6172b4a05c5bca-removebg-preview.png';
const BEE_IMG = 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/f579b362e_image.png';

const GAMES = [
  { id: 'slots', icon: '🎰', name: 'Slots', desc: 'Spin the reels for tokens and bonus blooks!', difficulty: 'Easy', skills: 'Luck', time: '2 min', questions: 'None', type: 'slots', isBeta: false },
  { id: 'gtb', icon: '🏆', name: 'GTB Live', desc: 'Guess the Blook in real time. 5-10 players per lobby. First to 10 points wins a crate!', difficulty: 'Medium', skills: 'Knowledge & Speed', time: '10 min', questions: 'All Blooks', type: 'gtb', isBeta: false },
  { id: 'basicgtb', icon: '🤖', name: 'Basic GTB', desc: 'Race the bot to guess the blook! First to 10 points wins tokens.', difficulty: 'Easy', skills: 'Knowledge & Speed', time: '5 min', questions: 'All Blooks', type: 'basicgtb', isBeta: false },
];

export default function Minigames() {
  const { profile, updateProfile } = useGame();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [activeGame, setActiveGame] = useState(null);
  const [gameKey, setGameKey] = useState(0);
  const [result, setResult] = useState(null);
  const [joining, setJoining] = useState(false);
  const navigate = useNavigate();

  // Cooldown logic (slots only)
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const MG_WINDOW = 3600000;
  const MG_COOLDOWN = 6 * 3600000;
  const mgWs = profile?.minigame_window_start ? new Date(profile.minigame_window_start).getTime() : 0;
  const mgCd = profile?.minigame_cooldown_until ? new Date(profile.minigame_cooldown_until).getTime() : 0;
  const inCooldown = mgCd && now < mgCd;
  const windowExpired = !mgCd && mgWs && now - mgWs >= MG_WINDOW;
  const slotsLocked = inCooldown || windowExpired;

  useEffect(() => {
    if (!profile) return;
    if (mgCd && now >= mgCd) {
      updateProfile({ minigame_window_start: null, minigame_cooldown_until: null });
    } else if (!mgCd && mgWs && now - mgWs >= MG_WINDOW) {
      updateProfile({ minigame_cooldown_until: new Date(now + MG_COOLDOWN).toISOString() });
    }
  }, [now]);

  const formatMs = (ms) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const joinGTB = async () => {
    if (!profile) return;
    setJoining(true);
    try {
      const lobbies = await base44.entities.GTBLobby.filter({ status: 'waiting' });
      let lobby = lobbies.find((l) => {
        try {
          return JSON.parse(l.players || '[]').length < 10;
        } catch {
          return false;
        }
      });
      if (!lobby) {
        lobby = await base44.entities.GTBLobby.create({
          host_id: profile.user_id,
          status: 'waiting',
          players: JSON.stringify([{ user_id: profile.user_id, username: profile.username, avatar_url: profile.avatar_url, score: 0 }]),
        });
      } else {
        const players = JSON.parse(lobby.players || '[]');
        if (!players.find((p) => p.user_id === profile.user_id)) {
          players.push({ user_id: profile.user_id, username: profile.username, avatar_url: profile.avatar_url, score: 0 });
          await base44.entities.GTBLobby.update(lobby.id, { players: JSON.stringify(players) });
        }
      }
      navigate(`/gtb/${lobby.id}`);
    } catch (e) {
      alert('Failed to join: ' + e.message);
    }
    setJoining(false);
  };

  const handlePlay = () => {
    const game = GAMES[selectedIdx];
    if (game.type === 'gtb') {
      joinGTB();
    } else {
      setActiveGame(game);
      setResult(null);
      setGameKey((k) => k + 1);
    }
  };

  const handleGameOver = async (tokens, reason) => {
    if (tokens > 0 && profile) {
      await updateProfile({ tokens: (profile.tokens || 0) + tokens });
    }
    setResult({ tokens: Math.max(0, tokens), reason });
  };

  const closeGame = () => {
    setActiveGame(null);
    setResult(null);
  };
  const replay = () => {
    setResult(null);
    setGameKey((k) => k + 1);
  };

  if (!profile) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-panel/30 border-t-panel rounded-full animate-spin" />
      </div>
    );
  }

  const selected = GAMES[selectedIdx];
  const isSlotsLocked = selected.type === 'slots' && slotsLocked;
  const lockReason = inCooldown
    ? `Wait ${formatMs(mgCd - now)} to play again.`
    : `Play window expired. Wait ${formatMs(MG_COOLDOWN)}.`;
  const isBusy = joining && selected.type === 'gtb';

  return (
    <div className="max-w-5xl mx-auto">
      {/* Games */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left pane — game selection */}
        <div className="flex-1 bg-panel rounded-2xl border border-white/10 p-4">
          <div className="bg-white/10 rounded-xl py-3 px-4 mb-4 text-center">
            <h2 className="text-xl font-display text-white">Select a Game Mode</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {GAMES.map((g, i) => (
              <button
                key={g.id}
                onClick={() => setSelectedIdx(i)}
                className={`relative bg-white/5 rounded-xl border p-4 flex flex-col items-center gap-2 transition-all hover:bg-white/10 ${
                  i === selectedIdx ? 'border-[#a7fcc9] ring-2 ring-[#a7fcc9]/30' : 'border-white/10'
                }`}
              >
                {g.isBeta && (
                  <span className="absolute top-1.5 left-1.5 text-[8px] px-1.5 py-0.5 rounded-full bg-[#1cb7bf] text-white font-display">
                    Beta
                  </span>
                )}
                {g.iconType === 'img'
                  ? <img src={g.icon} alt={g.name} className="w-12 h-12 object-contain" />
                  : <span className="text-4xl">{g.icon}</span>}
                <span className="text-xs font-display text-white text-center leading-tight">{g.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right pane — detail panel */}
        <div className="w-full lg:w-[340px] flex-shrink-0">
          <GameDetailPanel
            game={selected}
            onPlay={handlePlay}
            locked={isSlotsLocked}
            lockReason={lockReason}
            busy={isBusy}
          />
        </div>
      </div>

      {/* Game dialog */}
      <Dialog open={!!activeGame} onOpenChange={(v) => !v && closeGame()}>
        <DialogContent className="bg-panel border-[#a7fcc9]/40 max-w-3xl max-h-[90vh] overflow-y-auto p-4">
          {activeGame && !result && activeGame.type === 'slots' && (
            <SlotsGame key={gameKey} locked={slotsLocked} lockReason={lockReason} />
          )}
          {activeGame && !result && activeGame.type === 'basicgtb' && (
            <BasicGtb key={gameKey} onGameOver={handleGameOver} onClose={closeGame} />
          )}
          {result && (
            <div className="text-center py-12">
              <h3 className="font-display text-2xl text-[#a7fcc9] mb-2">Game Over!</h3>
              <p className="text-white/70 mb-4">{result.reason}</p>
              <div className="bg-[#a7fcc9]/10 border border-[#a7fcc9]/30 rounded-xl p-4 mb-6 inline-block">
                <p className="text-xs text-white/50">Tokens Earned</p>
                <p className="font-display text-3xl text-[#a7fcc9]">🪙 {result.tokens.toLocaleString()}</p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button onClick={replay} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
                  Play Again
                </Button>
                <Button variant="outline" onClick={closeGame} className="border-white/20 text-white">
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick-play cards — each ~1/8 of screen, with icon, name & description */}
      <div className="fixed right-3 bottom-3 z-40 flex flex-col gap-3">
        <Link to="/hivelands" className="active:scale-95 transition" title="Play Soups of Hivelands">
          <div className="rainbow-border p-[3px] rounded-2xl shadow-xl">
            <div className="bg-panel rounded-2xl p-3 flex flex-col items-center text-center" style={{ width: '12.5vw', minWidth: 150 }}>
              <img src={BEE_IMG} alt="Soups of Hivelands" className="w-16 h-16 object-contain mb-1" />
              <span className="text-sm text-white font-display leading-tight">Soups of Hivelands</span>
              <span className="text-[10px] text-[#a7fcc9] leading-tight mt-0.5">Craft soups & trade in the Hivelands</span>
            </div>
          </div>
        </Link>
        <Link to="/geometrydash" className="active:scale-95 transition" title="Play Geometry Dash">
          <div className="rainbow-border p-[3px] rounded-2xl shadow-xl">
            <div className="bg-panel rounded-2xl p-3 flex flex-col items-center text-center" style={{ width: '12.5vw', minWidth: 150 }}>
              <img src={CUBE_IMG} alt="Cube" className="w-16 h-16 object-contain mb-1" />
              <span className="text-sm text-white font-display leading-tight">Geometry Dash</span>
              <span className="text-[10px] text-[#a7fcc9] leading-tight mt-0.5">Jump & dash through cube obstacles</span>
            </div>
          </div>
        </Link>
        <Link to="/flappybird" className="active:scale-95 transition" title="Play Flappy Bird">
          <div className="rainbow-border p-[3px] rounded-2xl shadow-xl">
            <div className="bg-panel rounded-2xl p-3 flex flex-col items-center text-center" style={{ width: '12.5vw', minWidth: 150 }}>
              <img src={FLAPPY_IMG} alt="Flappy Pird" className="w-16 h-16 object-contain mb-1" />
              <span className="text-sm text-white font-display leading-tight">Flappy Pird</span>
              <span className="text-[10px] text-[#a7fcc9] leading-tight mt-0.5">Flap through the pipes</span>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}