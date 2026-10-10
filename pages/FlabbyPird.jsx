import React, { useEffect } from 'react';

export default function FlabbyPird() {
  useEffect(() => {
    window.location.replace('https://flabbypirdv2.base44.app');
  }, []);
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <h1 className="rainbow-name text-5xl md:text-8xl font-display text-center leading-tight">FLABBY PIRD V2</h1>
      <p className="text-white/70 mt-6 text-sm font-display animate-pulse">sending you to the game…</p>
    </div>
  );
}