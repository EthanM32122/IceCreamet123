import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import useSeedSpawn from '@/components/game/useSeedSpawn.jsx';
import { useGame } from '@/lib/gameContext';
import { useToast } from '@/components/ui/use-toast';
import {
  isEventLive, claimPrize, parseClaimed, eligibleNewPrizes
} from '@/lib/spookyEvent';
import SpawnCountdown from '@/components/game/SpawnCountdown';

// The pumpkin seed is represented as the "pumpkin cookie" blook.
export const PUMPKIN_COOKIE_IMG = 'https://blacket.xotic.org/content/blooks/Pumpkin%20Cookie.webp';

// A single collectible pumpkin cookie sitting at a random spot on screen.
// Rendered as the pumpkin-cookie blook with a pulsing halo so players never
// miss it during the spawn window.
function Seed({ position, onCollect, index }) {
  return (
    <button
      style={{
        left: position.x,
        top: position.y,
        zIndex: 90
      }}
      onClick={() => onCollect(index)}
      className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center select-none cursor-pointer pointer-events-auto group"
      aria-label="Collect pumpkin cookie seed"
    >
      <span className="seed-halo absolute inset-0 rounded-full pointer-events-none" />
      <img
        src={PUMPKIN_COOKIE_IMG}
        alt="pumpkin cookie"
        className="relative w-14 h-14 sm:w-16 sm:h-16 object-contain animate-pumpkin-pulse drop-shadow-[0_0_16px_rgba(255,160,0,1)] transition-transform group-hover:scale-125 group-hover:brightness-125"
        draggable={false}
      />
    </button>
  );
}

export default function PumpkinSeedEvent() {
  const { profile, updateProfile } = useGame();
  const { toast } = useToast();
  const { spawned, setSpawned, remainingMs, spawnActive, markCollected } = useSeedSpawn();
  const [collectedCount, setCollectedCount] = useState(0);
  const collectedRef = useRef(0);
  const claimedRef = useRef(new Set());
  const seedCountRef = useRef(0);
  const busyRef = useRef(false);
  const latestProfileRef = useRef(profile);
  latestProfileRef.current = profile;
  const retryAfterRef = useRef(0);

  const seedCount = profile?.pumpkin_seeds || 0;

  // Only read saved data when there is an earned, unclaimed milestone.
  const tryAutoClaim = useCallback(async () => {
    const current = latestProfileRef.current;
    if (busyRef.current || !current || Date.now() < retryAfterRef.current) return;
    if (!eligibleNewPrizes(current.pumpkin_seeds || 0, parseClaimed(current)).length) return;
    busyRef.current = true;
    try {
      const res = await claimPrize();
      if (res?.ok) {
        const serverClaimed = res.claimed || [];
        const newly = (res.prizes || []).filter(p => p && !claimedRef.current.has(p.name));
        serverClaimed.forEach(c => claimedRef.current.add(c));
        // Persist the authoritative claim list into the live profile so the
        // whole app (and the Blooks inventory) reflects the new prizes at once.
        if (newly.length > 0) {
          try { await updateProfile({ claimed_spooky_prizes: JSON.stringify(serverClaimed) }); } catch (e) {}
          toast({
            title: `🎃 Spooky Prize${newly.length > 1 ? 's' : ''} Unlocked!`,
            description: newly.map(p => `${p.name} (${p.rarity})`).join(', ') + ' added to your blooks!'
          });
        }
      }
    } catch (e) {
      retryAfterRef.current = Date.now() + 300000;
    } finally {
      busyRef.current = false;
    }
  }, [updateProfile, toast]);

  const autoClaimRef = useRef(tryAutoClaim);
  autoClaimRef.current = tryAutoClaim;

  useEffect(() => {
    if (!profile?.id) return;
    seedCountRef.current = seedCount;
    autoClaimRef.current();
  }, [profile?.id, seedCount, profile?.claimed_spooky_prizes]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isEventLive()) autoClaimRef.current();
    }, 300000);
    return () => clearInterval(interval);
  }, []);

  // Persist one collected seed to the server (ref-based so rapid clicks are safe).
  const collectSeed = async (id) => {
    setCollectedCount(c => c + 1);
    collectedRef.current += 1;
    // Persist the collection so a refresh can't re-spawn this seed.
    markCollected(id);
    // Remove this seed from the screen.
    setSpawned(prev => prev.filter(s => s.id !== id));
    const newTotal = seedCountRef.current + 1;
    seedCountRef.current = newTotal;
    try {
      await updateProfile({ pumpkin_seeds: newTotal });
      await tryAutoClaim();
    } catch (e) {
      // keep local count; retried by updateProfile on next interaction
    }
  };

  // The shared layout keeps the spawn clock mounted during page navigation.
  if (!isEventLive()) return null;

  return (
    <>
      {/* Clickable seeds */}

      {/* Persistent seed counter -> event page */}
      <div className="fixed right-3 z-50 flex flex-col items-end gap-1">
        <Link
          to="/spooky-event"
          className="flex items-center gap-1.5 bg-black/70 backdrop-blur-md border border-orange-400/50 rounded-full px-3 py-1.5 text-sm font-display shadow-lg hover:bg-black/80 transition-colors"
          style={{ top: 'auto' }}
        >
          <span className="text-lg">🎃</span>
          <span className="text-orange-300">{seedCount + collectedCount}</span>
        </Link>
        {spawned.length > 0 && (
          <span className="text-xs font-display text-black bg-gradient-to-r from-orange-400 to-amber-300 border border-orange-200 rounded-full px-2.5 py-1 shadow-[0_0_12px_rgba(255,160,0,0.9)] animate-pulse">🎃 Collect pumpkins! {spawned.length} left</span>
        )}
      </div>

      {/* Countdown centered in the black header */}
      <SpawnCountdown ms={remainingMs} active={spawnActive} />

      {createPortal(
        <div className="fixed inset-0 z-[10000] pointer-events-none">
          {spawned.map(s => (
            <Seed key={s.id} position={s} index={s.id} onCollect={collectSeed} />
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
