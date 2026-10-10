import React from 'react';
import { Shield } from 'lucide-react';

export default function ClanCard({ clan, members, players, onClick, isShielded }) {
  const memberCount = members.length;
  const online = members.filter(m => {
    const p = players.find(pp => pp.user_id === m.user_id);
    return p?.last_seen && Date.now() - p.last_seen < 120000;
  }).length;
  const offline = memberCount - online;
  const rainbow = (clan.color || '').toLowerCase() === 'rainbow';

  return (
    <button onClick={onClick} className="bg-panel rounded-xl border border-white/10 overflow-hidden text-left hover:scale-[1.02] hover:border-[#a7fcc9]/40 transition-all flex flex-col">
      {/* Banner */}
      <div className="relative h-24 bg-gradient-to-br from-black/40 to-panel flex items-center justify-center overflow-hidden">
        {clan.image_url ? (
          <img src={clan.image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-4xl opacity-80">{clan.icon || '🛡️'}</span>
        )}
        {isShielded && (
          <span className="absolute top-2 left-2 bg-blue-500/80 text-white rounded-full p-1" title="Shielded">
            <Shield size={12} />
          </span>
        )}
        <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-display px-2 py-0.5 rounded">{memberCount} Members</span>
      </div>
      {/* Info */}
      <div className="p-3 flex-1 flex flex-col">
        <h4 className={`font-display text-base truncate ${rainbow ? 'rainbow-name' : ''}`} style={rainbow ? {} : { color: clan.color || '#a7fcc9' }}>{clan.name}</h4>
        <p className="text-xs text-white/50">Level {clan.level || 1}</p>
        {clan.description ? (
          <p className="text-xs text-white/60 mt-1 line-clamp-2 flex-1">{clan.description}</p>
        ) : (
          <p className="text-xs text-white/30 mt-1 flex-1 italic">No description</p>
        )}
        <div className="flex items-center justify-between mt-2 text-[10px] text-white/50">
          <span className="truncate max-w-[60%]">👑 {clan.leader_username}</span>
          <span className="flex items-center gap-2 flex-shrink-0">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />{online}</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-500" />{offline}</span>
          </span>
        </div>
      </div>
    </button>
  );
}