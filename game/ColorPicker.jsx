import React from 'react';

const PRESETS = ['#a7fcc9', '#60a5fa', '#f59e0b', '#f472b6', '#a855f7', '#ef4444', '#4ade80', '#00ccff', '#feca57', '#ffffff', '#34d399', '#fb7185'];

export default function ColorPicker({ value, onChange, presets, allowRainbow = true }) {
  const colors = presets || PRESETS;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {allowRainbow && (
      <button
        key="rainbow"
        type="button"
        onClick={() => onChange('rainbow')}
        className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center text-xs ${value === 'rainbow' ? 'ring-2 ring-offset-1 ring-panel border-white' : 'border-transparent'}`}
        style={{ background: 'linear-gradient(90deg,#ff6b6b,#feca57,#48dbfb,#ff9ff3,#54a0ff,#5ee7c0)' }}
        title="Rainbow"
      >🌈</button>
      )}
      {colors.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${value === c ? 'ring-2 ring-offset-1 ring-panel border-white' : 'border-transparent'}`}
          style={{ backgroundColor: c }}
        />
      ))}
      <label className="relative w-7 h-7 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center cursor-pointer overflow-hidden">
        <span className="text-xs">🎨</span>
        <input type="color" value={value && value !== 'rainbow' ? value : '#a7fcc9'} onChange={e => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
      </label>
      {value && (
        <button type="button" onClick={() => onChange('')} className="text-xs text-muted-foreground underline ml-1">Reset</button>
      )}
    </div>
  );
}