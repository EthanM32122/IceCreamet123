import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';

const CHEESEBURGER_IMG = 'https://ac.blooket.com/marketassets/blooks/cheeseburger.svg';

const DURATIONS = { rain: 10000, flip: 10000, quake: 5000, fog: 10000, disco: 10000, sit: 600000 };

export default function BiggieTrollOverlay() {
  const { profile } = useGame();
  const [trolls, setTrolls] = useState([]);
  const lastEventId = useRef(null);

  useEffect(() => {
    if (!profile?.user_id) return;
    base44.entities.BiggieTrollEvent.list('-created_date', 10).then(events => {
      if (events[0]) lastEventId.current = events[0].id;
      // Re-apply persistent "sit" effect if still active
      const mySit = events.find(e => e.target_user_id === profile.user_id && e.troll_type === 'sit');
      if (mySit) {
        const elapsed = Date.now() - new Date(mySit.created_date).getTime();
        const remaining = DURATIONS.sit - elapsed;
        if (remaining > 0) {
          const id = Date.now();
          setTrolls(prev => [...prev, { id, type: 'sit' }]);
          setTimeout(() => setTrolls(prev => prev.filter(t => t.id !== id)), remaining);
        }
      }
    });

    const unsub = base44.entities.BiggieTrollEvent.subscribe((evt) => {
      if (evt.type === 'create' && evt.data?.id !== lastEventId.current) {
        lastEventId.current = evt.data.id;
        if (evt.data.target_user_id === profile?.user_id) {
          const id = Date.now() + Math.random();
          setTrolls(prev => [...prev, { id, type: evt.data.troll_type }]);
          setTimeout(() => setTrolls(prev => prev.filter(t => t.id !== id)), DURATIONS[evt.data.troll_type] || 5000);
        }
      }
    });
    return unsub;
  }, [profile?.user_id]);

  const hasFlip = trolls.some(t => t.type === 'flip');
  const hasQuake = trolls.some(t => t.type === 'quake');
  const hasDisco = trolls.some(t => t.type === 'disco');
  const hasRain = trolls.some(t => t.type === 'rain');
  const hasFog = trolls.some(t => t.type === 'fog');
  const hasSit = trolls.some(t => t.type === 'sit');

  useEffect(() => {
    document.body.classList.toggle('troll-flip', hasFlip);
    document.body.classList.toggle('troll-quake', hasQuake);
    document.body.classList.toggle('troll-disco', hasDisco);
    document.body.classList.toggle('troll-sit', hasSit);
    return () => {
      document.body.classList.remove('troll-flip', 'troll-quake', 'troll-disco', 'troll-sit');
    };
  }, [hasFlip, hasQuake, hasDisco, hasSit]);

  if (trolls.length === 0) return null;

  return (
    <>
      {hasRain && (
        <div className="fixed inset-0 z-[9998] pointer-events-none overflow-hidden">
          {Array.from({ length: 40 }).map((_, i) => (
            <img key={i} src={CHEESEBURGER_IMG} alt="" className="absolute troll-rain object-contain" style={{
              left: `${Math.random() * 100}%`, top: '-60px', width: '40px', height: '40px',
              animationDelay: `${Math.random() * 3}s`, animationDuration: `${2 + Math.random() * 3}s`
            }} />
          ))}
        </div>
      )}
      {hasFog && <div className="fixed inset-0 z-[9998] pointer-events-none troll-fog" />}
      {hasSit && (
        <div className="fixed inset-0 z-[9999] pointer-events-none flex flex-col items-center justify-center">
          <img src={CHEESEBURGER_IMG} alt="" className="troll-sit-burger object-contain" style={{ width: '70vmin', height: '70vmin' }} />
          <h2 className="text-6xl font-display text-amber-400 mt-4 animate-biggie-shake" style={{ textShadow: '0 0 20px rgba(0,0,0,0.9), 0 4px 8px rgba(0,0,0,0.8)' }}>
            SQUISHED!
          </h2>
          <p className="text-2xl text-white/90 mt-2 font-display" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
            🍔 Phantom_Grip sat on you! 🍔
          </p>
        </div>
      )}
    </>
  );
}