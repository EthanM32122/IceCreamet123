import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { TokenIcon } from '@/components/game/CurrencyIcon';

const MERCHANT_IMAGE = 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/3c7673e60_image.png';
const COST = 100000;
const MAX_PRESSURES = 10;

// Escalating pressure lines shown each time the player declines.
const PRESSURE_LINES = [
  'Psst... hey kid. Pay 100k coins and I\'ll give you a 10% chance to DOUBLE your pumpkin seeds. Deal?',
  'Come on, it\'s only 100k! You\'ve got that much laying around, right?',
  'Don\'t be shy... a 10% shot at doubling your seeds is a steal!',
  'You\'re really gonna walk away from this opportunity?',
  'I\'m offering you the deal of a lifetime here, kid...',
  'Just say yes. You know you want to.',
  'Okay okay, I\'ll wait... but this offer won\'t last forever!',
  'Seriously? You\'re going to make me beg?',
  'Last chance, kid. 100k for a shot at doubling your seeds.',
  'Fine. I tried. But don\'t come crying to me later when your seeds stay small.'
];

const MIN_INTERVAL = 10 * 60 * 1000;  // 10 minutes
const MAX_INTERVAL = 45 * 60 * 1000;  // 45 minutes

// _MINTI_ (owner) gets the merchant immediately on first load so they can
// verify it works after a publish+refresh; everyone else waits the normal timer.
const MINTI_USER_ID = '6a618722aa7aa154e6bca6b2';

function randomInterval() {
  return MIN_INTERVAL + Math.floor(Math.random() * (MAX_INTERVAL - MIN_INTERVAL));
}

