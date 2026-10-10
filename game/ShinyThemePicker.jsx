import React, { useState } from 'react';
import { useGame } from '@/lib/gameContext';
import { SHINY_THEMES } from '@/lib/shiny';
import { Check } from 'lucide-react';

// Preview blook used in each swatch so the theme's glow is visible.
const PREVIEW_BLOOK = 'https://f005.backblazeb2.com/file/blacket-v2-cdn/uploads/9670385/xhek9klzrq/1787528578878-blook.gif';

export default function ShinyThemePicker() {
  const { profile, updateProfile } = useGame();
  const [saving, setSaving] = useState(false);
  const currentId = profile?.shiny_theme || 'gold';

  const apply = async (t) => {
    if (t.id === currentId) return;
    setSaving(true);
    await updateProfile({ shiny_theme: t.id });
    setSaving(false);
  };

  return (
    <div>
      <p className="text-xs text-white/50 mb-2">Shiny Glow Theme — pick how your shiny blooks shine.</p>
      <div className="grid grid-cols-5 gap-2 max-h-72 overflow-y-auto pr-1">
        {SHINY_THEMES.map(t => {
          const active = currentId === t.id;
          return (
            <button
              key={t.id}
              onClick={() => apply(t)}
              className={`relative rounded-xl h-16 border-2 overflow-hidden flex items-center justify-center bg-black/30 transition-transform hover:scale-105 ${active ? 'border-yellow-400 ring-2 ring-yellow-400/40' : 'border-white/20'}`}
            >
              <div className={t.class}>
                <img src={PREVIEW_BLOOK} alt={t.name} className="w-9 h-9 object-contain shiny-blook" />
              </div>
              <span className="absolute bottom-0 left-0 right-0 text-[9px] text-white font-display text-center py-0.5 bg-black/60">{t.name}</span>
              {active && <Check size={12} className="absolute top-1 right-1 text-yellow-300" />}
            </button>
          );
        })}
      </div>
      {saving && <p className="text-xs text-white/50 mt-2">Saving...</p>}
    </div>
  );
}