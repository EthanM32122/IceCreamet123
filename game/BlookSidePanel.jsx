import React from 'react';
import { Button } from '@/components/ui/button';
import { RARITY_COLORS, SELL_PRICES, PLACEHOLDER_BLOOK_IMG } from '@/lib/constants';
import { Lock, Gavel } from 'lucide-react';
import { TokenIcon } from '@/components/game/CurrencyIcon';

// Side detail panel for the Blooks page — mirrors the reference layout:
// name, rarity, the blook on its pack background, quantity owned, and Sell/List actions.
export default function BlookSidePanel({ blook, pack, onSell, onList }) {
  if (!blook) {
    return (
      <div className="rounded-2xl border border-white/10 p-6 text-center" style={{ backgroundColor: 'rgba(160,160,160,0.18)' }}>
        <p className="text-white/50 text-sm font-display">Click a blook to see its details</p>
      </div>
    );
  }

  const owned = !blook.locked;
  const qty = blook.quantity || 0;
  const sellValue = blook.sell_price || SELL_PRICES[blook.rarity] || 5;
  const bg = pack?.background_url
    ? `url(${pack.background_url}) center/cover`
    : 'linear-gradient(135deg, #a7fcc9, #6b3a8e)';

  return (
    <div className="rounded-2xl overflow-hidden border border-white/10" style={{ backgroundColor: 'rgba(160,160,160,0.22)' }}>
      {/* Name + rarity */}
      <div className="px-4 pt-4 pb-2 text-center">
        <h3 className="text-xl font-display leading-tight text-white drop-shadow">{blook.isShiny && '✨ '}{blook.name}</h3>
        <p className={`text-sm font-display capitalize rarity-${blook.rarity}`}>{blook.rarity}</p>
      </div>

      {/* Blook on pack background */}
      <div className="aspect-square relative" style={{ background: bg, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        {blook.image_url ? (
          <img
            src={blook.image_url}
            alt={blook.name}
            className={`absolute inset-0 w-full h-full object-contain p-5 drop-shadow-2xl ${blook.isShiny ? 'shiny-blook' : ''}`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <img src={PLACEHOLDER_BLOOK_IMG} alt="" className="w-24 h-24 object-contain rounded-lg" />
          </div>
        )}
        {!owned && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/65">
            <Lock className="text-white/70" size={40} />
          </div>
        )}
      </div>

      {/* Owned count + actions */}
      <div className="p-4 text-white">
        <p className="text-center text-sm font-display mb-3">
          {owned ? `${qty} Owned` : 'Not owned yet'}
        </p>
        {owned && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={onSell}
              className="text-white border-0 font-display"
              style={{ backgroundColor: '#d97706' }}
            >
              <TokenIcon size={14} /> Sell
            </Button>
            <Button
              onClick={onList}
              variant="outline"
              className="border-0 text-white font-display hover:opacity-90"
              style={{ backgroundColor: '#333333' }}
            >
              <Gavel size={14} /> List
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}