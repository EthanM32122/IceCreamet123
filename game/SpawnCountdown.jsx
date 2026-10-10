import React from 'react';

// Uses the same clock as the collectibles, so the label matches the spawn.
export default function SpawnCountdown({ ms, active }) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  const label = active ? '🎃 Pumpkins out!' : `🎃 Next pumpkins in ${mm}:${String(ss).padStart(2, '0')}`;

  return (
    <div className="fixed top-0 left-1/2 -translate-x-1/2 z-50 flex h-12 items-center justify-center pointer-events-none">
      <span className="text-xs sm:text-sm font-display text-orange-300 drop-shadow-[0_0_6px_rgba(255,160,0,0.6)] whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}