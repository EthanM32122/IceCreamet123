import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

export default function BoostPopup() {
  const [popup, setPopup] = useState(null);
  const lastCountRef = useRef(0);
  const initializedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const processBoost = (s) => {
      if (!s) { lastCountRef.current = 0; return; }
      let boosts;
      try { boosts = JSON.parse(s.value); } catch (e) { return; }
      const now = new Date();
      const active = Array.isArray(boosts) ? boosts.filter(b => b.end_time && new Date(b.end_time) > now) : [];
      if (!initializedRef.current) {
        initializedRef.current = true;
        lastCountRef.current = active.length;
        return;
      }
      // A new booster was added — count went up
      if (active.length > lastCountRef.current) {
        const latest = active[active.length - 1];
        const multiplier = 2 * active.length;
        const endEst = new Date(latest.end_time).toLocaleString([], {
          timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        setPopup({ booster: latest.booster_username || 'Someone', multiplier, endEst });
        setTimeout(() => setPopup(null), 5000);
      }
      lastCountRef.current = active.length;
    };
    // Single initial read on mount
    base44.entities.GameSettings.filter({ key: 'pack_boost' }).then((settings) => {
      if (!cancelled && settings[0]) processBoost(settings[0]);
    });
    // Use subscription event data directly — no re-query needed
    const unsub = base44.entities.GameSettings.subscribe((event) => {
      if ((event.type === 'create' || event.type === 'update') && event.data?.key === 'pack_boost') {
        processBoost(event.data);
      }
    });
    return () => { cancelled = true; if (typeof unsub === 'function') unsub(); };
  }, []);

  if (!popup) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none px-4">
      <div className="rainbow-border rounded-3xl p-[3px] max-w-lg w-full animate-blook-rise">
        <div className="bg-panel rounded-3xl p-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-display rainbow-name mb-2">🌍 GLOBAL PACK BOOST!</h2>
          <p className="text-lg text-white font-display">{popup.booster} has boosted the global drop rates by {popup.multiplier}x!!</p>
          <p className="text-sm text-[#a7fcc9] mt-2">The booster will end {popup.endEst} EST</p>
        </div>
      </div>
    </div>
  );
}