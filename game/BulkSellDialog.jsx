import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RARITY_COLORS } from '@/lib/constants';
import { shinyDiamondValue } from '@/lib/shiny';
import { Coins, Gem } from 'lucide-react';
import { DiamondIcon, TokenIcon } from '@/components/game/CurrencyIcon';

export default function BulkSellDialog({ open, onOpenChange, ownedBlooks, onSold }) {
  const [amounts, setAmounts] = useState({});
  const [busy, setBusy] = useState(false);

  // Build a flat list with separate entries for normal and shiny stacks.
  const items = useMemo(() => {
    const list = [];
    ownedBlooks.forEach(b => {
      if ((b.quantity || 0) > 0) list.push({ ...b, key: b.pbId, isShiny: false, sell_price: b.sell_price, currency: 'tokens', max: b.quantity, label: b.name });
      if ((b.shiny_quantity || 0) > 0) list.push({ ...b, key: b.pbId + '-shiny', isShiny: true, sell_price: shinyDiamondValue(b), currency: 'diamonds', max: b.shiny_quantity, label: b.name + ' ✨' });
    });
    return list;
  }, [ownedBlooks]);

  useEffect(() => {
    if (open) {
      const init = {};
      items.forEach(it => { init[it.key] = 0; });
      setAmounts(init);
    }
  }, [open, items]);

  const tokenTotal = useMemo(() =>
    items.filter(it => it.currency === 'tokens').reduce((s, it) => s + (amounts[it.key] || 0) * it.sell_price, 0),
    [amounts, items]
  );
  const diamondTotal = useMemo(() =>
    Math.round(items.filter(it => it.currency === 'diamonds').reduce((s, it) => s + (amounts[it.key] || 0) * it.sell_price, 0) * 100) / 100,
    [amounts, items]
  );
  const selectedCount = useMemo(() =>
    items.filter(it => (amounts[it.key] || 0) > 0).length,
    [amounts, items]
  );

  const setAmount = (key, val, max) => {
    const v = Math.max(0, Math.min(max, parseInt(val) || 0));
    setAmounts(prev => ({ ...prev, [key]: v }));
  };

  const setAll = (valFn) => {
    const next = {};
    items.forEach(it => { next[it.key] = Math.max(0, Math.min(it.max, valFn(it))); });
    setAmounts(next);
  };

  const confirm = async () => {
    if (busy || (tokenTotal <= 0 && diamondTotal <= 0)) return;
    setBusy(true);
    // Group updates by pbId so normal and shiny changes land in one call.
    const updates = {}; // pbId -> { quantity, shiny_quantity }
    const deletes = [];
    items.forEach(it => {
      const amt = amounts[it.key] || 0;
      if (amt <= 0) return;
      const pbId = it.pbId;
      if (!updates[pbId]) updates[pbId] = { id: pbId, quantity: it.quantity || 0, shiny_quantity: it.shiny_quantity || 0 };
      if (it.isShiny) updates[pbId].shiny_quantity = Math.max(0, (it.shiny_quantity || 0) - amt);
      else updates[pbId].quantity = Math.max(0, (it.quantity || 0) - amt);
    });
    const toUpdate = [];
    Object.values(updates).forEach(u => {
      if (u.quantity <= 0 && u.shiny_quantity <= 0) deletes.push(u.id);
      else toUpdate.push(u);
    });
    if (toUpdate.length > 0) await base44.entities.PlayerBlook.bulkUpdate(toUpdate);
    for (const id of deletes) { await base44.entities.PlayerBlook.delete(id); }
    await onSold({ tokens: tokenTotal, diamonds: diamondTotal });
    setBusy(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins size={18} className="text-panel" /> Bulk Sell Blooks
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">Normal blooks sell for <TokenIcon size={12} /> tokens · Shiny blooks sell for <DiamondIcon size={12} /> diamonds</p>

        <div className="flex gap-2 mb-3 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setAll(it => it.max)}>Select All</Button>
          <Button size="sm" variant="outline" onClick={() => setAll(it => it.isShiny ? 0 : Math.max(0, it.max - 1))}>Duplicates Only</Button>
          <Button size="sm" variant="outline" onClick={() => setAll(() => 0)}>Clear</Button>
        </div>

        <div className="max-h-72 overflow-y-auto space-y-1.5">
          {items.map(it => (
            <div key={it.key} className={`flex items-center gap-2 rounded-lg p-2 ${it.isShiny ? 'bg-yellow-400/10 border border-yellow-400/30' : 'bg-muted'}`}>
              {it.image_url
                ? <img src={it.image_url} alt="" className={`w-9 h-9 object-contain ${it.isShiny ? 'shiny-blook' : ''}`} />
                : <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/0d5e6b887_image.png" alt="" className="w-9 h-9 object-contain" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate font-display" style={{ color: RARITY_COLORS[it.rarity] }}>{it.label}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">{it.currency === 'diamonds' ? <DiamondIcon size={12} /> : <TokenIcon size={12} />}{it.sell_price} · Own x{it.max}</p>
              </div>
              <Input
                type="number"
                value={amounts[it.key] || 0}
                onChange={e => setAmount(it.key, e.target.value, it.max)}
                className="w-20 text-center"
              />
            </div>
          ))}
          {items.length === 0 && <p className="text-center text-muted-foreground py-6">No blooks to sell</p>}
        </div>

        <div className="flex items-center justify-between pt-3 border-t">
          <span className="text-sm text-muted-foreground">
            {selectedCount} selected ·{' '}
            {tokenTotal > 0 && <span className="text-panel font-display flex items-center gap-1"><TokenIcon size={14} /> {tokenTotal.toLocaleString()} </span>}
            {diamondTotal > 0 && <span className="text-cyan-400 font-display flex items-center gap-1"><DiamondIcon size={14} /> {diamondTotal.toLocaleString()}</span>}
            {tokenTotal <= 0 && diamondTotal <= 0 && <span className="text-muted-foreground">nothing selected</span>}
          </span>
          <Button onClick={confirm} disabled={busy || (tokenTotal <= 0 && diamondTotal <= 0)} style={{ backgroundColor: '#f1c40f', color: '#000' }}>
            {busy ? 'Selling...' : 'Sell Selected'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}