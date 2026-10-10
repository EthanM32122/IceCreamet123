import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Gauge, Footprints, Clock, MessageCircle, Leaf, Info, Play, Lock } from 'lucide-react';

export default function GameDetailPanel({ game, onPlay, locked, lockReason, busy }) {
  const [mastery, setMastery] = useState(false);
  if (!game) return null;

  const meta = [
    { icon: Gauge, label: 'Difficulty', value: game.difficulty },
    { icon: Footprints, label: 'Skills', value: game.skills },
    { icon: Clock, label: 'Ideal Time', value: game.time },
    { icon: MessageCircle, label: 'Questions', value: game.questions },
  ];

  return (
    <div className="bg-[#a7fcc9] rounded-2xl p-5 flex flex-col">
      {/* Game banner */}
      <div className="bg-panel rounded-xl p-6 mb-3 flex items-center justify-center min-h-[140px]">
        {game.iconType === 'img'
          ? <img src={game.icon} alt={game.name} className="w-20 h-20 object-contain" />
          : <span className="text-6xl">{game.icon}</span>}
      </div>

      {/* Title */}
      <h3 className="font-display text-xl text-center text-panel mb-2">{game.name}</h3>

      {/* Subheader */}
      <div className="bg-panel rounded-xl p-2.5 mb-3 text-center">
        <p className="text-white text-xs font-display leading-snug">{game.desc}</p>
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {meta.map((m) => (
          <div key={m.label} className="bg-white rounded-xl p-2.5">
            <div className="flex items-center gap-1 mb-0.5">
              <m.icon size={12} className="text-panel" />
              <span className="text-[9px] text-gray-500 font-display">{m.label}</span>
            </div>
            <p className="text-xs text-panel font-display leading-tight">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 mb-3 text-panel">
        <Leaf size={14} />
        <Checkbox checked={mastery} onCheckedChange={setMastery} />
        <span className="text-xs font-display">Use Mastery Mode</span>
        <Info size={12} className="ml-auto opacity-50" />
      </div>

      {/* Play button */}
      <Button
        onClick={onPlay}
        disabled={locked || busy}
        className="w-full text-lg font-display"
        style={{ backgroundColor: 'rgb(var(--user-sidebar))', color: '#fff' }}
      >
        {locked ? (
          <><Lock size={16} className="mr-2" /> Locked</>
        ) : busy ? (
          'Joining...'
        ) : (
          <><Play size={18} className="mr-2" /> Play</>
        )}
      </Button>
      {locked && <p className="text-xs text-panel/70 text-center mt-2">{lockReason}</p>}
    </div>
  );
}