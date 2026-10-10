import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { X } from 'lucide-react';

export default function LiveTradePopups() {
  const { profile } = useGame();
  const navigate = useNavigate();
  const [popups, setPopups] = useState([]);
  // Stable scalar dep — avoids tearing down this realtime subscription each
  // time the profile object changes (heartbeat/token ticks).
  const userId = profile?.user_id;

  useEffect(() => {
    if (!userId) return;
    const unsub = base44.entities.TradeRoom.subscribe((event) => {
      if (event.type === 'create' && event.data.player_b_id === userId && event.data.status === 'pending') {
        const id = event.data.id;
        setPopups(p => p.find(x => x.id === id) ? p : [...p, { id, room: event.data }]);
      }
      if ((event.type === 'update' || event.type === 'delete') && event.data?.player_b_id === userId) {
        setPopups(p => p.filter(x => x.id !== event.data.id));
      }
    });
    return unsub;
  }, [userId]);

  const accept = async (room) => {
    await base44.entities.TradeRoom.update(room.id, { status: 'active' });
    setPopups(p => p.filter(x => x.id !== room.id));
    navigate(`/trade/room/${room.id}`);
  };
  const decline = async (room) => {
    await base44.entities.TradeRoom.update(room.id, { status: 'declined' });
    setPopups(p => p.filter(x => x.id !== room.id));
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-[calc(100vw-2rem)]">
      {popups.map(p => (
        <div key={p.id} className="bg-panel border border-[#a7fcc9]/40 rounded-xl p-3 shadow-lg max-w-xs">
          <div className="flex items-start gap-2">
            <span className="text-xl">🔄</span>
            <div className="flex-1">
              <p className="text-sm font-display text-[#a7fcc9]">Trade Request!</p>
              <p className="text-xs text-white/80 mt-0.5">{p.room.player_a_username} wants to trade.</p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => accept(p.room)} className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#2ecc71', color: '#fff' }}>Accept</button>
                <button onClick={() => decline(p.room)} className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#e74c3c', color: '#fff' }}>Decline</button>
              </div>
            </div>
            <button onClick={() => setPopups(x => x.filter(y => y.id !== p.id))} className="text-white/40 hover:text-white"><X size={14} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}