import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Package } from 'lucide-react';
import { DiamondIcon, TokenIcon } from '@/components/game/CurrencyIcon';

// Real limit is token/diamond balance. Ceiling is just JS-safe max (~1000 trillion).
const HARD_CEILING = 1e15;

export default function PackPurchaseModal({ open, onClose, pack, tokenBalance, diamondBalance, diamondMode, plusActive, onBuy }) {
  const [qty, setQty] = useState(1);
  useEffect(() => { if (open) setQty(1); }, [open, pack?.id]);
  if (!pack) return null;

  const unitCost = diamondMode
    ? 1
    : Math.round(Number(pack.cost) * (plusActive ? 0.9 : 1));
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
        <DialogTitle className="sr-only">Buy packs</DialogTitle>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden">
              {pack.image_url
                ? <img src={pack.image_url} alt="" className="w-full h-full object-contain" />
                : <Package className="w-7 h-7 text-white/50" />}
            </div>
            <div>
              <p className="font-display text-white text-lg" style={fontStyle}>{pack.name}</p>
              <p className="text-xs text-white/50">Open any amount you can afford — no lag</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="text-sm text-white/70 flex items-center gap-2 flex-wrap">
              <span>Cost each:</span>
              {diamondMode ? <DiamondIcon size={16} /> : <TokenIcon size={16} />}
              <span className="text-white font-display">{unitCost.toLocaleString()}</span>
              {plusActive && !diamondMode && (<span className="text-[10px] text-[#a7fcc9]">10% Plus off</span>)}
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
                <Button type="button" variant="outline" onClick={() => setQty(1000000)} className="border-white/20 text-white text-xs">x1M</Button>
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
