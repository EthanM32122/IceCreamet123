import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Package } from 'lucide-react';
import { DiamondIcon, TokenIcon } from '@/components/game/CurrencyIcon';

export default function PackPurchaseModal({ pack, open, onClose, onShowRates, onBuy, tokenBalance, diamondBalance, diamondMode, plusActive }) {
  const [qty, setQty] = useState(1);
  useEffect(() => { if (open) setQty(1); }, [open, pack?.id]);
  if (!pack) return null;

  const unitCost = diamondMode ? 15 : Math.round(pack.cost * (plusActive ? 0.9 : 1));
  const balance = diamondMode ? (diamondBalance || 0) : (tokenBalance || 0);
  // Max packs you can buy with current balance (no artificial limit)
  const maxAffordable = unitCost > 0 ? Math.max(0, Math.floor(balance / unitCost)) : 0;
  const safeQty = Math.max(1, Math.floor(Number(qty) || 1));
  const total = unitCost * safeQty;
  const canAfford = balance >= total && safeQty >= 1 && maxAffordable >= 1;
  const fontStyle = pack.font_family ? { fontFamily: pack.font_family } : undefined;

  const setMax = () => {
    setQty(Math.max(1, maxAffordable));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-panel border-white/10">
        <DialogTitle className="sr-only">{pack.name}</DialogTitle>
        <div className="flex flex-col sm:flex-row">
          <div
            className="sm:w-1/2 aspect-square flex items-center justify-center relative"
            style={{
              background: pack.background_url
                ? `url(${pack.background_url}) center/cover`
                : 'linear-gradient(135deg, #a7fcc9, rgb(var(--user-sidebar)))'
            }}
          >
            {pack.image_url ? (
              <img src={pack.image_url} alt={pack.name} className="h-3/4 w-3/4 object-contain drop-shadow-lg" />
            ) : (
              <Package size={80} className="text-white/80" />
            )}
          </div>
          <div className="sm:w-1/2 p-5 flex flex-col gap-3">
            <h2 className="text-2xl font-display text-white leading-tight" style={fontStyle}>{pack.name}</h2>
            <button
              type="button"
              onClick={onShowRates}
              className="self-start text-xs px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors"
            >
              Show Drop Rates
            </button>
            <div className="flex items-center gap-2">
              <span className={`flex items-center text-lg ${diamondMode ? 'text-cyan-400' : 'text-yellow-400'}`}>{diamondMode ? <DiamondIcon size={18} /> : <TokenIcon size={18} />}</span>
              <span className="text-white font-display">{diamondMode ? 15 : pack.cost}</span>
              {diamondMode
                ? <span className="text-[10px] text-cyan-400">2x luck</span>
                : (plusActive && <span className="text-[10px] text-[#a7fcc9]">10% Plus off</span>)}
            </div>
            <div>
              <label className="text-xs text-white/70 block mb-1">Purchase quantity (any amount)</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={Math.max(1, maxAffordable)}
                  value={qty}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (Number.isNaN(n)) { setQty(''); return; }
                    setQty(Math.max(1, n));
                  }}
                  className="flex-1 bg-white/10 border-white/20 text-white"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={setMax}
                  disabled={maxAffordable < 1}
                  className="border-[#a7fcc9]/50 text-[#a7fcc9] hover:bg-[#a7fcc9]/10 font-display shrink-0"
                >
                  Max
                </Button>
              </div>
              <p className="text-[10px] text-white/40 mt-1">
                Max you can buy: <span className="text-white/70">{maxAffordable.toLocaleString()}</span>
                {' · '}Balance: {(balance || 0).toLocaleString()}
              </p>
            </div>
            <Button
              onClick={() => onBuy(Math.min(safeQty, Math.max(1, maxAffordable)))}
              disabled={!canAfford}
              className="w-full"
              style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}
            >
              Buy {Math.min(safeQty, Math.max(1, maxAffordable)).toLocaleString()} for{' '}
              {diamondMode ? <DiamondIcon size={16} /> : <TokenIcon size={16} />}{' '}
              {(unitCost * Math.min(safeQty, Math.max(1, maxAffordable))).toLocaleString()}
            </Button>
            {!canAfford && <p className="text-[10px] text-red-400 text-center">Not enough {diamondMode ? 'diamonds' : 'tokens'}</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
