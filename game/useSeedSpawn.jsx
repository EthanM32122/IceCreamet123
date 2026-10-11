import { useCallback, useEffect, useRef, useState } from 'react';
import { isEventLive } from '@/lib/spookyEvent';

/**
 * Spawns clickable pumpkin seeds on a timer while the spooky event is live.
 * Returns positions + countdown so PumpkinSeedEvent / SpawnCountdown stay in sync.
 */
const SPAWN_INTERVAL_MS = 90_000; // every 90s
const SPAWN_WINDOW_MS = 25_000;   // seeds stay on screen this long
const SEEDS_PER_WAVE = 5;

function randomPos() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    x: `${8 + Math.random() * 84}%`,
    y: `${18 + Math.random() * 64}%`,
  };
}

export default function useSeedSpawn() {
  const [spawned, setSpawned] = useState([]);
  const [remainingMs, setRemainingMs] = useState(SPAWN_INTERVAL_MS);
  const [spawnActive, setSpawnActive] = useState(false);
  const nextSpawnAt = useRef(Date.now() + SPAWN_INTERVAL_MS);
  const waveEndsAt = useRef(0);

  useEffect(() => {
    if (!isEventLive()) {
      setSpawned([]);
      setSpawnActive(false);
      return undefined;
    }

    const tick = () => {
      const now = Date.now();

      if (spawnActive && now >= waveEndsAt.current) {
        setSpawned([]);
        setSpawnActive(false);
        nextSpawnAt.current = now + SPAWN_INTERVAL_MS;
      }

      if (!spawnActive && now >= nextSpawnAt.current) {
        const wave = Array.from({ length: SEEDS_PER_WAVE }, () => randomPos());
        setSpawned(wave);
        setSpawnActive(true);
        waveEndsAt.current = now + SPAWN_WINDOW_MS;
      }

      if (spawnActive) {
        setRemainingMs(Math.max(0, waveEndsAt.current - now));
      } else {
        setRemainingMs(Math.max(0, nextSpawnAt.current - now));
      }
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [spawnActive]);

  const markCollected = useCallback((id) => {
    setSpawned((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { spawned, setSpawned, remainingMs, spawnActive, markCollected };
}
