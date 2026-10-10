import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { useGame } from '@/lib/gameContext';
import { useToast } from '@/components/ui/use-toast';
import { getActiveBlooks } from '@/lib/gameDataCache';
import { base44 } from '@/api/base44Client';

// Pumpkin King is the special blook in the abuse event — clicking it gives a seed.
export const PUMPKIN_KING_ID = '6a943a21521eb7fcc3838ead';
export const ABUSE_DURATION = 3 * 60 * 1000; // 3 minutes

// Random token reward for clicking a normal blook.
function randTokens() {
  return 100 + Math.floor(Math.random() * 401); // 100–500
}

// Generate a position spread across the whole screen, avoiding spots already
// occupied so blooks never stack in one place.
const MIN_GAP = 12; // percent distance between blook centers
function randPosition(existingPositions) {
  let attempts = 0;
  while (attempts < 40) {
    const pos = {
      x: 10 + Math.random() * 80,
      y: 18 + Math.random() * 66
    };
    const tooClose = existingPositions.some(
      p => Math.abs(p.x - pos.x) < MIN_GAP && Math.abs(p.y - pos.y) < MIN_GAP
    );
    if (!tooClose) return pos;
    attempts++;
  }
  // Fallback: pick the emptiest quadrant.
  const quads = [
    { x: 25, y: 35 }, { x: 75, y: 35 },
    { x: 25, y: 70 }, { x: 75, y: 70 }
  ];
  return quads[Math.floor(Math.random() * quads.length)];
}

// One floating blook, positioned on screen.
function FloatingBlook({ blook, position, isKing, onCollect }) {
  return (
    <button
      style={{ left: `${position.x}%`, top: `${position.y}%`, zIndex: 9999 }}
      onClick={onCollect}
      className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center select-none cursor-pointer pointer-events-auto group"
      aria-label={isKing ? 'Collect Pumpkin King seed' : 'Collect tokens'}
    >
      {isKing && (
        <span className="seed-halo absolute inset-0 rounded-full pointer-events-none" />
      )}
      <img
        src={blook.image_url}
        alt={blook.name}
        className={`relative w-16 h-16 sm:w-20 sm:h-20 object-contain transition-transform group-hover:scale-125 group-hover:brightness-125 ${
          isKing ? 'animate-pumpkin-pulse drop-shadow-[0_0_18px_rgba(255,160,0,1)]' : 'animate-pumpkin-pulse'
        }`}
        draggable={false}
      />
      {isKing && (
        <span className="absolute -top-2 -right-2 text-lg">🎃</span>
      )}
    </button>
  );
}

const BUSY_IDS = new Set();

function burstConfetti() {
  const colors = ['#ff6bd5', '#c084fc', '#f0abfc', '#a78bfa', '#e879f9', '#7c3aed', '#facc15', '#ffffff'];
  confetti({ particleCount: 120, spread: 90, origin: { y: 0.7 }, colors });
  setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { x: 0.15, y: 0.6 }, angle: 60, colors }), 200);
  setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { x: 0.85, y: 0.6 }, angle: 120, colors }), 400);
}

