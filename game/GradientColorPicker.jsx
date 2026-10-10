import React, { useState } from 'react';
import { GRADIENT_PRESETS, formatGradient } from '@/lib/colorStyle';

// Gradient picker for users with 10M+ tokens.
// Stores as 'gradient:#hex1,#hex2' in name_color / chat_color.
export default function GradientColorPicker({ value, onChange }) {
  const [c1, setC1] = useState('#ff6b6b');
  const [c2, setC2] = useState('#feca57');

  const isCurrentGradient = (g) => value === formatGradient(g[0], g[1]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {GRADIENT_PRESETS.map((g) => (
          <button
            key={g.join(',')}
            type="button"
            onClick={() => onChange(formatGradient(g[0], g[1]))}
            className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${isCurrentGradient(g) ? 'ring-2 ring-offset-1 ring-[#a7fcc9] border-white' : 'border-transparent'}`}
            style={{ background: `linear-gradient(90deg, ${g[0]}, ${g[1]})` }}
            title={`${g[0]} → ${g[1]}`}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-white/60">
          <input type="color" value={c1} onChange={e => setC1(e.target.value)} className="w-7 h-7 rounded cursor-pointer bg-transparent border-0" />
        </label>
        <span className="text-white/40 text-xs">→</span>
        <label className="flex items-center gap-1.5 text-xs text-white/60">
          <input type="color" value={c2} onChange={e => setC2(e.target.value)} className="w-7 h-7 rounded cursor-pointer bg-transparent border-0" />
        </label>
        <button
          type="button"
          onClick={() => onChange(formatGradient(c1, c2))}
          className="ml-1 px-3 py-1 rounded-lg text-xs font-display text-white"
          style={{ background: `linear-gradient(90deg, ${c1}, ${c2})` }}
        >
          Apply
        </button>
      </div>
      {value && value.startsWith('gradient:') && (
        <button type="button" onClick={() => onChange('')} className="text-xs text-muted-foreground underline">Reset gradient</button>
      )}
    </div>
  );
}