import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGame } from '@/lib/gameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TokenIcon } from '@/components/game/CurrencyIcon';
import { ArrowLeft, BookOpen, Bomb } from 'lucide-react';

const MAX_WIN = 30_000_000_000; // 30B tokens
const GRID_OPTIONS = [16, 32, 64];

function gridCols(size) {
  if (size === 16) return 4;
  if (size === 32) return 8;
  return 8;
}

/** Stake-style rising multiplier with ~3% house edge */
function calcMultiplier(gridSize, mines, gemsRevealed) {
  if (gemsRevealed <= 0) return 1;
  const safe = gridSize - mines;
  if (gemsRevealed > safe) return 0;
  let mult = 1;
  for (let i = 0; i < gemsRevealed; i++) {
    mult *= (gridSize - i) / (safe - i);
  }
  return mult * 0.97;
}

function shuffleMines(gridSize, mines) {
  const idx = Array.from({ length: gridSize }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return new Set(idx.slice(0, mines));
}

export default function GamblingMines() {
  const { profile, updateProfile } = useGame();
  const [bet, setBet] = useState(100);
  const [mines, setMines] = useState(3);
  const [gridSize, setGridSize] = useState(25); // will normalize to 16/32/64
  const [phase, setPhase] = useState('idle'); // idle | playing | lost | cashed
  const [mineSet, setMineSet] = useState(null);
  const [revealed, setRevealed] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const [lastPayout, setLastPayout] = useState(0);

  // Normalize grid to allowed sizes (UI uses 16/32/64)
  const size = GRID_OPTIONS.includes(gridSize) ? gridSize : 16;
  const maxMines = Math.max(1, size - 1);
  const safeMines = Math.min(Math.max(1, mines), maxMines);
  const gemsFound = useMemo(() => {
    if (!mineSet) return 0;
    let n = 0;
    revealed.forEach((i) => { if (!mineSet.has(i)) n++; });
    return n;
  }, [revealed, mineSet]);

  const multiplier = calcMultiplier(size, safeMines, gemsFound);
  const potential = Math.min(MAX_WIN, Math.floor(Number(bet) * multiplier));
  const cols = gridCols(size);

  const startGame = async () => {
    if (!profile || busy || phase === 'playing') return;
    const amount = Math.floor(Number(bet) || 0);
    if (amount < 1) return;
    if ((profile.tokens || 0) < amount) {
      alert('Not enough tokens');
      return;
    }
    setBusy(true);
    try {
      await updateProfile({ tokens: Math.max(0, (profile.tokens || 0) - amount) });
      setMineSet(shuffleMines(size, safeMines));
      setRevealed(new Set());
      setPhase('playing');
      setLastPayout(0);
    } catch (e) {
      alert(e?.message || 'Bet failed');
    } finally {
      setBusy(false);
    }
  };

  const reveal = async (index) => {
    if (phase !== 'playing' || revealed.has(index) || busy) return;
    const next = new Set(revealed);
    next.add(index);
    setRevealed(next);

    if (mineSet.has(index)) {
      // Hit a bomb — reveal all mines
      const all = new Set(next);
      mineSet.forEach((m) => all.add(m));
      setRevealed(all);
      setPhase('lost');
      setLastPayout(0);
      return;
    }

    const gems = [...next].filter((i) => !mineSet.has(i)).length;
    const safe = size - safeMines;
    if (gems >= safe) {
      // Cleared board — auto cash out
      await cashOut(next);
    }
  };

  const cashOut = async (revealedOverride) => {
    if (phase !== 'playing' || busy) return;
    const rev = revealedOverride || revealed;
    const gems = [...rev].filter((i) => !mineSet.has(i)).length;
    if (gems < 1) {
      alert('Reveal at least one diamond before cashing out');
      return;
    }
    const mult = calcMultiplier(size, safeMines, gems);
    const payout = Math.min(MAX_WIN, Math.floor(Number(bet) * mult));
    setBusy(true);
    try {
      const bal = Math.floor(Number(profile?.tokens) || 0);
      await updateProfile({ tokens: bal + payout });
      setLastPayout(payout);
      setPhase('cashed');
      // Reveal remaining for fun
      if (mineSet) {
        const all = new Set(rev);
        mineSet.forEach((m) => all.add(m));
        setRevealed(all);
      }
    } catch (e) {
      alert(e?.message || 'Cash out failed');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setPhase('idle');
    setMineSet(null);
    setRevealed(new Set());
    setLastPayout(0);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/gambling" className="text-white/60 hover:text-white flex items-center gap-1 text-sm">
            <ArrowLeft size={16} /> Back
          </Link>
          <h1 className="font-display text-2xl text-white flex items-center gap-2">
            <Bomb size={24} className="text-red-400" /> Mines
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {profile && (
            <div className="flex items-center gap-1.5 text-[#a7fcc9] font-display">
              <TokenIcon size={16} /> {(profile.tokens || 0).toLocaleString()}
            </div>
          )}
          <Button size="sm" variant="outline" className="border-white/20 text-white" onClick={() => setShowHow(true)}>
            <BookOpen size={14} className="mr-1" /> How to play
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        {/* Controls */}
        <div className="rounded-2xl border border-white/10 bg-[#1a1f2e] p-4 space-y-4">
          <div>
            <label className="text-xs text-white/50 block mb-1">Bet amount</label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                disabled={phase === 'playing'}
                value={bet}
                onChange={(e) => setBet(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="bg-white/5 border-white/15 text-white"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={phase === 'playing'}
                className="border-white/20 text-white"
                onClick={() => setBet(Math.max(1, Math.floor((profile?.tokens || 0) / 2)))}
              >½</Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={phase === 'playing'}
                className="border-white/20 text-white"
                onClick={() => setBet(Math.max(1, profile?.tokens || 1))}
              >Max</Button>
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 block mb-1">Grid size</label>
            <div className="flex gap-2">
              {GRID_OPTIONS.map((n) => (
                <Button
                  key={n}
                  type="button"
                  size="sm"
                  disabled={phase === 'playing'}
                  variant={size === n ? 'default' : 'outline'}
                  className={size === n ? '' : 'border-white/20 text-white'}
                  style={size === n ? { backgroundColor: '#a7fcc9', color: '#0a1f16' } : {}}
                  onClick={() => {
                    setGridSize(n);
                    setMines(Math.min(mines, n - 1));
                  }}
                >
                  {n}
                </Button>
              ))}
            </div>
            <p className="text-[10px] text-white/40 mt-1">{size} squares</p>
          </div>

          <div>
            <label className="text-xs text-white/50 block mb-1">Mines (bombs)</label>
            <Input
              type="number"
              min={1}
              max={maxMines}
              disabled={phase === 'playing'}
              value={safeMines}
              onChange={(e) => setMines(Math.min(maxMines, Math.max(1, parseInt(e.target.value, 10) || 1)))}
              className="bg-white/5 border-white/15 text-white"
            />
            <p className="text-[10px] text-white/40 mt-1">More mines = higher multiplier (riskier)</p>
          </div>

          {phase === 'playing' && (
            <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-1">
              <p className="text-xs text-white/50">Current multiplier</p>
              <p className="font-display text-2xl text-[#a7fcc9]">{multiplier.toFixed(2)}x</p>
              <p className="text-sm text-white/70 flex items-center gap-1">
                Cash out <TokenIcon size={14} /> {potential.toLocaleString()}
              </p>
              <p className="text-[10px] text-white/40">Max win per game: 30B</p>
            </div>
          )}

          {phase === 'idle' && (
            <Button
              className="w-full h-12 font-display text-base"
              style={{ backgroundColor: '#a7fcc9', color: '#0a1f16' }}
              disabled={busy}
              onClick={startGame}
            >
              Bet
            </Button>
          )}
          {phase === 'playing' && (
            <Button
              className="w-full h-12 font-display text-base"
              style={{ backgroundColor: '#f1c40f', color: '#1a1a1a' }}
              disabled={busy || gemsFound < 1}
              onClick={() => cashOut()}
            >
              Cash out
            </Button>
          )}
          {(phase === 'lost' || phase === 'cashed') && (
            <div className="space-y-2">
              <p className={`text-center font-display ${
                phase === 'cashed' ? 'text-[#a7fcc9]' : 'text-red-400'
              }`}>
                {phase === 'cashed'
                  ? `Won ${lastPayout.toLocaleString()} tokens!`
                  : 'Boom — you hit a mine'}
              </p>
              <Button className="w-full" style={{ backgroundColor: '#a7fcc9', color: '#0a1f16' }} onClick={reset}>
                Play again
              </Button>
            </div>
          )}
        </div>

        {/* Grid */}
        <div className="rounded-2xl border border-white/10 bg-[#12161f] p-3 sm:p-4">
          <div
            className="grid gap-1.5 sm:gap-2 mx-auto"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              maxWidth: size === 64 ? 520 : size === 32 ? 480 : 360,
            }}
          >
            {Array.from({ length: size }).map((_, i) => {
              const isRev = revealed.has(i);
              const isMine = mineSet?.has(i);
              const showMine = isRev && isMine;
              const showGem = isRev && !isMine;
              const canClick = phase === 'playing' && !isRev;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!canClick || busy}
                  onClick={() => reveal(i)}
                  className={`aspect-square rounded-lg flex items-center justify-center transition-all ${
                    isRev
                      ? 'bg-[#1e2433]'
                      : canClick
                        ? 'bg-[#252b3b] hover:bg-[#2f3648] cursor-pointer'
                        : 'bg-[#1a1f2e]'
                  }`}
                >
                  {showMine && (
                    <span className="text-lg sm:text-2xl" role="img" aria-label="mine">💣</span>
                  )}
                  {showGem && (
                    <span
                      className="w-3/5 h-3/5 rounded-sm"
                      style={{
                        background: 'linear-gradient(135deg, #7dffa3 0%, #2ecc71 50%, #1abc9c 100%)',
                        clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                        boxShadow: '0 0 12px rgba(46,204,113,0.5)',
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={showHow} onOpenChange={setShowHow}>
        <DialogContent className="bg-panel border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-[#a7fcc9]">How to play Mines</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-white/80">
            <p>1. Choose <b>grid size</b>: 16, 32, or 64 squares.</p>
            <p>2. Choose how many <b>mines (bombs)</b>. More mines = higher payouts, higher risk.</p>
            <p>3. Enter your <b>bet</b> and press Bet (tokens are taken immediately).</p>
            <p>4. Click tiles to reveal <b>diamonds</b>. Each diamond raises your multiplier.</p>
            <p>5. Hit a <b>bomb</b> and you lose the bet.</p>
            <p>6. Press <b>Cash out</b> anytime after at least one diamond to take your winnings.</p>
            <p className="text-[#a7fcc9]">Max win per game: 30,000,000,000 tokens.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