export default function AdminAbuse() {
  const { profile, updateProfile } = useGame();
  const { toast } = useToast();
  const [session, setSession] = useState(null);
  const [spawned, setSpawned] = useState([]);
  const [blooks, setBlooks] = useState([]);
  const [wasLive, setWasLive] = useState(false);
  const [popup, setPopup] = useState(null);
  const lastMsgRef = useRef(null);
  const busyRef = useRef(false);
  const clickCooldownRef = useRef(0);
  const tokenRef = useRef(profile?.tokens || 0);
  const seedRef = useRef(profile?.pumpkin_seeds || 0);
  tokenRef.current = profile?.tokens || 0;
  seedRef.current = profile?.pumpkin_seeds || 0;

  // Load active blooks for the floating rewards.
  useEffect(() => {
    getActiveBlooks().then(setBlooks).catch(() => {});
  }, []);

  // Track the live abuse session from the shared record.
  const loadSession = useCallback(async () => {
    try {
      const rows = await base44.entities.AdminAbuse.list({ limit: 5 });
      const active = (rows.items || rows).find(r => r.active);
      setSession(active || null);
    } catch (e) {
      setSession(null);
    }
  }, []);

  useEffect(() => {
    loadSession();
    const unsub = base44.entities.AdminAbuse.subscribe(event => {
      if (event.type === 'delete') {
        setSession(prev => prev?.id === event.id ? null : prev);
      } else if (event.data?.active === true) {
        setSession(prev => ({ ...(prev?.id === event.id ? prev : {}), ...event.data, id: event.id }));
      } else {
        setSession(prev => prev?.id === event.id ? (event.data?.active === false ? null : { ...prev, ...event.data }) : prev);
      }
    });
    return unsub;
  }, [loadSession]);

  // During a live, unexpired session keep spawning blooks on the screen.
  const live = session?.active && session.ends_at && Date.now() < new Date(session.ends_at).getTime();

  // Fire confetti once each time a new session goes live.
  useEffect(() => {
    if (live && !wasLive) {
      burstConfetti();
    }
    if (wasLive && !live) {
      setSpawned([]);
    }
    setWasLive(live);
  }, [live, wasLive]);

  // Show a popup when the announcement message changes on the active session.
  useEffect(() => {
    if (session?.message && session.message !== lastMsgRef.current) {
      lastMsgRef.current = session.message;
      setPopup(session.message);
      const t = setTimeout(() => setPopup(null), 5000);
      return () => clearTimeout(t);
    }
  }, [session?.message]);

  const spawn = useCallback(() => {
    if (busyRef.current || blooks.length === 0) return;
    busyRef.current = true;
    const usable = blooks.filter(b => b.image_url);
    if (usable.length === 0) { busyRef.current = false; return; }
    // 1% chance the next blook is the Pumpkin King.
    const isKing = Math.random() < 0.01 && usable.some(b => b.id === PUMPKIN_KING_ID);
    const blook = isKing
      ? usable.find(b => b.id === PUMPKIN_KING_ID) || usable[Math.floor(Math.random() * usable.length)]
      : usable[Math.floor(Math.random() * usable.length)];
    setSpawned(prev => {
      // Cap concurrent blooks and spread them out so they never stack.
      let pool = prev;
      if (pool.length >= 8) {
        pool = pool.slice(pool.length - 7);
      }
      const positions = pool.map(s => s.position);
      const pos = randPosition(positions);
      const id = 'ab' + Math.random().toString(36).slice(2) + Date.now();
      const item = { id, blook, position: pos, isKing: blook.id === PUMPKIN_KING_ID };
      setTimeout(() => {
        setSpawned(cur => cur.filter(s => s.id !== id));
      }, 6000);
      return [...pool, item];
    });
    busyRef.current = false;
  }, [blooks]);

  useEffect(() => {
    if (!live) return; // cleared by the live-transition effect
    spawn();
    const interval = setInterval(spawn, 1100); // a new blook roughly every second
    return () => clearInterval(interval);
  }, [live, spawn]);

  // Collect a blook: normal blook gives tokens, Pumpkin King gives a seed.
  const collect = async (item) => {
    const now = Date.now();
    if (now < clickCooldownRef.current) return; // quick spam guard
    clickCooldownRef.current = now + 300;
    setSpawned(prev => prev.filter(s => s.id !== item.id));
    if (item.isKing) {
      const next = seedRef.current + 1;
      seedRef.current = next;
      try { await updateProfile({ pumpkin_seeds: next }); } catch (e) {}
      confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 }, colors: ['#facc15', '#ff9f43', '#ff6bd5'] });
      toast({ title: '👑 Pumpkin King!', description: '+1 Pumpkin Seed', duration: 4000 });
    } else {
      const reward = randTokens();
      const next = tokenRef.current + reward;
      tokenRef.current = next;
      try { await updateProfile({ tokens: next }); } catch (e) {}
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 }, colors: ['#a7fcc9', '#facc15', '#ffffff'] });
      toast({ title: `${item.blook.name}!`, description: `+${reward.toLocaleString()} tokens`, duration: 4000 });
    }
  };

  if (!live) return null;

  // Global announcement handled by the host view; here we render the rainbow
  // screen wash, confetti, and the floating blooks.
  return createPortal(
    <div className="fixed inset-0 z-[9990] pointer-events-none">
      {/* Rainbow gradient wash across the whole screen while abuse is live */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background: 'linear-gradient(120deg, #ff6bd5, #c084fc, #f0abfc, #a78bfa, #e879f9, #f472b6, #ff6bd5)',
          backgroundSize: '300% 300%',
          animation: 'themePan 4s linear infinite'
        }}
      />
      {popup && (
        <div className="fixed top-1/4 left-1/2 -translate-x-1/2 z-[9995] pointer-events-auto">
          <div className="bg-panel rounded-2xl border-2 border-[#a7fcc9] p-6 max-w-md text-center shadow-2xl animate-blook-rise">
            <p className="font-display text-lg text-white">{popup}</p>
          </div>
        </div>
      )}
      <div
        className="absolute inset-0 z-[10] pointer-events-none"
      >
        {spawned.map(item => (
          <FloatingBlook
            key={item.id}
            blook={item.blook}
            position={item.position}
            isKing={item.isKing}
            onCollect={() => collect(item)}
          />
        ))}
      </div>
    </div>,
    document.body
  );
}

// Helper used by the host control panel to announce changes in global chat.
export async function announceAbuse(content, extra = {}) {
  const chatPromise = base44.entities.ChatMessage.create({
    content,
    username: 'ADMIN ABUSE',
    avatar_url: '',
    is_system: true,
    user_role: 'owner',
    game: 'icecreamet',
    channel: 'global',
    ...extra
  });
  // Also push the message to the active AdminAbuse record so the popup overlay
  // on every player's screen picks it up via the realtime subscription.
  try {
    const rows = await base44.entities.AdminAbuse.list({ limit: 5 });
    const active = (rows.items || rows).find(r => r.active);
    if (active) {
      await base44.entities.AdminAbuse.update(active.id, { message: content });
    }
  } catch {}
  return chatPromise;
}