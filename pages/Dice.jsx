import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGame } from '@/lib/gameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TokenIcon } from '@/components/game/CurrencyIcon';
import { ArrowLeft, BookOpen, Dices } from 'lucide-react';

const HOUSE_EDGE = 0.99; // ~1% house edge
const MAX_ROUNDS = 50;

function chanceFor(target, mode) {
  // target 1–99, roll is 0.00–99.99 style as integer 0–10000 then /100
  // Simpler: roll integer 0–99 inclusive
  if (mode === 'under') return Math.max(1, Math.min(98, target)) / 100;
  return Math.max(1, Math.min(98, 100 - target)) / 100;
}

function multiplierFor(chance) {
  if (chance <= 0) return 1;
  return HOUSE_EDGE / chance;
}

export default function Dice() {
  const { profile, updateProfile } = useGame();
  const [bet, setBet] = useState(100);
  const [target, setTarget] = useState(50);
  const [mode, setMode] = useState('under'); // under | over
  const [rounds, setRounds] = useState(1);
  const [busy, setBusy] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const [lastRoll, setLastRoll] = useState(null);
  const [history, setHistory] = useState([]); // { roll, win, payout }
  const [autoRunning, setAutoRunning] = useState(false);

  const chance = chanceFor(target, mode);
  const mult = multiplierFor(chance);
  const potential = Math.floor(Number(bet) * mult);

  const sliderPct = useMemo(() => Math.max(1, Math.min(99, target)), [target]);

  const playOnce = async (currentTokens) => {
    const amount = Math.floor(Number(bet) || 0);
    if (amount < 1) throw new Error('Invalid bet');
    if (currentTokens < amount) throw new Error('Not enough tokens');

    // Roll 0.00 – 99.99
    const roll = Math.floor(Math.random() * 10000) / 100;
    const win =
      mode === 'under' ? roll < target : roll > target;
    const payout = win ? Math.floor(amount * mult) : 0;
    const nextTokens = currentTokens - amount + payout;
    return { roll, win, payout, nextTokens, amount };
  };

  const runManual = async () => {
    if (!profile || busy) return;
    setBusy(true);
    try {
      let tokens = Math.floor(Number(profile.tokens) || 0);
      const result = await playOnce(tokens);
      await updateProfile({ tokens: result.nextTokens });
      setLastRoll(result.roll);
      setHistory((h) => [{ ...result, mode, target }, ...h].slice(0, 20));
    } catch (e) {
      alert(e?.message || 'Roll failed');
    } finally {
      setBusy(false);
    }
  };

  const runAuto = async () => {
    if (!profile || busy || autoRunning) return;
    const n = Math.min(MAX_ROUNDS, Math.max(1, Math.floor(Number(rounds) || 1)));
    setAutoRunning(true);
    setBusy(true);
    try {
      let tokens = Math.floor(Number(profile.tokens) || 0);
      const batch = [];
      for (let i = 0; i < n; i++) {
        try {
          const result = await playOnce(tokens);
          tokens = result.nextTokens;
          batch.push({ ...result, mode, target });
          setLastRoll(result.roll);
        } catch (e) {
          alert(e?.message || 'Stopped early');
          break;
        }
      }
      await updateProfile({ tokens });
      setHistory((h) => [...batch.reverse(), ...h].slice(0, 30));
    } finally {
      setBusy(false);
      setAutoRunning(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/gambling" className="text-white/60 hover:text-white flex items-center gap-1 text-sm">
            <ArrowLeft size={16} /> Back
          </Link>
          <h1 className="font-display text-2xl text-white flex items-center gap-2">
            <Dices size={24} className="text-purple-300" /> Dice
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

      <div className="rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-b from-[#5b2d8e] to-[#2a1450] p-5 space-y-5">
        {/* Roll display */}
        <div className="text-center">
          <p className="text-5xl font-display text-white tracking-tight">
            {lastRoll == null ? '—' : lastRoll.toFixed(2)}
          </p>
          <div className="mt-4 relative h-3 rounded-full overflow-hidden bg-white/10">
            <div
              className="absolute inset-y-0 left-0 bg-emerald-400/80"
              style={{ width: `${mode === 'under' ? sliderPct : 100 - sliderPct}%`, left: mode === 'under' ? 0 : `${sliderPct}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-yellow-300 border-2 border-white shadow"
              style={{ left: `calc(${sliderPct}% - 8px)` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-white/40 mt-1">
            <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-black/25 p-3">
            <p className="text-white/50 text-xs">Payout</p>
            <p className="font-display text-xl text-white">{mult.toFixed(2)}x</p>
          </div>
          <div className="rounded-xl bg-black/25 p-3">
            <p className="text-white/50 text-xs">Win chance</p>
            <p className="font-display text-xl text-white">{(chance * 100).toFixed(2)}%</p>
          </div>
          <div className="rounded-xl bg-black/25 p-3 col-span-2">
            <p className="text-white/50 text-xs">Potential win</p>
            <p className="font-display text-lg text-[#a7fcc9] flex items-center gap-1">
              <TokenIcon size={16} /> {potential.toLocaleString()}
            </p>
          </div>
        </div>

        <div>
          <label className="text-xs text-white/60 block mb-1">Target number (1–99)</label>
          <Input
            type="number"
            min={1}
            max={99}
            value={target}
            onChange={(e) => setTarget(Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)))}
            className="bg-black/30 border-white/20 text-white"
          />
          <input
            type="range"
            min={1}
            max={99}
            value={sliderPct}
            onChange={(e) => setTarget(parseInt(e.target.value, 10))}
            className="w-full mt-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            className="h-12 font-display"
            style={{
              backgroundColor: mode === 'under' ? '#2ecc71' : 'rgba(255,255,255,0.1)',
              color: mode === 'under' ? '#fff' : 'rgba(255,255,255,0.7)',
            }}
            onClick={() => setMode('under')}
          >
            Roll under {target}
          </Button>
          <Button
            type="button"
            className="h-12 font-display"
            style={{
              backgroundColor: mode === 'over' ? '#3498db' : 'rgba(255,255,255,0.1)',
              color: mode === 'over' ? '#fff' : 'rgba(255,255,255,0.7)',
            }}
            onClick={() => setMode('over')}
          >
            Roll over {target}
          </Button>
        </div>

        <div>
          <label className="text-xs text-white/60 block mb-1">Bet (tokens)</label>
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              value={bet}
              onChange={(e) => setBet(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="bg-black/30 border-white/20 text-white"
            />
            <Button type="button" variant="outline" className="border-white/30 text-white" onClick={() => setBet(Math.max(1, Math.floor((profile?.tokens || 0) / 2)))}>½</Button>
            <Button type="button" variant="outline" className="border-white/30 text-white" onClick={() => setBet(Math.max(1, profile?.tokens || 1))}>Max</Button>
          </div>
        </div>

        <Button
          className="w-full h-12 font-display text-base"
          style={{ backgroundColor: '#a7fcc9', color: '#1a0a2e' }}
          disabled={busy}
          onClick={runManual}
        >
          {busy && !autoRunning ? 'Rolling…' : 'Roll once'}
        </Button>

        {/* Auto */}
        <div className="rounded-2xl bg-black/30 border border-white/10 p-4 space-y-3">
          <p className="font-display text-white text-sm">Auto play</p>
          <div>
            <label className="text-xs text-white/50 block mb-1">Number of rounds (max {MAX_ROUNDS})</label>
            <div className="flex flex-wrap gap-2">
              {[1, 3, 5, 10, 25, 50].map((n) => (
                <Button
                  key={n}
                  type="button"
                  size="sm"
                  variant={rounds === n ? 'default' : 'outline'}
                  className={rounds === n ? '' : 'border-white/20 text-white'}
                  style={rounds === n ? { backgroundColor: '#a7fcc9', color: '#1a0a2e' } : {}}
                  onClick={() => setRounds(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
            <Input
              type="number"
              min={1}
              max={MAX_ROUNDS}
              value={rounds}
              onChange={(e) => setRounds(Math.min(MAX_ROUNDS, Math.max(1, parseInt(e.target.value, 10) || 1)))}
              className="mt-2 bg-black/30 border-white/20 text-white"
            />
          </div>
          <Button
            className="w-full h-11 font-display"
            style={{ backgroundColor: '#2ecc71', color: '#fff' }}
            disabled={busy}
            onClick={runAuto}
          >
            {autoRunning ? 'Running…' : `Start auto (${rounds} rounds)`}
          </Button>
        </div>
      </div>

      {history.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1 max-h-40 overflow-y-auto">
          <p className="text-xs text-white/50 font-display">Recent</p>
          {history.map((h, i) => (
            <div key={i} className="flex justify-between text-xs text-white/80">
              <span>Roll {h.roll?.toFixed(2)} · {h.mode} {h.target}</span>
              <span className={h.win ? 'text-[#a7fcc9]' : 'text-red-400'}>
                {h.win ? `+${h.payout.toLocaleString()}` : `-${h.amount.toLocaleString()}`}
              </span>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showHow} onOpenChange={setShowHow}>
        <DialogContent className="bg-panel border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-[#a7fcc9]">How to play Dice</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-white/80">
            <p>1. Set a <b>target</b> number from 1–99.</p>
            <p>2. Choose <b>Roll under</b> or <b>Roll over</b>.</p>
            <p>3. Enter your <b>bet</b> in tokens.</p>
            <p>4. Lower chance = higher payout (about 1% house edge).</p>
            <p>5. Use <b>Auto play</b> to run up to <b>50</b> rounds in a row.</p>
            <p>Example: under 50 ≈ 50% chance, ~1.98x payout.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
