import React from 'react';
import { RARITY_DROP_RATES, RARITY_ORDER } from '@/lib/constants';
import { SHINY_CHANCE, isShinyExcluded } from '@/lib/shiny';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function PackRatesDialog({ pack, blooks, onClose }) {
  if (!pack) return null;
  const byRarity = {};
  (blooks || []).forEach(b => {
    if (!byRarity[b.rarity]) byRarity[b.rarity] = [];
    byRarity[b.rarity].push(b);
  });
  const rarities = RARITY_ORDER.filter(r => byRarity[r] && byRarity[r].length > 0);
  const total = rarities.reduce((s, r) => s + (RARITY_DROP_RATES[r] || 0), 0);
  const packExcluded = ['summer', 'golden'].some(kw => (pack.name || '').toLowerCase().includes(kw));

  return (
    <Dialog open={!!pack} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-panel" style={pack.font_family ? { fontFamily: pack.font_family } : undefined}>{pack.name} — Drop Rates</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {!packExcluded && (
            <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg p-2 mb-2 flex items-center gap-2">
              <span className="text-lg">✨</span>
              <div>
                <p className="text-xs font-display text-yellow-500">Shiny Blooks</p>
                <p className="text-[10px] text-muted-foreground">Every pull has a {(SHINY_CHANCE * 100).toFixed(0)}% chance to be Shiny — same blook but 10× sell value with a special glow. Locked/prize blooks are excluded.</p>
              </div>
            </div>
          )}
          {rarities.map(r => {
            const rate = RARITY_DROP_RATES[r] || 0;
            const pct = total > 0 ? (rate / total * 100) : 0;
            return (
              <div key={r}>
                <div className="flex items-center justify-between border-b pb-1 mb-2">
                  <div>
                    <p className={`font-display text-sm capitalize rarity-${r}`}>{r}</p>
                    <p className="text-[10px] text-muted-foreground">{byRarity[r].length} blook{byRarity[r].length !== 1 ? 's' : ''} · {pct.toFixed(pct < 1 ? 4 : 2)}% total</p>
                  </div>
                </div>
                <div className="space-y-1">
                  {byRarity[r].map(b => {
                    const canShiny = !packExcluded && !isShinyExcluded(pack, b);
                    const shinyPct = canShiny ? ((b.drop_chance || 0) * SHINY_CHANCE) : 0;
                    return (
                      <div key={b.id} className="flex items-center gap-2 pl-2">
                        {b.image_url && <img src={b.image_url} alt={b.name} className={`w-6 h-6 object-contain ${canShiny ? 'shiny-blook' : ''}`} />}
                        <span className="text-sm text-foreground flex-1 truncate">{b.name}</span>
                        <span className="text-xs text-muted-foreground">{b.drop_chance || 0}%</span>
                        {canShiny && <span className="text-[10px] text-yellow-500" title="Shiny chance">✨{shinyPct.toFixed(shinyPct < 0.01 ? 4 : 2)}%</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {rarities.length === 0 && <p className="text-muted-foreground text-center py-4">No blooks in this pack.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}