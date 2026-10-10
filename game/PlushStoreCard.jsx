import React from 'react';
import { Button } from '@/components/ui/button';

export default function PlushStoreCard({ color, title, image, price, priceUnit = '🪙', description, buttonLabel, onBuy, disabled, disclaimer }) {
  return (
    <div className="bg-sidebar-accent rounded-xl overflow-hidden shadow-xl flex flex-col h-full border border-sidebar-border">
      <div className="px-5 py-3" style={{ backgroundColor: color }}>
        <h3 className="text-white font-display text-lg leading-tight">{title}</h3>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <div className="w-full aspect-square flex items-center justify-center bg-black/25 rounded-lg mb-3">
          {image ? <img src={image} alt={title} className="w-full h-full object-contain p-2" /> : <span className="text-6xl">🧸</span>}
        </div>
        <p className="text-3xl font-display text-white mb-2 leading-none">{price} <span className="text-xl">{priceUnit}</span></p>
        {description && <p className="text-sm text-white/70 mb-3 leading-snug">{description}</p>}
        <div className="mt-auto">
          <Button onClick={onBuy} disabled={disabled} className="w-full text-white border-0 hover:opacity-90" style={{ backgroundColor: color }}>
            {buttonLabel}
          </Button>
          <p className="text-[10px] text-white/40 mt-2 leading-tight">{disclaimer}</p>
        </div>
      </div>
    </div>
  );
}