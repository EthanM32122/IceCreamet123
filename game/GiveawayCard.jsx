import React from 'react';
import { Button } from '@/components/ui/button';
import { Crown, Users } from 'lucide-react';
import { ERROR_BLOOK_IMG } from '@/lib/constants';

const PATTERN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30'%3E%3Crect width='30' height='30' fill='%233a3a3a'/%3E%3Crect x='3' y='3' width='24' height='24' rx='6' fill='%23424242' transform='rotate(45 15 15)'/%3E%3C/svg%3E\")";

export default function GiveawayCard({ giveaway, onView }) {
  const entries = (() => { try { return JSON.parse(giveaway.entries || '[]'); } catch { return []; } })();
  const isToken = giveaway.prize_type === 'tokens';
  return (
    <div className="bg-panel rounded-2xl border border-white/10 overflow-hidden flex flex-col">
      <div className="relative h-32 flex items-center justify-center" style={{ backgroundColor: '#3a3a3a', backgroundImage: PATTERN }}>
        {isToken ? (
          <span className="text-5xl">🪙</span>
        ) : (
          giveaway.blook_image_url
            ? <img src={giveaway.blook_image_url} alt={giveaway.blook_name} className="h-24 w-24 object-contain drop-shadow-lg" />
            : <img src={ERROR_BLOOK_IMG} alt="" className="h-24 w-24 object-contain rounded-lg" />
        )}
        <span className="absolute top-2 right-2 text-[10px] font-display px-2 py-0.5 rounded-full bg-black/50 text-white">{entries.length} entered</span>
      </div>
      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-display text-white text-sm truncate">{giveaway.title}</h3>
        <div className="flex items-center gap-1 text-[11px] text-white/60 mt-0.5">
          <Crown size={11} className="text-yellow-400" />
          <span className="truncate">{giveaway.creator_username}</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-white/60 mt-0.5">
          <Users size={11} />
          <span>x{giveaway.num_winners} winner{giveaway.num_winners !== 1 ? 's' : ''}</span>
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-white/10">{giveaway.giveaway_type === 'elimination_wheel' ? 'Wheel' : 'Random'}</span>
        </div>
        {giveaway.description && <p className="text-[11px] text-white/50 mt-1 line-clamp-2">{giveaway.description}</p>}
        <Button size="sm" variant="outline" className="w-full mt-3 border-white/20 text-white hover:bg-white/10" onClick={() => onView(giveaway)}>View Details</Button>
      </div>
    </div>
  );
}