export default function MysteriousMerchant() {
  const game = useGame();
  const profile = game?.profile;
  const [visible, setVisible] = useState(false);
  const [pressureCount, setPressureCount] = useState(0);
  const [result, setResult] = useState(null); // null | 'success' | 'fail' | 'poor'
  const [processing, setProcessing] = useState(false);
  const timerRef = useRef(null);

  const scheduleNext = useCallback((delayOverride) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const delay = delayOverride != null ? delayOverride : randomInterval();
    timerRef.current = setTimeout(() => {
      setVisible(true);
      setPressureCount(0);
      setResult(null);
    }, delay);
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    // Show the merchant immediately only once per browser session, so
    // refreshing the page does not re-trigger the popup. After the first
    // appearance, fall back to the normal random timer.
    const alreadyShown = localStorage.getItem('merchant_shown_immediate') === '1';
    if (!alreadyShown) {
      localStorage.setItem('merchant_shown_immediate', '1');
      scheduleNext(1500);
    } else {
      scheduleNext();
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [profile?.id, scheduleNext]);

  const closeAndReschedule = () => {
    setVisible(false);
    setResult(null);
    setPressureCount(0);
    setProcessing(false);
    scheduleNext();
  };

  const handleNo = () => {
    const next = pressureCount + 1;
    if (next >= MAX_PRESSURES) {
      closeAndReschedule();
    } else {
      setPressureCount(next);
    }
  };

  const handleYes = async () => {
    if (processing) return;
    const current = game?.profile;
    if (!current) return;
    if ((current.tokens || 0) < COST) {
      setResult('poor');
      return;
    }
    setProcessing(true);
    try {
      const newTokens = Math.floor(current.tokens - COST);
      const currentSeeds = current.pumpkin_seeds || 0;
      const won = Math.random() < 0.10;
      const newSeeds = won ? currentSeeds * 2 : currentSeeds;
      await base44.entities.PlayerProfile.update(current.id, {
        tokens: newTokens,
        pumpkin_seeds: newSeeds
      });
      // Optimistically update the local profile
      if (game?.setProfile) {
        game.setProfile({ ...current, tokens: newTokens, pumpkin_seeds: newSeeds });
      }
      setResult(won ? 'success' : 'fail');
    } catch (e) {
      setResult('fail');
    } finally {
      setProcessing(false);
    }
  };

  if (!visible || !profile) return null;

  const line = result ? null : PRESSURE_LINES[pressureCount] || PRESSURE_LINES[PRESSURE_LINES.length - 1];
  const remaining = MAX_PRESSURES - pressureCount;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
      <div className="relative bg-gradient-to-b from-[#2D2536] to-[#1a1520] rounded-2xl border-2 border-[#4E4158] shadow-2xl max-w-md w-full p-6 text-center">
        {/* Creature image */}
        <div className="flex justify-center mb-4">
          <img
            src={MERCHANT_IMAGE}
            alt="Mysterious Figure"
            className="w-32 h-32 object-contain animate-blook-rise"
            style={{ filter: 'drop-shadow(0 0 12px rgba(139,152,105,0.4))' }}
          />
        </div>

        {/* Result view */}
        {result === 'success' && (
          <div className="mb-4">
            <p className="text-2xl font-display text-[#8B9869] mb-2">You won!</p>
            <p className="text-white text-sm mb-4">
              Your pumpkin seeds have been <span className="text-[#8B9869] font-bold">doubled</span>!
              You now have <span className="text-amber-400 font-bold">{(profile.pumpkin_seeds || 0).toLocaleString()}</span> seeds.
            </p>
            <button
              onClick={closeAndReschedule}
              className="px-6 py-2 rounded-lg bg-[#8B9869] text-white font-bold hover:opacity-90 transition-opacity"
            >
              Nice!
            </button>
          </div>
        )}

        {result === 'fail' && (
          <div className="mb-4">
            <p className="text-2xl font-display text-red-400 mb-2">No luck...</p>
            <p className="text-white/70 text-sm mb-4">
              The gamble didn't pay off this time. 100k coins gone, but your seeds stay the same.
            </p>
            <button
              onClick={closeAndReschedule}
              className="px-6 py-2 rounded-lg bg-[#4E4158] text-white font-bold hover:opacity-90 transition-opacity"
            >
              Okay...
            </button>
          </div>
        )}

        {result === 'poor' && (
          <div className="mb-4">
            <p className="text-2xl font-display text-amber-400 mb-2">Not enough coins!</p>
            <p className="text-white/70 text-sm mb-4">
              You need 100,000 coins for this deal. Come back when you're richer, kid.
            </p>
            <button
              onClick={() => setResult(null)}
              className="px-6 py-2 rounded-lg bg-[#4E4158] text-white font-bold hover:opacity-90 transition-opacity mr-2"
            >
              Okay...
            </button>
            <button
              onClick={closeAndReschedule}
              className="px-6 py-2 rounded-lg bg-[#2D2536] text-white/60 font-bold border border-[#4E4158] hover:opacity-90 transition-opacity"
            >
              Leave
            </button>
          </div>
        )}

        {/* Offer / pressure view */}
        {!result && (
          <>
            <p className="text-white text-sm sm:text-base mb-1 italic min-h-[3rem] flex items-center justify-center">
              "{line}"
            </p>
            {pressureCount > 0 && remaining > 1 && (
              <p className="text-[#8B9869]/60 text-xs mb-4">
                The figure won't leave you alone... ({remaining - 1} chances left before it gives up)
              </p>
            )}
            {pressureCount === 0 && (
              <p className="text-white/40 text-xs mb-4">A mysterious figure has appeared...</p>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleYes}
                disabled={processing}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#8B9869] text-white font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <TokenIcon size={16} /> Yes (100k)
              </button>
              <button
                onClick={handleNo}
                disabled={processing}
                className="px-5 py-2.5 rounded-lg bg-[#4E4158] text-white font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                No
              </button>
            </div>

            <div className="mt-3 text-xs text-white/30">
              Current seeds: <span className="text-amber-400/70">{(profile.pumpkin_seeds || 0).toLocaleString()}</span>
              {' · '}
              Current coins: <span className="text-[#a7fcc9]/70">{(profile.tokens || 0).toLocaleString()}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}