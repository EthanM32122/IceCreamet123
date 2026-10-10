import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dices } from 'lucide-react';

const PRIZES = [2500, 3000, 4000, 5000, 6000, 7000, 8000, 10000];
const SLOT_COUNT = 8;
const SLOT_HEIGHT = 80;

export default function SpinWheel({ profile, onSpin }) {
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [offset, setOffset] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);

  const canSpin = () => {
    if (!profile?.last_spin_time) return true;
    const last = new Date(profile.last_spin_time).getTime();
    const elapsed = Date.now() - last;
    return elapsed >= 3600000;
  };

  const updateTimeLeft = () => {
    if (canSpin()) { setTimeLeft(null); return; }
    const remaining = 3600000 - (Date.now() - new Date(profile.last_spin_time).getTime());
    setTimeLeft(remaining);
  };

  useEffect(() => {
    updateTimeLeft();
    const t = setInterval(updateTimeLeft, 1000);
    return () => clearInterval(t);
  }, [profile?.last_spin_time]);

  const handleSpin = async () => {
    if (spinning || !canSpin()) return;
    setSpinning(true);
    setResult(null);

    const prizeIdx = Math.floor(Math.random() * PRIZES.length);
    const prize = PRIZES[prizeIdx];

    // Spin at least 3 full rotations + land on the prize slot
    const fullRotations = 3;
    const landingIdx = prizeIdx;
    const finalOffset = -(fullRotations * SLOT_COUNT + landingIdx) * SLOT_HEIGHT;

    // Reset to 0 then animate
    setOffset(0);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setOffset(finalOffset);
      });
    });

    setTimeout(async () => {
      setResult(prize);
      setSpinning(false);
      await onSpin(prize);
    }, 3000);
  };

  const formatTime = (ms) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}m ${s}s`;
  };

  return (
    <div className="bg-panel rounded-2xl shadow-lg p-6 mb-6 border-2 border-[#a7fcc9]">
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-2 mb-3">
          <Dices className="w-6 h-6 text-[#a7fcc9]" />
          <h3 className="text-xl font-display text-[#a7fcc9]">Hourly Token Spin</h3>
        </div>
        <p className="text-sm text-white/60 mb-4 text-center">Spin every hour for 2,500–10,000 tokens!</p>

        {/* Slot machine */}
        <div className="relative overflow-hidden w-48 h-20 rounded-xl border-4 border-panel bg-[#a7fcc9]/20 mb-4">
          {/* Center pointer */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-full flex justify-center">
            <div className="w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-l-[10px] border-l-panel" />
          </div>
          {/* Center line */}
          <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-px bg-panel/30 z-10" />

          {/* Reel */}
          <div
            className="absolute top-0 left-0 w-full"
            style={{
              transform: `translateY(calc(50% - ${SLOT_HEIGHT / 2}px + ${offset}px))`,
              transition: spinning ? 'transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none'
            }}
          >
            {[...PRIZES, ...PRIZES, ...PRIZES, ...PRIZES].map((prize, i) => (
              <div
                key={i}
                className="flex items-center justify-center w-full"
                style={{ height: SLOT_HEIGHT }}
              >
                <span className="text-2xl font-display text-[#a7fcc9]">{prize.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {result !== null && !spinning && (
          <div className="text-center mb-3 animate-legendary">
            <p className="text-lg font-display text-[#a7fcc9]">You won</p>
            <p className="text-3xl font-display text-[#a7fcc9]">{result.toLocaleString()} tokens!</p>
          </div>
        )}

        {timeLeft !== null ? (
          <div className="text-center">
            <Button disabled className="text-base font-display">
              Next spin in {formatTime(timeLeft)}
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleSpin}
            disabled={spinning}
            className="text-base font-display bg-panel hover:bg-[#1a5a38] text-white"
          >
            {spinning ? 'Spinning...' : 'Spin Now!'}
          </Button>
        )}
      </div>
    </div>
  );
}