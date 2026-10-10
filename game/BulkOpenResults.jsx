import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Package } from 'lucide-react';
import { RARITY_COLORS, RARITY_ORDER, PLACEHOLDER_BLOOK_IMG } from '@/lib/constants';

const RARITY_DARK_BG = {
  uncommon: '#166534',
  rare: '#1e3a8a',
  epic: '#37306b',
  legendary: '#78350f',
  chroma: '#164e63',
  supreme: '#7f1d1d',
  mythical: '#831843',
  iridescent: '#3b0764',
  unique: '#064e3b',
  icecreamacle: '#065f46',
  paradox: '#1e1b4b',
  elite: '#7f1d1d'
};

const RARITY_BULLET = {
  uncommon: '#22c55e',
  rare: '#60a5fa',
  epic: '#a855f7',
  legendary: '#f59e0b',
  chroma: '#00ccff',
  supreme: '#ef4444',
  mythical: '#f472b6',
  iridescent: '#a855f7',
  unique: '#00ff99',
  icecreamacle: '#34d399',
  paradox: '#a855f7',
  elite: '#ff0000'
};

export default function BulkOpenResults({ open, results, onClose, onRunAnother }) {
  const { rarityRows, notablePulls, totalCount } = useMemo(() => {
    if (!results) return { rarityRows: [], notablePulls: [], totalCount: 0 };
    const rarityCounts = {};
    const pullMap = {};
    results.pulls.forEach((b, i) => {
      const isShiny = !!results.shinyFlags?.[i];
      rarityCounts[b.rarity] = (rarityCounts[b.rarity] || 0) + 1;
      const key = b.id + (isShiny ? '-shiny' : '');
      if (!pullMap[key]) pullMap[key] = { blook: b, count: 0, isShiny };
      pullMap[key].count++;
    });
    const total = results.pulls.length;
    const rows = RARITY_ORDER
      .filter(r => rarityCounts[r])
      .map(r => ({ rarity: r, count: rarityCounts[r], percent: (rarityCounts[r] / total) * 100 }))
      .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
    const notable = Object.values(pullMap)
      .sort((a, b) => RARITY_ORDER.indexOf(b.blook.rarity) - RARITY_ORDER.indexOf(a.blook.rarity));
    return { rarityRows: rows, notablePulls: notable, totalCount: total };
  }, [results]);

  if (!results) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden" style={{ backgroundColor: '#1a1a24', border: '1px solid #2a2a3a' }}>
        {/* Header */}
        <div className="flex items-center gap-2 p-4 pr-12 border-b border-white/10">
          <Package size={20} className="text-[#a7fcc9]" />
          <DialogTitle className="text-white font-display text-lg">Bulk Simulate — {results.pack?.name}</DialogTitle>
        </div>

        {/* Sub-header */}
        <div className="px-4 pt-3 pb-2">
          <p className="text-xs text-white/50">Opens packs for real — costs tokens, adds blooks to your inventory, and posts to chat for rare pulls.</p>
        </div>

        {/* Status bar */}
        <div className="px-4 pb-3">
          <p className="text-sm text-white">
            Simulated <span className="text-[#22d3ee] font-display">{totalCount.toLocaleString()}</span> opens — <span className="text-[#22d3ee] font-display">{totalCount.toLocaleString()}</span> blooks saved
          </p>
        </div>

        {/* Rarity rows */}
        <div className="px-4 space-y-2">
          {rarityRows.map(row => (
            <div key={row.rarity} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: RARITY_DARK_BG[row.rarity] || '#2a2a3a' }}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: RARITY_BULLET[row.rarity] || '#fff' }} />
                <span className="text-sm text-white capitalize font-display">{row.rarity}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-white font-display">{row.count}</span>
                <span className="text-sm text-white/70 tabular-nums w-16 text-right">{row.percent.toFixed(2)}%</span>
              </div>
            </div>
          ))}
        </div>

        {/* Notable pulls */}
        {notablePulls.length > 0 && (
          <div className="px-4 pt-4 pb-2">
            <h4 className="text-sm text-white font-display mb-2">Notable Pulls Found</h4>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {notablePulls.map(p => (
                <div key={p.blook.id + (p.isShiny ? '-shiny' : '')} className="flex items-center gap-1.5 rounded-lg px-2 py-1" style={{ backgroundColor: '#0f172a', border: '1px solid #166534' }}>
                  {p.blook.image_url
                    ? <img src={p.blook.image_url} alt="" className={`w-5 h-5 object-contain rounded ${p.isShiny ? 'shiny-blook' : ''}`} />
                    : <img src={PLACEHOLDER_BLOOK_IMG} alt="" className="w-5 h-5 object-contain rounded" />}
                  <span className="text-xs font-display" style={{ color: RARITY_COLORS[p.blook.rarity] || '#fff' }}>{p.blook.name}</span>
                  {p.count > 1 && <span className="text-[10px] text-white/50">x{p.count}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer button */}
        <div className="p-4">
          <Button onClick={onRunAnother || onClose} className="w-full rounded-xl font-display h-11" style={{ backgroundColor: '#2a2a3a', color: '#fff', border: '1px solid #3a3a4a' }}>
            {onRunAnother ? 'Run Another Simulation' : 'Done'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}