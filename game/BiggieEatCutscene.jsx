import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const CHEESEBURGER_IMG = 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/d8c5ed85f_image.png';

export default function BiggieEatCutscene() {
  const [event, setEvent] = useState(null);
  const [phase, setPhase] = useState(0);
  const [exiting, setExiting] = useState(false);
  const lastEventId = useRef(null);

  useEffect(() => {
    base44.entities.BiggieEatEvent.list('-created_date', 1).then(events => {
      if (events[0]) lastEventId.current = events[0].id;
    });

    const unsub = base44.entities.BiggieEatEvent.subscribe((evt) => {
      if (evt.type === 'create' && evt.data?.id !== lastEventId.current) {
        lastEventId.current = evt.data.id;
        setEvent(evt.data);
        setPhase(0);
        setExiting(false);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!event) return;
    const timers = [
      setTimeout(() => setPhase(1), 2000),
      setTimeout(() => setPhase(2), 4000),
      setTimeout(() => setPhase(3), 6500),
      setTimeout(() => setExiting(true), 7800),
      setTimeout(() => { setEvent(null); setPhase(0); setExiting(false); }, 8800),
    ];
    return () => timers.forEach(clearTimeout);
  }, [event]);

  if (!event) return null;

  return (
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black ${exiting ? 'animate-biggie-overlay-out' : 'animate-biggie-overlay-in'}`}>
      {phase === 0 && (
        <div className="text-center animate-biggie-fade-in">
          <div className="text-7xl mb-4">🍔</div>
          <h1 className="text-5xl font-display text-amber-400" style={{ textShadow: '0 0 30px rgba(255,215,0,0.6)' }}>
            The Biggie is hungry...
          </h1>
        </div>
      )}

      {phase === 1 && (
        <div className="text-center animate-biggie-fade-in">
          <img
            src={event.target_avatar || 'https://www.gravatar.com/avatar/?d=mp&s=128'}
            alt={event.target_username}
            className="w-32 h-32 rounded-full mx-auto mb-4 border-4 border-amber-400 object-cover"
            onError={(e) => { e.target.src = 'https://www.gravatar.com/avatar/?d=mp&s=128'; }}
          />
          <h2 className="text-4xl font-display text-white">{event.target_username}</h2>
          <p className="text-xl text-white/60 mt-2">is about to get eaten!</p>
        </div>
      )}

      {phase === 2 && (
        <div className="text-center">
          <div className="relative w-48 h-48 mx-auto mb-4 flex items-center justify-center">
            <img
              src={event.target_avatar || 'https://www.gravatar.com/avatar/?d=mp&s=128'}
              alt={event.target_username}
              className="w-32 h-32 rounded-full absolute animate-biggie-target-shrink object-cover"
              onError={(e) => { e.target.src = 'https://www.gravatar.com/avatar/?d=mp&s=128'; }}
            />
            <img
              src={CHEESEBURGER_IMG}
              alt="Cheeseburger"
              className="w-36 h-36 absolute animate-biggie-eat-slide object-contain"
            />
          </div>
          <h2 className="text-5xl font-display text-amber-400 animate-biggie-shake" style={{ textShadow: '0 0 30px rgba(255,215,0,0.6)' }}>
            Nom nom nom!
          </h2>
        </div>
      )}

      {phase === 3 && (
        <div className="text-center animate-biggie-fade-in">
          {event.blook_image && (
            <img
              src={event.blook_image}
              alt={event.blook_name}
              className="w-24 h-24 mx-auto mb-4 object-contain opacity-40"
            />
          )}
          <h2 className="text-3xl font-display text-white">
            {event.target_username} lost their
          </h2>
          <h3 className="text-4xl font-display text-amber-400 mt-1">
            {event.blook_name}!
          </h3>
          <p className="text-lg text-white/40 mt-4">— eaten by Phantom_Grip 🍔</p>
        </div>
      )}
    </div>
  );
}