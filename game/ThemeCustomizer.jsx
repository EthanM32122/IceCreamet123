import React, { useState } from 'react';
import { useGame } from '@/lib/gameContext';
import { THEMES, DEFAULT_THEME_ID } from '@/lib/themes';
import { Check } from 'lucide-react';

export default function ThemeCustomizer() {
  const { profile, updateProfile } = useGame();
  const [saving, setSaving] = useState(false);
  const currentId = profile?.theme_bg || '';

  // phantom_grip's theme is permanently locked to the exclusive Cheeseburger theme
  if (profile?.username?.toLowerCase() === 'phantom_grip') {
    const lockedTheme = THEMES.find(t => t.id === 'cheeseburger');
    return (
      <div>
        <p className="text-xs text-muted-foreground mb-3">🍔 Your theme is permanently locked to the exclusive Cheeseburger theme.</p>
        <div className="grid grid-cols-3 gap-2">
          <div className="relative rounded-xl h-16 border-2 border-panel ring-2 ring-panel/30 overflow-hidden" style={{ background: lockedTheme.bg }}>
            <span className="absolute bottom-0 left-0 right-0 text-[10px] text-white font-display text-center py-0.5" style={{ backgroundColor: lockedTheme.sidebar }}>Cheeseburger</span>
            <Check size={14} className="absolute top-1 right-1 text-white" />
          </div>
        </div>
      </div>
    );
  }

  const unlocked = (profile?.unlocked_themes || '').split(',').filter(Boolean);
  const isUnlocked = (t) => !t.premium || unlocked.includes(t.id);

  const apply = async (t) => {
    if (t.premium && !isUnlocked(t)) {
      if ((profile?.tokens || 0) < (t.cost || 0)) { alert(`Not enough tokens (need ${t.cost.toLocaleString()})`); return; }
      if (!confirm(`Unlock the ${t.name} theme for ${t.cost.toLocaleString()} tokens?`)) return;
      setSaving(true);
      await updateProfile({ tokens: (profile.tokens || 0) - (t.cost || 0), unlocked_themes: [...unlocked, t.id].join(','), theme_bg: t.id });
      setSaving(false);
      return;
    }
    setSaving(true);
    await updateProfile({ theme_bg: t.id });
    setSaving(false);
  };

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">Pick a background theme — the sidebar matches a darker shade. (PLUS only)</p>
      <div className="grid grid-cols-3 gap-2">
        {THEMES.filter(t => !t.exclusive || t.exclusive === profile?.username?.toLowerCase()).map(t => {
          const active = currentId === t.id || (!currentId && t.id === DEFAULT_THEME_ID);
          const locked = t.premium && !isUnlocked(t);
          return (
            <button key={t.id} onClick={() => apply(t)} className={`relative rounded-xl h-16 border-2 overflow-hidden transition-transform hover:scale-105 ${active ? 'border-panel ring-2 ring-panel/30' : 'border-white/20'}`} style={{ background: t.bg, backgroundSize: t.animated ? '200% 200%' : 'cover', animation: t.animated ? 'themePan 8s ease infinite' : undefined }}>
              <span className="absolute bottom-0 left-0 right-0 text-[10px] text-white font-display text-center py-0.5" style={{ backgroundColor: t.sidebar }}>{t.name}</span>
              {active && <Check size={14} className="absolute top-1 right-1 text-white" />}
              {locked && <span className="absolute top-1 right-1 text-[9px] bg-black/70 text-yellow-300 px-1 rounded font-display flex items-center gap-0.5">🔒{t.cost?.toLocaleString()}</span>}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-3">
        {saving && <p className="text-xs text-muted-foreground">Saving...</p>}
        {currentId && currentId !== DEFAULT_THEME_ID && <button onClick={() => apply('')} className="text-xs text-muted-foreground underline">Reset to default</button>}
      </div>
    </div>
  );
}