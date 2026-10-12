import React from 'react';
import { Package, Info } from 'lucide-react';
import { DiamondIcon, TokenIcon } from '@/components/game/CurrencyIcon';

export default function PackCard({ pack, onClick, onShowRates, onBulk, bulkCount, diamondMode }) {
  const fontStyle = pack.font_family ? { fontFamily: pack.font_family } : undefined;
  const bulkLabel = bulkCount === -1 ? 'Max' : `x${bulkCount || 10}`;
  return (
    <div
      onClick={onClick}
      className="group rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1 cursor-pointer relative bg-panel"
    >
      <div
        className="aspect-square flex items-center justify-center relative overflow-hidden"
        style={{
          background: pack.background_url
            ? `url(${pack.background_url}) center/cover`
            : 'linear-gradient(135deg, #a7fcc9, rgb(var(--user-sidebar)))'
        }}
      >
        {pack.image_url ? (
          <img src={pack.image_url} alt={pack.name} className="h-3/4 object-contain drop-shadow-lg group-hover:scale-110 transition-transform" />
        ) : (
          <Package size={56} className="text-white/80 group-hover:scale-110 transition-transform" />
        )}
        {onShowRates && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onShowRates(); }}
            className="absolute top-2 right-2 bg-white/80 hover:bg-white rounded-full p-1.5 shadow opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Info size={14} className="text-panel" />
          </button>
        )}
      </div>
      <div className="px-3 py-2 flex items-center justify-between gap-1">
        <span className="text-white text-xs font-display truncate" style={fontStyle}>{pack.name}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={`flex items-center ${diamondMode ? 'text-cyan-400' : 'text-yellow-400'}`}>{diamondMode ? <DiamondIcon size={14} /> : <TokenIcon size={14} />}</span>
          <span className="text-white text-xs font-display">{diamondMode ? '15' : pack.cost}</span>
        </div>
      </div>
      {onBulk && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onBulk(pack); }}
          className="w-full text-[10px] py-1 bg-black/30 text-[#a7fcc9] hover:bg-black/50 transition-colors"
        >
          {diamondMode ? <><DiamondIcon size={12} /> {bulkLabel}</> : <>Open {bulkLabel}</>}
        </button>
      )}
    </div>
  );
}
