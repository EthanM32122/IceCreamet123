import React from 'react';
import { Link } from 'react-router-dom';
import { ROLE_COLORS, PLACEHOLDER_BLOOK_IMG } from '@/lib/constants';

export default function LockerRightPane({ stats, ownedBlooks, friends, pendingRequests }) {
  const MIN_SLOTS = 24;
  const filledSlots = (ownedBlooks || []).slice(0, Math.max(MIN_SLOTS, ownedBlooks?.length || 0));
  const emptyCount = Math.max(0, MIN_SLOTS - filledSlots.length);

  return (
    <div className="flex-1 rounded-2xl p-4 min-w-0 bg-panel">
      {/* Stats row */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
        {stats.map(stat => {
          const Tag = stat.onClick ? 'button' : 'div';
          return (
            <Tag key={stat.label} type={stat.onClick ? 'button' : undefined} onClick={stat.onClick || undefined} className={`bg-black/25 rounded-xl p-2 text-center w-full ${stat.onClick ? 'hover:bg-black/40 transition-colors ring-2 ring-yellow-400/70 cursor-pointer animate-pulse' : ''}`}>
              <span className="text-xl inline-block">{stat.icon}</span>
              <p className="text-base font-display mt-0.5 text-white leading-tight">{stat.value}</p>
              <p className={`text-[9px] ${stat.shiny ? 'text-yellow-300' : 'text-white/70'}`}>{stat.label}</p>
            </Tag>
          );
        })}
      </div>

      {/* Collection inventory grid */}
      <div className="mb-4">
        <h3 className="text-white font-display text-sm mb-2">Collection</h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 max-h-80 overflow-y-auto pr-1">
          {filledSlots.map(b => (
            <div key={b.id} className="bg-black/20 rounded-lg aspect-square flex items-center justify-center hover:bg-black/30 transition-colors" title={b.name}>
              {b.image_url
                ? <img src={b.image_url} alt={b.name} className="w-full h-full object-contain p-1" />
                : <img src={PLACEHOLDER_BLOOK_IMG} alt="" className="w-full h-full object-contain p-2 rounded-lg" />}
            </div>
          ))}
          {Array.from({ length: emptyCount }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-black/10 rounded-lg aspect-square" />
          ))}
        </div>
      </div>

      {/* Friends */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-display text-sm">Friends</h3>
          <Link to="/trade" className="text-xs text-white/80 hover:underline flex items-center gap-1">
            Requests
            {pendingRequests > 0 && <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 leading-4">{pendingRequests}</span>}
          </Link>
        </div>
        {friends.length === 0 ? (
          <p className="text-white/60 text-sm text-center py-4">No friends yet — find players to add!</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {friends.slice(0, 12).map(f => (
              <Link key={f.id} to={`/player/${f.user_id}`} className="bg-black/25 rounded-lg p-1.5 text-center hover:bg-black/40 transition-colors">
                <div className="w-8 h-8 avatar-rounded-square bg-white/10 overflow-hidden mx-auto mb-1">
                  {f.avatar_url ? <img src={f.avatar_url} alt="" className="w-full h-full object-contain" /> : <div className="w-full h-full flex items-center justify-center text-xs text-white">{f.username?.[0]?.toUpperCase()}</div>}
                </div>
                <p className="text-[10px] text-white truncate">{f.username}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}