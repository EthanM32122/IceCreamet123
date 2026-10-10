import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { Button } from '@/components/ui/button';

const CUBE_IMG = 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/b2af7d599_file_00000000a6a481f58b6172b4a05c5bca-removebg-preview.png';
const NEXUS_IMG = 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/ec3e4178b_file_00000000584881f5927ad29449abb531.png';

const W = 400, H = 600;
const SURVIVE_GOAL = 300; // 5 minutes in seconds

export default function GeometryDash({ onGameOver }) {
  const { profile, updateProfile, addTokens } = useGame();
  const [phase, setPhase] = useState('ready');
  const [seconds, setSeconds] = useState(0);
  const [earned, setEarned] = useState(0);
  const [rewardedCube, setRewardedCube] = useState(false);
  const [rewardedNexus, setRewardedNexus] = useState(false);
  const [alreadyOwnsNexus, setAlreadyOwnsNexus] = useState(false);

  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const cubeImgRef = useRef(null);
  const profileRef = useRef(profile);
  const updateProfileRef = useRef(updateProfile);
  const addTokensRef = useRef(addTokens);
  addTokensRef.current = addTokens;
  profileRef.current = profile;
  updateProfileRef.current = updateProfile;

  useEffect(() => {
    const img = new Image();
    img.src = CUBE_IMG;
    img.onload = () => { cubeImgRef.current = img; };
  }, []);

  const grantCube = async () => {
    const cur = profileRef.current;
    if (!cur) return;
    const cb = await base44.entities.Blook.filter({ name: 'Cube' });
    if (cb.length === 0) return;
    const existing = await base44.entities.PlayerBlook.filter({ user_id: cur.user_id, blook_id: cb[0].id });
    if (existing.length === 0) {
      await base44.entities.PlayerBlook.create({ user_id: cur.user_id, blook_id: cb[0].id, quantity: 1 });
      setRewardedCube(true);
    }
  };

  const startGame = async () => {
    setRewardedCube(false);
    setRewardedNexus(false);
    setAlreadyOwnsNexus(false);
    setSeconds(0);
    setEarned(0);
    await grantCube();
    setPhase('playing');
  };

  const jump = useCallback(() => {
    const s = stateRef.current;
    if (!s || s.over) return;
    if (s.cube.y + s.cube.size >= s.groundY - 2) {
      s.cube.vy = s.jumpV;
      s.onGround = false;
    }
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); jump(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [jump]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const groundY = H - 90;
    stateRef.current = {
      cube: { x: 80, y: groundY - 44, vy: 0, size: 44 },
      spikes: [], frame: 0, over: false, onGround: true,
      W, H, groundY, speed: 3.2, gravity: 0.62, jumpV: -13.5,
      startTime: performance.now(), lastInt: 0, seconds: 0
    };

    let raf;
    const draw = (s) => {
      const grad = ctx.createLinearGradient(0, 0, 0, s.H);
      grad.addColorStop(0, '#1b2a4a');
      grad.addColorStop(1, '#0f1530');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, s.W, s.H);

      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, s.groundY, s.W, s.H - s.groundY);
      ctx.fillStyle = '#00b7ff';
      ctx.fillRect(0, s.groundY, s.W, 4);

      ctx.fillStyle = '#ff3b3b';
      s.spikes.forEach(sp => {
        ctx.fillRect(sp.x, s.groundY - sp.h, sp.w, sp.h);
        ctx.beginPath();
        ctx.moveTo(sp.x, s.groundY - sp.h);
        ctx.lineTo(sp.x + sp.w / 2, s.groundY - sp.h - 12);
        ctx.lineTo(sp.x + sp.w, s.groundY - sp.h);
        ctx.closePath();
        ctx.fill();
      });

      if (cubeImgRef.current) {
        ctx.drawImage(cubeImgRef.current, s.cube.x, s.cube.y, s.cube.size, s.cube.size);
      } else {
        ctx.fillStyle = '#fff200';
        ctx.fillRect(s.cube.x, s.cube.y, s.cube.size, s.cube.size);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#00000088';
      ctx.lineWidth = 4;
      const t = Math.floor(s.seconds);
      ctx.strokeText(t + 's', s.W / 2, 50);
      ctx.fillText(t + 's', s.W / 2, 50);
    };

    const finish = async (finalSeconds) => {
      cancelAnimationFrame(raf);
      setPhase('over');
      const tokens = Math.floor(finalSeconds * 10);
      setEarned(tokens);
      const cur = profileRef.current;
      if (tokens > 0 && cur) {
        await addTokensRef.current(tokens);
      }
      if (finalSeconds >= SURVIVE_GOAL) {
        const nb = await base44.entities.Blook.filter({ name: 'Nexus' });
        if (nb.length > 0 && cur) {
          const existing = await base44.entities.PlayerBlook.filter({ user_id: cur.user_id, blook_id: nb[0].id });
          if (existing.length === 0) {
            await base44.entities.PlayerBlook.create({ user_id: cur.user_id, blook_id: nb[0].id, quantity: 1 });
            setRewardedNexus(true);
          } else {
            setAlreadyOwnsNexus(true);
          }
        }
      }
      if (cur) {
        await base44.entities.GeometryScore.create({ user_id: cur.user_id, username: cur.username, score: Math.floor(finalSeconds) });
      }
      if (onGameOver) onGameOver(Math.floor(finalSeconds));
    };

    const step = () => {
      const s = stateRef.current;
      if (!s) return;
      s.frame++;
      const elapsed = (performance.now() - s.startTime) / 1000;
      s.seconds = elapsed;
      const intSec = Math.floor(elapsed);
      if (intSec !== s.lastInt) { s.lastInt = intSec; setSeconds(intSec); }
      s.speed = Math.min(10, 3.6 + elapsed * 0.09);

      s.cube.vy += s.gravity;
      s.cube.y += s.cube.vy;
      if (s.cube.y >= s.groundY - s.cube.size) {
        s.cube.y = s.groundY - s.cube.size;
        s.cube.vy = 0;
        s.onGround = true;
      } else {
        s.onGround = false;
      }

      const spawnGap = Math.max(240, s.speed * 50);
      if (s.spikes.length === 0 || s.spikes[s.spikes.length - 1].x < s.W - spawnGap) {
        const h = 26 + Math.random() * 30;
        const w = 24 + Math.random() * 18;
        s.spikes.push({ x: s.W + 20, w, h });
      }
      s.spikes.forEach(sp => { sp.x -= s.speed; });
      s.spikes = s.spikes.filter(sp => sp.x + sp.w > -10);

      const c = s.cube;
      for (const sp of s.spikes) {
        if (c.x + c.size > sp.x + 4 && c.x + 4 < sp.x + sp.w) {
          if (c.y + c.size > s.groundY - sp.h) {
            s.over = true;
          }
        }
      }

      draw(s);
      if (s.over) { finish(s.seconds); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  if (!profile) return null;

  return (
    <div className="bg-panel rounded-2xl border border-white/10 p-4 sm:p-6 text-center">
      <p className="text-sm text-white/60 mb-3">Survive as long as you can · earn <span className="text-[#a7fcc9] font-display">10 tokens/sec</span> · survive 5 minutes to unlock <span className="text-red-400 font-display">Nexus</span>!</p>

      {phase === 'ready' && (
        <div className="py-6">
          <img src={CUBE_IMG} alt="Cube" className="w-20 h-20 object-contain mx-auto mb-3" />
          <p className="text-white/80 text-sm mb-4">Tap / click / Space to jump over the spikes.</p>
          <Button onClick={startGame} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }} className="font-display">Play</Button>
        </div>
      )}

      {phase === 'playing' && (
        <div className="relative mx-auto cursor-pointer touch-none" style={{ maxWidth: 400 }}
          onPointerDown={(e) => { e.preventDefault(); jump(); }}>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="w-full rounded-xl border border-white/10"
            style={{ aspectRatio: `${W} / ${H}` }}
          />
          <p className="text-xs text-white/60 mt-2">Tap / click / Space to jump</p>
        </div>
      )}

      {phase === 'over' && (
        <div className="py-4">
          <p className="text-5xl font-display text-white mb-2">{seconds}s</p>
          <p className="text-white/70 text-sm mb-1">survived</p>
          <p className="text-[#a7fcc9] font-display text-lg mb-3">+🪙 {earned.toLocaleString()} tokens</p>
          {rewardedCube && (
            <div className="bg-yellow-500/20 border border-yellow-400/40 rounded-xl p-3 mb-3">
              <img src={CUBE_IMG} alt="Cube" className="w-14 h-14 object-contain mx-auto" />
              <p className="text-yellow-300 font-display text-sm mt-1">🎉 You unlocked the Cube blook!</p>
            </div>
          )}
          {rewardedNexus && (
            <div className="bg-gradient-to-r from-red-500/30 to-pink-500/30 border border-red-400/40 rounded-xl p-3 mb-3">
              <img src={NEXUS_IMG} alt="Nexus" className="w-16 h-16 object-contain mx-auto" />
              <p className="text-red-300 font-display mt-1">🏆 You survived 5 minutes! Nexus unlocked!</p>
            </div>
          )}
          {alreadyOwnsNexus && (
            <p className="text-red-300 text-xs mb-3">You already own the Nexus blook!</p>
          )}
          <Button onClick={startGame} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }} className="font-display">Play Again</Button>
        </div>
      )}
    </div>
  );
}