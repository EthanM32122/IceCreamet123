import React, { useState, useEffect } from 'react';
import { Crown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { ROLE_COLORS, ROLE_BADGES } from '@/lib/constants';

export default function Leaderboard() {
  const { profile } = useGame();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.PlayerProfile.filter({}).then(all => {
      setPlayers(all.sort((a, b) => (b.tokens || 0) - (a.tokens || 0)).slice(0, 10));
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  const medalColors = ['#f59e0b', '#9ca3af', '#d97706'];

  return (
    <div className="bg-panel rounded-2xl border border-white/10 p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Crown size={20} className="text-[#f59e0b]" />
        <h3 className="font-display text-[#a7fcc9]">Token Leaderboard</h3>
      </div>
      <div className="space-y-2">
        {players.map((p, i) => (
          <div key={p.id} className={`flex items-center gap-3 p-2 rounded-lg ${p.user_id === profile?.user_id ? 'bg-[#a7fcc9]/20 ring-1 ring-[#a7fcc9]/30' : 'bg-white/5'}`}>
            <span className="w-6 text-center font-display text-sm" style={{ color: medalColors[i] || '#9ca3af' }}>
              {i + 1}
            </span>
            <div className="w-8 h-8 avatar-rounded-square bg-white/10 overflow-hidden flex-shrink-0">
              {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-white">{p.username?.[0]?.toUpperCase()}</div>}
            </div>
            <Link to={`/player/${p.user_id}`} className="text-sm font-display hover:underline flex-1 truncate" style={{ color: ROLE_COLORS[p.role] || '#a7fcc9' }}>
              {ROLE_BADGES[p.role]} {p.username}
            </Link>
            <span className="text-sm font-display text-[#a7fcc9] whitespace-nowrap">{(p.tokens || 0).toLocaleString()} 🪙</span>
          </div>
        ))}
        {players.length === 0 && <p className="text-white/60 text-sm text-center py-4">No players yet</p>}
      </div>
    </div>
  );
}