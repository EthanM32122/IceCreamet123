import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

export default function PullsChannel() {
  const [pulls, setPulls] = useState([]);
  const [loading, setLoading] = useState(true);
  const endRef = useRef(null);

  useEffect(() => {
    base44.entities.PullAnnouncement.list('-created_date', 50).then(items => {
      setPulls(items);
      setLoading(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }).catch(() => setLoading(false));
    const unsub = base44.entities.PullAnnouncement.subscribe((event) => {
      if (event.type === 'create') {
        setPulls(prev => prev.some(p => p.id === event.data.id) ? prev : [event.data, ...prev].slice(0, 50));
      }
    });
    return unsub;
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
      {loading && <div className="flex justify-center py-8"><div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" /></div>}
      {!loading && pulls.length === 0 && <p className="text-white/50 text-sm text-center py-8">No mythical+ pulls yet.</p>}
      {pulls.map(p => (
        <div key={p.id} className="flex items-center gap-1.5 bg-white/5 rounded-lg p-2 flex-wrap text-sm">
          <span className="text-white">😱OMG!!!</span>
          <span className="font-display text-white">{p.username}</span>
          <span className="text-white/70">has just pulled the</span>
          {p.blook_image_url && <img src={p.blook_image_url} alt={p.blook_name} className="inline-block w-8 h-8 object-contain" />}
          <span className={`font-display rarity-${p.rarity}`}>{p.blook_name}</span>
          <span className="text-white/70">Blook From the</span>
          <span className="font-display text-[#a7fcc9]">{p.pack_name}</span>
          <span className="text-white/70">Pack!</span>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}