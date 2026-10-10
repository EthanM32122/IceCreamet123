import React from 'react';
import { Button } from '@/components/ui/button';
import { Check, Gift } from 'lucide-react';
import PlusBadge from '@/components/game/PlusBadge';

export default function StoreCard({ color, title, price, priceUnit = '🪙', description, perks, bonus, buttonLabel, onBuy, disabled, disclaimer, plusBadge, onShowRates, ratesLabel }) {
  return (
    <div className="bg-sidebar-accent rounded-xl overflow-hidden shadow-xl flex flex-col h-full border border-sidebar-border">
      <div className="px-5 py-3" style={{ backgroundColor: color }}>
        <h3 className="text-white font-display text-lg flex items-center gap-2 leading-tight">
          {plusBadge && <PlusBadge size={18} />}
          {title}
        </h3>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <p className="text-3xl font-display text-white mb-3 leading-none">{price} <span className="text-xl">{priceUnit}</span></p>
        {description && <p className="text-sm text-white/70 mb-3 leading-snug">{description}</p>}
        {perks && (
          <ul className="text-xs text-white/80 space-y-1.5 mb-3">
            {perks.map(f => (
              <li key={f} className="flex items-start gap-1.5"><Check size={12} className="text-green-400 flex-shrink-0 mt-0.5" /> {f}</li>
            ))}
          </ul>
        )}
        {bonus && (
          <div className="inline-flex items-center gap-1.5 bg-yellow-500/20 text-yellow-300 text-xs font-display px-2.5 py-1 rounded-full w-fit mb-4">
            <Gift size={12} /> {bonus}
          </div>
        )}
        <div className="mt-auto">
          <Button onClick={onBuy} disabled={disabled} className="w-full text-white border-0 hover:opacity-90" style={{ backgroundColor: color }}>
            {buttonLabel}
          </Button>
          {onShowRates && (
            <button onClick={onShowRates} className="w-full text-xs text-white/70 hover:text-white underline mt-2">{ratesLabel || 'View Rates'}</button>
          )}
          <p className="text-[10px] text-white/40 mt-2 leading-tight">{disclaimer}</p>
        </div>
      </div>
    </div>
  );
}