import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { catchBlook, getCatchReward } from '@/lib/caughtBlooks';

export default function BlookJumpers({ onCatch }) {
  const [blooks, setBlooks] = useState([]);
  const [jumpers, setJumpers] = useState([]);
  const [pops, setPops] = useState([]);
  const idRef = useRef(0);
  const queueRef = useRef([]);

  useEffect(() => {
    base44.entities.Blook.filter({}, null, 2000)
      .then(bs => setBlooks(bs.filter(b => b.image_url && b.game !== 'pokemon' && !b.is_deleted)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (blooks.length === 0) return;
    const shuffle = (arr) => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(p => p[1]);
    queueRef.current = shuffle(blooks);
    const spawn = () => {
      setJumpers(prev => {
        if (prev.length >= 14) return prev;
        if (queueRef.current.length === 0) queueRef.current = shuffle(blooks);
        const blook = queueRef.current.shift();
        const id = ++idRef.current;
        const left = Math.random() * 96;
        const height = 220 + Math.random() * 340;
        const duration = 2.4 + Math.random() * 1.8;
        const size = 36 + Math.random() * 44;
        const rotate = (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 360);
        const next = [...prev, { id, blook, left, height, duration, size, rotate }];
        setTimeout(() => setJumpers(p => p.filter(j => j.id !== id)), duration * 1000);
        return next;
      });
    };
    const interval = setInterval(spawn, 550);
    return () => clearInterval(interval);
  }, [blooks]);

  const handleCatch = (j) => {
    const reward = onCatch ? getCatchReward(j.blook.rarity) : catchBlook(j.blook);
    if (onCatch) onCatch(j.blook, reward);
    setJumpers(prev => prev.filter(x => x.id !== j.id));
    const popId = j.id;
    setPops(prev => [...prev, { id: popId, left: j.left, reward }]);
    setTimeout(() => setPops(prev => prev.filter(p => p.id !== popId)), 1100);
  };

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {jumpers.map(j => (
        <img
          key={j.id}
          src={j.blook.image_url}
          alt=""
          onClick={(e) => handleCatch(j, e)}
          className="absolute bottom-0 blook-jumper object-contain pointer-events-auto cursor-pointer hover:drop-shadow-[0_0_8px_rgba(167,252,201,0.9)]"
          style={{
            left: `${j.left}%`,
            width: `${j.size}px`,
            height: `${j.size}px`,
            '--jump-height': `${j.height}px`,
            '--jump-rotate': `${j.rotate}deg`,
            animationDuration: `${j.duration}s`,
          }}
        />
      ))}
      {pops.map(p => (
        <div
          key={p.id}
          className="absolute bottom-0 font-display text-[#a7fcc9] text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
          style={{
            left: `${p.left}%`,
            animation: 'catch-pop 1.1s ease-out forwards',
          }}
        >
          +{p.reward} 🪙
        </div>
      ))}
    </div>
  );
}