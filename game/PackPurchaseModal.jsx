import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Package } from 'lucide-react';
import { DiamondIcon, TokenIcon } from '@/components/game/CurrencyIcon';

// Soft ceiling only to avoid JS number issues; real limit is balance
const HARD_CEILING = 100000000;

export default function PackPurchaseModal({ pack, open, onClose, onShowRates, onBuy, tokenBalance, diamondBalance, diamondMode, plusActive }) {
  const [qty, setQty] = useState(1);
  useEffect(() => { if (open) setQty(1); }, [open, pack?.id]);
  if (!pack) return null;

  const unitCost = diamondMode ? 15 : Math.round(Number(pack.cost) * (plusActive ? 0.9 : 1));
  const balance = Math.floor(Number(diamondMode ? (diamondBalance || 0) : (tokenBalance || 0)));
  const maxAffordable = unitCost > 0
    ? Math.min(HARD_CEILING, Math.max(0, Math.floor(balance / unitCost)))
    : 0;
  const safeQty = Math.max(1, Math.min(HARD_CEILING, Math.floor(Number(qty) || 1)));
  const buyQty = Math.min(safeQty, maxAffordable);
  const totalCost = unitCost * buyQty;
  const canAfford = maxAffordable >= 1 && buyQty >= 1 && balance >= totalCost;
  const fontStyle = pack.font_family ? { fontFamily: pack.font_family } : undefined;

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
              <span className="text-white font-display">{unitCost.toLocaleString()}</span>
              <span className="text-[10px] text-white/50">each</span>
              {diamondMode
                ? <span className="text-[10px] text-cyan-400">2x luck</span>
                : (plusActive && <span className="text-[10px] text-[#a7fcc9]">10% Plus off</span>)}
            </div>
            <div>
              <label className="text-xs text-white/70 block mb-1">Quantity (any amount you can afford)</label>
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  type="number"
                  min={1}
                  max={Math.max(1, maxAffordable)}
                  value={qty}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (Number.isNaN(n)) { setQty(''); return; }
                    setQty(Math.max(1, Math.min(HARD_CEILING, n)));
                  }}
                  className="flex-1 min-w-[7rem] bg-white/10 border-white/20 text-white"
                />
                <Button type="button" variant="outline" onClick={() => setQty(10)} className="border-white/20 text-white text-xs">x10</Button>
                <Button type="button" variant="outline" onClick={() => setQty(100)} className="border-white/20 text-white text-xs">x100</Button>
                <Button type="button" variant="outline" onClick={() => setQty(1000)} className="border-white/20 text-white text-xs">x1K</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setQty(Math.max(1, maxAffordable))}
                  disabled={maxAffordable < 1}
                  className="border-[#a7fcc9]/50 text-[#a7fcc9] text-xs"
                >
                  Max
                </Button>
              </div>
              <p className="text-[10px] text-white/40 mt-1">
                Can afford: <span className="text-white/70">{maxAffordable.toLocaleString()}</span>
                {' · '}Balance: {balance.toLocaleString()}
              </p>
            </div>
            <Button
              onClick={() => { if (canAfford) onBuy(buyQty); }}
              disabled={!canAfford}
              className="w-full"
              style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}
            >
              Buy {buyQty.toLocaleString()} for{' '}
              {diamondMode ? <DiamondIcon size={16} /> : <TokenIcon size={16} />}{' '}
              {totalCost.toLocaleString()}
            </Button>
            {!canAfford && <p className="text-[10px] text-red-400 text-center">Not enough {diamondMode ? 'diamonds' : 'tokens'}</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
