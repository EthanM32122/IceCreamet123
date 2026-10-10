import React, { useEffect, useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { SELL_PRICES, PLACEHOLDER_BLOOK_IMG } from '@/lib/constants';
import { shinySellPrice, shinyDiamondValue } from '@/lib/shiny';
import { DiamondIcon, TokenIcon } from '@/components/game/CurrencyIcon';

const RARITY_ANIM = {
  legendary: 'animate-legendary',
  mythical: 'animate-mythical',
  chroma: 'animate-chroma',
  supreme: 'animate-supreme',
  iridescent: 'animate-mythical',
  unique: 'animate-mythical',
  paradox: 'animate-supreme',
  elite: 'animate-supreme',
};

// Escalation ladder: background climbs through these tiers, stopping at the pulled rarity.
const LADDER = [
  { rarity: 'uncommon', color: '#4ade80' },
  { rarity: 'rare', color: '#60a5fa' },
  { rarity: 'epic', color: '#a855f7' },
  { rarity: 'legendary', color: '#f59e0b' },
  { rarity: 'chroma', color: '#00ccff' },
  { rarity: 'supreme', color: '#ef4444' },
  { rarity: 'mythical', color: '#f472b6' },
  { rarity: 'icecreamacle', color: 'rainbow' },
  { rarity: 'unique', color: '#00ff99' },
  { rarity: 'iridescent', color: 'iridescent' },
  { rarity: 'paradox', color: 'paradox' },
  { rarity: 'elite', color: 'elite' },
];

const RARITY_CONFETTI = {
  uncommon: { colors: ['#4ade80', '#86efac', '#bbf7d0'], count: 40, spread: 60 },
  rare: { colors: ['#60a5fa', '#93c5fd', '#bfdbfe'], count: 60, spread: 80 },
  epic: { colors: ['#a855f7', '#c084fc', '#d8b4fe'], count: 100, spread: 100 },
  legendary: { colors: ['#f59e0b', '#fbbf24', '#fcd34d', '#ffffff'], count: 140, spread: 120 },
  mythical: { colors: ['#f472b6', '#ec4899', '#f9a8d4', '#ffffff'], count: 180, spread: 140 },
  chroma: { colors: ['#00ccff', '#22d3ee', '#67e8f9', '#ffffff'], count: 180, spread: 140 },
  supreme: { colors: ['#ef4444', '#f87171', '#fca5a5', '#ffffff'], count: 180, spread: 140 },
  iridescent: { colors: ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff'], count: 220, spread: 150 },
  unique: { colors: ['#0099cc', '#00ff99', '#00ccff', '#ffffff'], count: 220, spread: 150 },
  icecreamacle: { colors: ['#a7fcc9', '#5ee7c0', '#34d399', '#2bb673', '#ffffff'], count: 220, spread: 150 },
  paradox: { colors: ['#3b82f6', '#ef4444', '#a855f7', '#ffffff'], count: 220, spread: 150 },
  elite: { colors: ['#ff0000', '#ff5500', '#ff0033', '#ffffff'], count: 240, spread: 150 }
};

const ladderIndex = (rarity) => {
  const i = LADDER.findIndex(l => l.rarity === rarity);
  return i === -1 ? 0 : i;
};

const bgStyleFor = (key) => {
  if (key === 'rainbow') return { background: 'linear-gradient(90deg,#ff6b6b,#feca57,#48dbfb,#ff9ff3,#54a0ff,#5ee7c0,#ff6b6b)', backgroundSize: '200% 200%', animation: 'iridescent 3s linear infinite' };
  if (key === 'iridescent') return { background: 'linear-gradient(90deg,#ff6b6b,#feca57,#48dbfb,#ff9ff3,#54a0ff)', backgroundSize: '200% 200%', animation: 'iridescent 3s linear infinite' };
  if (key === 'paradox') return { background: 'linear-gradient(90deg,#3b82f6,#ef4444,#a855f7,#3b82f6)', backgroundSize: '200% 200%', animation: 'iridescent 3s linear infinite' };
  if (key === 'elite') return { background: 'linear-gradient(90deg,#ff0000,#ff5500,#ff0033,#ff0000)', backgroundSize: '200% 200%', animation: 'iridescent 2s linear infinite' };
  return { backgroundColor: key };
};

export default function PullAnimation({ blook, pack, onClose, onSell, autoAdvance }) {
  // phase: shake -> split -> escalate -> reveal
  const [phase, setPhase] = useState('shake');
  const [colorStep, setColorStep] = useState(0);
  const autoTimer = useRef(null);
  const targetIndex = ladderIndex(blook.rarity);
  const animClass = RARITY_ANIM[blook.rarity] || '';

  // shake -> split
  useEffect(() => {
    const t = setTimeout(() => setPhase('split'), 600);
    return () => clearTimeout(t);
  }, []);

  // split -> escalate
  useEffect(() => {
    if (phase !== 'split') return;
    const t = setTimeout(() => setPhase('escalate'), 500);
    return () => clearTimeout(t);
  }, [phase]);

  // escalate: step up the ladder every 800ms until reaching the pulled tier
  useEffect(() => {
    if (phase !== 'escalate') return;
    if (colorStep >= targetIndex) {
      const t = setTimeout(() => setPhase('reveal'), 450);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setColorStep(c => c + 1), 350);
    return () => clearTimeout(t);
  }, [phase, colorStep, targetIndex]);

  // reveal confetti
  useEffect(() => {
    if (phase !== 'reveal') return;
    const config = RARITY_CONFETTI[blook.rarity];
    if (!config) return;
    const fire = () => {
      confetti({ particleCount: config.count, spread: config.spread, origin: { y: 0.5 }, colors: config.colors });
      confetti({ particleCount: Math.floor(config.count * 0.5), spread: config.spread * 0.7, origin: { x: 0.2, y: 0.6 }, angle: 60, colors: config.colors });
      confetti({ particleCount: Math.floor(config.count * 0.5), spread: config.spread * 0.7, origin: { x: 0.8, y: 0.6 }, angle: 120, colors: config.colors });
    };
    fire();
    const interval = setInterval(fire, 800);
    return () => clearInterval(interval);
  }, [phase]);

  // auto-advance: auto-keep shortly after reveal
  useEffect(() => {
    if (phase !== 'reveal' || !autoAdvance) return;
    autoTimer.current = setTimeout(() => { autoTimer.current = null; onClose(); }, 1000);
    return () => { if (autoTimer.current) { clearTimeout(autoTimer.current); autoTimer.current = null; } };
  }, [phase, autoAdvance]);

  const clearAuto = () => { if (autoTimer.current) { clearTimeout(autoTimer.current); autoTimer.current = null; } };
  const handleKeep = () => { clearAuto(); onClose(); };
  const handleSell = () => { clearAuto(); onSell(blook); };

  const ladderColor = LADDER[colorStep].color;
  const dark = phase === 'shake' || phase === 'split';
  const packBg = pack?.background_url || pack?.image_url;
  const overlayStyle = dark
    ? { backgroundColor: 'rgba(8,18,14,0.95)' }
    : phase === 'reveal' && packBg
      ? { backgroundColor: 'rgba(8,18,14,0.78)' }
      : bgStyleFor(ladderColor);

  const packImg = pack?.image_url;
  const halfStyle = (pos) => ({
    backgroundImage: packImg ? `url(${packImg})` : 'linear-gradient(135deg, #a7fcc9, rgb(var(--user-sidebar)))',
    backgroundSize: '100% 200%',
    backgroundPosition: pos,
    backgroundRepeat: 'no-repeat',
  });

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ ...overlayStyle, transition: 'background-color 0.3s ease' }}
      onClick={handleKeep}
    >
      {phase === 'reveal' && packBg && (
        <div className="absolute inset-0" style={{ backgroundImage: `url(${packBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      )}
      {phase === 'reveal' && (
        <div className="absolute inset-0" style={{ ...bgStyleFor(ladderColor), opacity: 0.5 }} />
      )}
      <div className="relative text-center" onClick={e => e.stopPropagation()}>
        {/* Shake */}
        {phase === 'shake' && (
          <div
            className="w-48 h-48 mx-auto animate-pack-shake rounded-xl"
            style={packImg
              ? { backgroundImage: `url(${packImg})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }
              : { background: 'linear-gradient(135deg, #a7fcc9, rgb(var(--user-sidebar)))' }}
          />
        )}

        {/* Split: pack breaks in half horizontally, halves fly away */}
        {phase === 'split' && (
          <div className="w-48 h-48 mx-auto relative">
            <div className="absolute top-0 left-0 w-full h-1/2 animate-pack-top" style={halfStyle('top')} />
            <div className="absolute bottom-0 left-0 w-full h-1/2 animate-pack-bottom" style={halfStyle('bottom')} />
          </div>
        )}

        {/* Escalate: background color climbs the rarity ladder for suspense */}
        {phase === 'escalate' && (
          <div>
            <div className="w-16 h-16 mx-auto rounded-full border-4 border-white/30 border-t-white animate-spin" />
            <p className="mt-5 text-2xl font-display text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] tracking-wide">
              {LADDER[colorStep].rarity.toUpperCase()}
            </p>
          </div>
        )}

        {/* Reveal */}
        {phase === 'reveal' && (
          <div className={animClass}>
            <div className="w-48 h-48 mx-auto mb-4 rounded-2xl flex items-center justify-center animate-blook-rise" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
              {blook.image_url ? (
                <img src={blook.image_url} alt={blook.name} className={`w-36 h-36 object-contain ${blook.isShiny ? 'shiny-blook' : ''}`} />
              ) : (
                <img src={PLACEHOLDER_BLOOK_IMG} alt="" className="w-24 h-24 object-contain rounded-lg" />
              )}
            </div>
            {blook.isShiny && <p className="text-lg font-display mb-1 text-yellow-300 drop-shadow-[0_0_8px_rgba(255,255,0,0.8)]">✨ SHINY! ✨</p>}
            <h2 className={`text-2xl font-display mb-1 rarity-${blook.rarity}`}>{blook.name}</h2>
            <p className={`text-sm font-display mb-4 rarity-${blook.rarity} capitalize`}>{blook.rarity}</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={handleKeep} style={{ backgroundColor: 'rgb(var(--user-sidebar))' }}>Keep</Button>
              <Button variant="outline" onClick={handleSell}>
                Sell for {blook.isShiny ? <DiamondIcon size={16} /> : <TokenIcon size={16} />} {(blook.isShiny ? shinyDiamondValue(blook) : (SELL_PRICES[blook.rarity] || 5)).toLocaleString()}
              </Button>
            </div>
            {autoAdvance && <p className="text-xs text-white/70 mt-3">Auto-opening next…</p>}
          </div>
        )}
      </div>
    </div>
  );
}