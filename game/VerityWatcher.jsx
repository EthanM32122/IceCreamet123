import { useEffect } from 'react';
import { useGame } from '@/lib/gameContext';

/**
 * Lightweight client-side integrity / presence watcher.
 * Kept intentionally minimal so the production build succeeds;
 * expand later if you need anti-tamper checks.
 */
export default function VerityWatcher() {
  const game = useGame();
  const profile = game?.profile;

  useEffect(() => {
    if (!profile?.id) return;
    // Placeholder: could ping last_seen or run soft integrity checks.
    // No UI — presence only.
  }, [profile?.id]);

  return null;
}
