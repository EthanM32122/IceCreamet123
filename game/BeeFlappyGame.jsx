import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { PIPES_TO_WIN, BIOME_BACKGROUNDS } from '@/lib/hivelands';

const W = 400, H = 600;
const BEE_IMAGE = 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/f579b362e_image.png';

// Flappy-bird style minigame: play as a bee, reach PIPES_TO_WIN pipes to clear
// the biome and earn its ingredient. Calls onWin() on success and onLose() on
// collision.
export default function BeeFlappyGame({ biome, onWin, onLose, onExit }) {
  const [phase, setPhase] = useState('ready'); // ready | playing | won | lost
  const [score, setScore] = useState(0);
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const beeImgRef = useRef(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  // Keep callbacks in refs so the game loop effect doesn't re-run (and reset
  // the bee mid-flight) whenever the parent re-renders with new callback identities.
  const onWinRef = useRef(onWin);
  const onLoseRef = useRef(onLose);
  onWinRef.current = onWin;
  onLoseRef.current = onLose;

  // Preload the bee sprite.
  useEffect(() => {
    const img = new Image();
    img.src = BEE_IMAGE;
    img.onload = () => { beeImgRef.current = img; };
  }, []);

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

  const start = () => {
    setScore(0);
    setPhase('playing');
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    stateRef.current = {
      bird: { x: 90, y: H / 2, vy: 0, size: 44 },
      pipes: [], score: 0, frame: 0, over: false, won: false,
      W, H, pipeGap: 190, pipeWidth: 66, pipeSpacing: 240,
      speed: 2.6, gravity: 0.36, flapV: -6.4, groundY: H - 52,
      bgImg: null
    };

    // Preload the biome's background image.
    const bgUrl = BIOME_BACKGROUNDS[biome.id];
    if (bgUrl) {
      const img = new Image();
      img.src = bgUrl;
      img.onload = () => { if (stateRef.current) stateRef.current.bgImg = img; };
    }

    let raf;
    const draw = (s) => {
      // Draw the biome's own background image, falling back to a tint.
      if (s.bgImg) {
        ctx.drawImage(s.bgImg, 0, 0, s.W, s.H);
      } else {
        const base = ctx.createLinearGradient(0, 0, 0, s.H);
        base.addColorStop(0, biome.color || '#87CEEB');
        base.addColorStop(1, '#E0F7FA');
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, s.W, s.H);
      }

      // Pipes as honeycomb-ish green tubes.
      s.pipes.forEach(p => {
        ctx.fillStyle = 'rgba(126, 200, 80, 0.92)';
        ctx.fillRect(p.x, 0, s.pipeWidth, p.gapY);
        ctx.fillRect(p.x, p.gapY + s.pipeGap, s.pipeWidth, s.groundY - (p.gapY + s.pipeGap));
        ctx.fillStyle = 'rgba(95, 168, 52, 0.95)';
        ctx.fillRect(p.x - 3, p.gapY - 16, s.pipeWidth + 6, 16);
        ctx.fillRect(p.x - 3, p.gapY + s.pipeGap, s.pipeWidth + 6, 16);
      });

      // Ground.
      ctx.fillStyle = 'rgba(222, 216, 149, 0.9)';
      ctx.fillRect(0, s.groundY, s.W, s.H - s.groundY);
      ctx.fillStyle = 'rgba(201, 185, 122, 0.95)';
      ctx.fillRect(0, s.groundY, s.W, 6);

      // Bee.
      if (beeImgRef.current) {
        const tilt = Math.max(-0.4, Math.min(0.9, s.bird.vy / 12));
        ctx.save();
        ctx.translate(s.bird.x + s.bird.size / 2, s.bird.y + s.bird.size / 2);
        ctx.rotate(tilt);
        ctx.drawImage(beeImgRef.current, -s.bird.size / 2, -s.bird.size / 2, s.bird.size, s.bird.size);
        ctx.restore();
      } else {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(s.bird.x + s.bird.size / 2, s.bird.y + s.bird.size / 2, s.bird.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Score.
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 34px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#00000088';
      ctx.lineWidth = 4;
      ctx.strokeText(`${s.score}/${PIPES_TO_WIN}`, s.W / 2, 52);
      ctx.fillText(`${s.score}/${PIPES_TO_WIN}`, s.W / 2, 52);
    };

    const finish = (s) => {
      cancelAnimationFrame(raf);
      const won = s.won;
      setPhase(won ? 'won' : 'lost');
      if (won) onWinRef.current && onWinRef.current();
      else onLoseRef.current && onLoseRef.current();
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
          if (s.score >= PIPES_TO_WIN) {
            s.won = true;
            s.over = true;
          }
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
      if (s.over) { finish(s); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // Only re-run when the player actually starts/restarts or the biome changes —
    // NOT when parent re-renders with new onWin/onLose identities (that reset the
    // bee mid-flight).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, biome.id]);

  return (
    <div className="bg-panel rounded-2xl border border-amber-400/30 p-4 text-center">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-display text-lg text-amber-300">{biome.name}</p>
          <p className="text-xs text-white/60">Reach {PIPES_TO_WIN} pipes to harvest an ingredient</p>
        </div>
        <Button size="sm" variant="outline" onClick={onExit} className="border-white/20 text-white">✕ Exit</Button>
      </div>

      {phase === 'ready' && (
        <div className="py-8">
          <img src={BEE_IMAGE} alt="bee" className="w-20 h-20 object-contain mx-auto mb-3 animate-bounce" />
          <p className="text-white/80 text-sm mb-4">Tap, click, or press Space to flap. Don't hit the pipes or the ground!</p>
          <Button onClick={start} style={{ backgroundColor: '#fbbf24', color: '#1a1a1a' }} className="font-display text-base px-8">Start Flying 🐝</Button>
        </div>
      )}

      {(phase === 'playing') && (
        <div className="relative mx-auto" style={{ maxWidth: 400 }}>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            onPointerDown={(e) => { e.preventDefault(); flap(); }}
            className="w-full rounded-xl border border-amber-400/30 cursor-pointer touch-none"
            style={{ aspectRatio: `${W} / ${H}` }}
          />
          <p className="text-xs text-white/60 mt-2">Tap / click / Space to flap · {score}/{PIPES_TO_WIN}</p>
        </div>
      )}

      {phase === 'won' && (
        <div className="py-6">
          <p className="text-5xl mb-2">🍯</p>
          <p className="font-display text-2xl text-amber-300 mb-1">Biome Cleared!</p>
          <p className="text-white/70 text-sm mb-4">You harvested an ingredient from {biome.name}.</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={onExit} variant="outline" className="border-white/20 text-white">Back to Hivelands</Button>
          </div>
        </div>
      )}

      {phase === 'lost' && (
        <div className="py-6">
          <p className="text-4xl mb-2">💨</p>
          <p className="font-display text-2xl text-red-400 mb-1">Crashed!</p>
          <p className="text-white/70 text-sm mb-1">You reached {score}/{PIPES_TO_WIN} pipes.</p>
          <p className="text-white/50 text-xs mb-4">Try again — the ingredient is still waiting.</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={onExit} variant="outline" className="border-white/20 text-white">Exit</Button>
            <Button onClick={start} style={{ backgroundColor: '#fbbf24', color: '#1a1a1a' }} className="font-display">Try Again 🐝</Button>
          </div>
        </div>
      )}
    </div>
  );
}