import React from 'react';
import { RARITY_COLORS, RARITY_ORDER } from '@/lib/constants';

export default function BlookStatsCard({ blookScore, rarityCounts, totalBlooks, totalValue }) {
  const activeRarities = RARITY_ORDER.filter((r) => (rarityCounts[r] || 0) > 0);
  const formatValue = (v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v);

  return (
    <div className="bg-panel rounded-2xl border border-white/10 p-4">
      {/* Blook Score — hexagon badge */}
      <div className="text-center mb-4">
        <p className="text-xs text-white/50 mb-2 font-display">Blook Score</p>
        <div className="w-24 h-24 mx-auto relative">
          <div
            className="absolute inset-0 bg-gradient-to-br from-purple-500 to-blue-500"
            style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
          />
          <div
            className="absolute inset-[3px] bg-panel flex items-center justify-center"
            style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
          >
            <span className="font-display text-2xl text-white">{blookScore.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Rarity breakdown */}
      {activeRarities.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          {activeRarities.map((rarity) => (
            <div key={rarity} className="text-center">
              <div
                className="w-8 h-8 mx-auto rounded-full mb-1 border border-white/20"
                style={{ background: RARITY_COLORS[rarity] }}
              />
              <p className="text-xs text-white font-display">{rarityCounts[rarity]}</p>
            </div>
          ))}
        </div>
      )}

      {/* Bottom metrics */}
      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10">
        <div className="text-center">
          <p className="font-display text-lg text-[#a7fcc9]">{totalBlooks}</p>
          <p className="text-xs text-white/50">Blooks</p>
        </div>
        <div className="text-center">
          <p className="font-display text-lg text-[#ffcc00]">🪙 {formatValue(totalValue)}</p>
          <p className="text-xs text-white/50">Value</p>
        </div>
      </div>
    </div>
  );
}