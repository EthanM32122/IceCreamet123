import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { Button } from '@/components/ui/button';

const FLAPPY_REWARD_IMAGE = 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/519c29a6d_Screenshot_20260823-213520_2-removebg-preview.png';

const RARITY_REWARD = {
  uncommon: 5,
  rare: 20,
  epic: 35,
  legendary: 50,
  chroma: 100,
  supreme: 150,
  mythical: 250,
  icecreamacle: 400,
  unique: 560,
  iridescent: 1000
};

const RARITY_COLORS = {
  uncommon: '#4ade80', rare: '#60a5fa', epic: '#a855f7', legendary: '#f59e0b',
  chroma: '#00ccff', supreme: '#ef4444', mythical: '#f472b6', icecreamacle: '#34d399',
  unique: '#00ff99', iridescent: '#ff6b6b'
};

const W = 400, H = 600;

export default function FlappyBird({ onGameOver }) {
  const { profile, updateProfile, addTokens } = useGame();
  const [owned, setOwned] = useState([]);
  const [selected, setSelected] = useState(null);
  const [phase, setPhase] = useState('select'); // select | playing | over
  const [score, setScore] = useState(0);
  const [earned, setEarned] = useState(0);
  const [rewarded, setRewarded] = useState(false);
  const [loadingInv, setLoadingInv] = useState(true);

  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const birdImgRef = useRef(null);
  const selectedRef = useRef(null);
  const profileRef = useRef(profile);
  const updateProfileRef = useRef(updateProfile);
  const addTokensRef = useRef(addTokens);
  addTokensRef.current = addTokens;
  selectedRef.current = selected;
  profileRef.current = profile;
  updateProfileRef.current = updateProfile;

  useEffect(() => {
    (async () => {
      if (!profile) return;
      const pbs = await base44.entities.PlayerBlook.filter({ user_id: profile.user_id, game: 'icecreamet' });
      const allBlooks = await base44.entities.Blook.filter({ is_deleted: false, game: 'icecreamet' });
      const map = {};
      allBlooks.forEach(b => { map[b.id] = b; });
      const combined = pbs.map(pb => ({ pb, blook: map[pb.blook_id] })).filter(x => x.blook && x.blook.image_url);
      setOwned(combined);
      setLoadingInv(false);
    })();
  }, [profile]);

  const preloadBird = (url) => {
    const img = new Image();
    img.src = url;
    img.onload = () => { birdImgRef.current = img; };
  };

  useEffect(() => { if (selected?.blook?.image_url) preloadBird(selected.blook.image_url); }, [selected]);

  const startGame = () => {
    if (!selected) return;
    preloadBird(selected.blook.image_url);
    setScore(0);
    setEarned(0);
    setRewarded(false);
    setPhase('playing');
  };

  const flap = useCallback(() => {
    const s = stateRef.current;
    if (!s || s.over) return;
    s.bird.vy = s.flapV;
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); flap(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flap]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    stateRef.current = {
      bird: { x: 90, y: H / 2, vy: 0, size: 46 },
      pipes: [], score: 0, frame: 0, over: false,
      W, H, pipeGap: 185, pipeWidth: 64, pipeSpacing: 260,
      speed: 2.8, gravity: 0.38, flapV: -6.8, groundY: H - 56
    };

    let raf;
    const draw = (s) => {
      const grad = ctx.createLinearGradient(0, 0, 0, s.H);
      grad.addColorStop(0, '#ff96c5');
      grad.addColorStop(1, '#ffb347');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, s.W, s.H);

      ctx.fillStyle = '#5cb85c';
      s.pipes.forEach(p => {
        ctx.fillRect(p.x, 0, s.pipeWidth, p.gapY);
        ctx.fillRect(p.x, p.gapY + s.pipeGap, s.pipeWidth, s.groundY - (p.gapY + s.pipeGap));
        ctx.fillStyle = '#3d8b3d';
        ctx.fillRect(p.x - 3, p.gapY - 18, s.pipeWidth + 6, 18);
        ctx.fillRect(p.x - 3, p.gapY + s.pipeGap, s.pipeWidth + 6, 18);
        ctx.fillStyle = '#5cb85c';
      });

      ctx.fillStyle = '#ded895';
      ctx.fillRect(0, s.groundY, s.W, s.H - s.groundY);
      ctx.fillStyle = '#c9b97a';
      ctx.fillRect(0, s.groundY, s.W, 6);

      if (birdImgRef.current) {
        const tilt = Math.max(-0.4, Math.min(0.9, s.bird.vy / 12));
        ctx.save();
        ctx.translate(s.bird.x + s.bird.size / 2, s.bird.y + s.bird.size / 2);
        ctx.rotate(tilt);
        ctx.drawImage(birdImgRef.current, -s.bird.size / 2, -s.bird.size / 2, s.bird.size, s.bird.size);
        ctx.restore();
      } else {
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(s.bird.x, s.bird.y, s.bird.size, s.bird.size);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#00000088';
      ctx.lineWidth = 4;
      ctx.strokeText(s.score, s.W / 2, 54);
      ctx.fillText(s.score, s.W / 2, 54);
    };

    const finish = async (finalScore) => {
      cancelAnimationFrame(raf);
      setPhase('over');
      const blook = selectedRef.current?.blook;
      const rate = RARITY_REWARD[blook?.rarity] || 5;
      const tokens = finalScore * rate;
      setEarned(tokens);
      const cur = profileRef.current;
      if (tokens > 0 && cur) {
        await addTokensRef.current(tokens);
      }
      if (finalScore >= 100) {
        const fp = await base44.entities.Blook.filter({ name: 'Flabby Pird' });
        if (fp.length > 0 && cur) {
          const existing = await base44.entities.PlayerBlook.filter({ user_id: cur.user_id, blook_id: fp[0].id });
          if (existing.length === 0) {
            await base44.entities.PlayerBlook.create({ user_id: cur.user_id, blook_id: fp[0].id, quantity: 1 });
            setRewarded(true);
          }
        }
      }
      if (cur) {
        await base44.entities.FlappyScore.create({ user_id: cur.user_id, username: cur.username, score: finalScore });
      }
      if (onGameOver) onGameOver(finalScore);
    };

    const step = () => {
      const s = stateRef.current;
      if (!s) return;
      s.bird.vy += s.gravity;
      s.bird.y += s.bird.vy;
      s.frame++;

      if (s.pipes.length === 0 || s.pipes[s.pipes.length - 1].x < s.W - s.pipeSpacing) {
        const gapY = 70 + Math.random() * (s.H - s.pipeGap - 170);
        s.pipes.push({ x: s.W, gapY, passed: false });
      }
      s.pipes.forEach(p => { p.x -= s.speed; });
      s.pipes = s.pipes.filter(p => p.x > -s.pipeWidth);

      s.pipes.forEach(p => {
        if (!p.passed && p.x + s.pipeWidth < s.bird.x) {
          p.passed = true;
          s.score++;
          setScore(s.score);
        }
      });

      const b = s.bird;
      if (b.y + b.size > s.groundY || b.y < 0) s.over = true;
      for (const p of s.pipes) {
        if (b.x + b.size > p.x && b.x < p.x + s.pipeWidth) {
          if (b.y < p.gapY || b.y + b.size > p.gapY + s.pipeGap) s.over = true;
        }
      }

      draw(s);
      if (s.over) { finish(s.score); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => cancelAnimationFrame(raf);
  }, [phase]);

  if (!profile) return null;

  return (
    <div className="bg-panel rounded-2xl border border-white/10 p-4 sm:p-6 text-center">
      <p className="text-sm text-white/60 mb-3">Free to play · earn tokens per pipe passed · reach 100 points to unlock the <span className="text-[#00ff99] font-display">Flabby Pird</span> blook!</p>

      {phase === 'select' && (
        <div>
          <p className="text-white/80 text-sm mb-2">Pick a blook you own to be your bird:</p>
          {loadingInv ? (
            <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-[#a7fcc9]/30 border-t-[#a7fcc9] rounded-full animate-spin" /></div>
          ) : owned.length === 0 ? (
            <p className="text-white/60 text-sm py-4">You don't own any blooks yet. Open a pack first!</p>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-64 overflow-y-auto p-1 mb-4">
                {owned.map(({ pb, blook }) => {
                  const isSel = selected?.pb?.id === pb.id;
                  const color = RARITY_COLORS[blook.rarity] || '#a7fcc9';
                  return (
                    <button key={pb.id} onClick={() => setSelected({ pb, blook })}
                      className={`rounded-lg p-1.5 border-2 transition ${isSel ? 'border-[#a7fcc9] bg-white/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                      <img src={blook.image_url} alt={blook.name} className="w-12 h-12 object-contain mx-auto" />
                      <p className="text-[10px] mt-1 truncate" style={{ color }}>{blook.name}</p>
                      <p className="text-[9px] text-white/50">+{RARITY_REWARD[blook.rarity] || 5}/pt</p>
                    </button>
                  );
                })}
              </div>
              <Button onClick={startGame} disabled={!selected} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }} className="font-display">
                {selected ? `Play as ${selected.blook.name}` : 'Select a blook'}
              </Button>
            </>
          )}
        </div>
      )}

      {phase === 'playing' && (
        <div className="relative mx-auto" style={{ maxWidth: 400 }}>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            onPointerDown={(e) => { e.preventDefault(); flap(); }}
            className="w-full rounded-xl border border-white/10 cursor-pointer touch-none"
            style={{ aspectRatio: `${W} / ${H}` }}
          />
          <p className="text-xs text-white/60 mt-2">Tap / click / Space to flap</p>
        </div>
      )}

      {phase === 'over' && (
        <div className="py-4">
          <p className="text-5xl font-display text-white mb-2">{score}</p>
          <p className="text-white/70 text-sm mb-1">points with <span style={{ color: RARITY_COLORS[selected?.blook?.rarity] || '#a7fcc9' }}>{selected?.blook?.name}</span></p>
          <p className="text-[#a7fcc9] font-display text-lg mb-3">+🪙 {earned.toLocaleString()} tokens</p>
          {rewarded && (
            <div className="bg-gradient-to-r from-pink-500/30 to-yellow-400/30 border border-yellow-400/40 rounded-xl p-3 mb-3">
              <img src={FLAPPY_REWARD_IMAGE} alt="Flabby Pird" className="w-16 h-16 object-contain mx-auto" />
              <p className="text-[#00ff99] font-display mt-1">🎉 You unlocked the Flabby Pird blook!</p>
            </div>
          )}
          {score >= 100 && !rewarded && (
            <p className="text-yellow-400 text-xs mb-3">You already own the Flabby Pird blook!</p>
          )}
          <div className="flex gap-2 justify-center">
            <Button onClick={() => setPhase('select')} variant="outline" className="border-white/20 text-white">Change Blook</Button>
            <Button onClick={startGame} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }} className="font-display">Play Again</Button>
          </div>
        </div>
      )}
    </div>
  );
}