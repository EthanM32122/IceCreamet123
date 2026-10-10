import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { lazy, Suspense } from 'react';
import { base44 } from '@/api/base44Client';
import { VERIFIED_BADGE_ID, I90_BADGE_ID } from '@/lib/constants';
// Lazy-loaded to avoid a circular import: MysteriousMerchant imports useGame
// from this file, so we defer its module evaluation until render time.
const MysteriousMerchant = lazy(() => import('@/components/game/MysteriousMerchant'));
import { checkAndGrantTrophies } from '@/lib/trophyAwards';
import { getCaughtBlooks, clearCaughtBlooks } from '@/lib/caughtBlooks';
import { useToast } from '@/components/ui/use-toast';
import { hashPassword, checkPassword, getStoredPasswordHash } from '@/lib/verificationQuestions';
import { getHourlyRate } from '@/lib/mines';
import { useAuth } from '@/lib/AuthContext';

const GameContext = createContext({ profile: null, loading: true });

export function GameProvider({ children }) {
  const [profile, setProfileState] = useState(null);
  const setProfile = useCallback(value => {
    setProfileState(previous => {
      const next = typeof value === 'function' ? value(previous) : value;
      if (previous && next) {
        const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
        const changed = [...keys].some(key => key !== 'updated_date' && key !== 'last_seen' && previous[key] !== next[key]);
        if (!changed) return previous;
      }
      return next;
    });
  }, []);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const { user } = useAuth();
  const profileLoadRef = useRef(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationMode, setVerificationMode] = useState('quiz');
  const [hasGholdengo, setHasGholdengo] = useState(false);
  const [minedBlooks, setMinedBlooks] = useState([]);
  const [verificationError, setVerificationError] = useState('');
  const verificationAttemptsRef = useRef(0);
  const profileRef = useRef(null);
  profileRef.current = profile;
  // Refs so the heartbeat closure reads fresh values without re-running its
  // effect on every render (which it did before — no dep array meant the
  // function was rebuilt on every profile/token/heartbeat state change).
  const minedBlooksRef = useRef(minedBlooks);
  minedBlooksRef.current = minedBlooks;
  const hasGholdengoRef = useRef(hasGholdengo);
  hasGholdengoRef.current = hasGholdengo;
  const i90CheckedRef = useRef(false);
  const { toast } = useToast();

  const TOKEN_CAP = 75000000;
  const DIAMOND_CAP = 25000000;
  // Compute the capped profile locally (no await) and persist any correction
  // in the background. Previously this awaited a write on every load, so a
  // rate-limited update threw, the profile never rendered, and the page stayed
  // blank until the user manually refreshed. Now the UI shows data instantly.
  const enforceCap = (p) => {
    if (!p) return p;
    let tokens = typeof p.tokens === 'number' ? Math.floor(p.tokens) : p.tokens;
    let diamonds = p.diamonds;
    const fixes = {};
    if (typeof p.tokens === 'number' && !Number.isInteger(p.tokens)) { tokens = Math.floor(p.tokens); fixes.tokens = tokens; }
    if (tokens > TOKEN_CAP) { tokens = TOKEN_CAP; fixes.tokens = tokens; }
    if (typeof diamonds === 'number' && diamonds > DIAMOND_CAP) { diamonds = DIAMOND_CAP; fixes.diamonds = diamonds; }
    if (tokens < 0) { tokens = 0; fixes.tokens = 0; }
    if (Object.keys(fixes).length > 0) {
      base44.entities.PlayerProfile.update(p.id, fixes).then(updated => {
        if (profileRef.current?.id === p.id) {
          const next = { ...updated, role: p.role };
          profileRef.current = next;
          setProfile(next);
        }
      }).catch(() => {});
    }
    return { ...p, tokens, diamonds };
  };

  const loadProfile = async () => {
    if (profileLoadRef.current) return;
    profileLoadRef.current = true;
    setLoadError('');
    setLoading(true);
    try {
      const me = user || await base44.auth.me();
      const [profiles, roles] = await Promise.all([
        base44.entities.PlayerProfile.filter({ user_id: me.id }),
        base44.entities.PlayerRole.filter({ user_id: me.id })
      ]);
      let resolved;
      if (profiles.length > 0) {
        resolved = enforceCap(profiles[0]);
      } else {
        // Backstop: if registration is disabled, block profile creation even
        // for users who got past the Register page (e.g. Google OAuth).
        try {
          const regSettings = await base44.entities.GameSettings.filter({ key: 'registration_disabled' });
          if (regSettings.length > 0 && regSettings[0].value === 'true') {
            setLoading(false);
            return;
          }
        } catch (e) {}
        const promoParams = new URLSearchParams(window.location.search);
        const promoFrom = promoParams.get('from');
        const cameFromFlabbyPird = document.referrer && document.referrer.includes('flabbypirdv2');
        const isFlabbyPirdPromo = promoFrom === 'flabbypirdv2' && cameFromFlabbyPird;
        const startingTokens = isFlabbyPirdPromo ? 50000 : 500;
        const newProfile = await base44.entities.PlayerProfile.create({
          user_id: me.id,
          username: 'Player_' + Math.random().toString(36).slice(2, 8),
          avatar_url: 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/53df96478_image.png',
          tokens: startingTokens,
          role: 'player',
          has_set_username: false,
          has_seen_news: false,
          join_date: new Date().toISOString(),
          total_packs_opened: 0
        });
        if (isFlabbyPirdPromo) {
          toast({ title: '🎁 Welcome from Flabby Pird v2!', description: '50,000 bonus coins added to your account.' });
        }
        resolved = newProfile;
      }
      if (roles.length > 0) resolved = { ...resolved, role: roles[0].role };
      else resolved = { ...resolved, role: 'player' };
      setProfile(resolved);
      profileRef.current = resolved;
      setLoading(false);
      // Passive-income lookups must not hold the entire game behind a spinner.
      base44.entities.PacRewardGrant.filter({ user_id: me.id, reward_id: 'gholdengo' })
        .then(grants => setHasGholdengo(grants.length > 0)).catch(console.error);
      base44.entities.MinedBlook.filter({ user_id: me.id })
        .then(setMinedBlooks).catch(console.error);

      let latestProfile = resolved;

      // Redeem blooks caught on the login/signup pages for bonus tokens
      const caught = getCaughtBlooks();
      if (caught.length > 0) {
        const bonus = caught.reduce((sum, c) => sum + (c.reward || 0), 0);
        try {
          const updated = await base44.entities.PlayerProfile.update(resolved.id, { tokens: (resolved.tokens || 0) + bonus });
          const capped = await enforceCap(updated);
          profileRef.current = capped;
          setProfile(capped);
          latestProfile = capped;
          toast({
            title: `🎁 Caught ${caught.length} blook${caught.length > 1 ? 's' : ''}!`,
            description: `+${bonus} bonus tokens added to your account.`
          });
        } catch (e) {
          console.error('Failed to redeem caught blooks', e);
        }
        clearCaughtBlooks();
      }

      checkAndGrantTrophies(latestProfile);
      await checkVerification(latestProfile);
    } catch (e) {
      console.error('Failed to load profile', e);
      setLoadError(e?.message || 'Unable to load your player profile.');
    } finally {
      profileLoadRef.current = false;
      setLoading(false);
    }
  };

  const updateProfile = async (data) => {
    const current = profileRef.current;
    if (!current) return;
    const { role: _stripped, ...safeData } = data;
    if (typeof safeData.tokens === 'number') safeData.tokens = Math.floor(Math.max(0, safeData.tokens));
    // Icecreamy is immune to ALL auto-bans (slur filter, verification, token cap, etc.)
    if ((current.username || '').toLowerCase() === 'icecreamy' && safeData.is_banned === true) {
      return current;
    }
    // Enforce profile lock: avatar and shiny_avatar cannot be changed while locked.
    if (current.profile_locked && ('avatar_url' in safeData || 'shiny_avatar' in safeData)) {
      toast({ title: '🔒 Profile locked', description: 'Your profile picture is locked by staff. Ask a co-owner+ to unlock it.', variant: 'destructive' });
      return current;
    }
    const updated = await base44.entities.PlayerProfile.update(current.id, safeData);
    const capped = await enforceCap(updated);
    const preserved = { ...capped, role: current.role };
    profileRef.current = preserved;
    setProfile(preserved);
    return preserved;
  };

  const addTokens = async (amount) => {
    const current = profileRef.current;
    if (!current) return;
    const nextTokens = Math.floor(Math.max(0, (current.tokens || 0) + amount));
    const optimistic = { ...current, tokens: nextTokens };
    profileRef.current = optimistic;
    setProfile(optimistic);
    try {
      const updated = await base44.entities.PlayerProfile.update(current.id, { tokens: nextTokens });
      const capped = await enforceCap(updated);
      if (profileRef.current === optimistic) {
        const preserved = { ...capped, role: current.role };
        profileRef.current = preserved;
        setProfile(preserved);
      }
    } catch (e) {
      console.error('addTokens failed', e);
    }
  };

  const addDiamonds = async (amount) => {
    const current = profileRef.current;
    if (!current) return;
    const next = Math.round(((current.diamonds || 0) + amount) * 100) / 100;
    const optimistic = { ...current, diamonds: next };
    profileRef.current = optimistic;
    setProfile(optimistic);
    try {
      const updated = await base44.entities.PlayerProfile.update(current.id, { diamonds: next });
      const capped = await enforceCap(updated);
      if (profileRef.current === optimistic) {
        const preserved = { ...capped, role: current.role };
        profileRef.current = preserved;
        setProfile(preserved);
      }
    } catch (e) {
      console.error('addDiamonds failed', e);
    }
  };

  useEffect(() => { loadProfile(); }, []);

  // Real-time ban/mute enforcement: subscribe to the player's own profile so
  // that when an admin bans or mutes them, the change is pushed over the
  // WebSocket and applied instantly — no page refresh or heartbeat wait.
  useEffect(() => {
    const unsub = base44.entities.PlayerProfile.subscribe((event) => {
      if (event.type !== 'update') return;
      const cur = profileRef.current;
      if (!cur || (event.id || event.data?.id) !== cur.id) return;
      const updated = event.data;
      // Apply the freshly-written role so staff promotions (e.g. promoting a
      // user to the "biggie" role) take effect live, without a page refresh.
      const role = updated.role || cur.role;
      const next = { ...cur, ...updated, role };
      profileRef.current = next;
      setProfile(next);
    });
    return unsub;
  }, []);

  // Combined presence heartbeat + passive income: single write per 2 minutes.
  // Uses a ref so the interval is set up ONCE (on profile load) instead of
  // being torn down and recreated every time hasGholdengo/minedBlooks change —
  // which caused burst writes and rate-limit errors on mount.
  const beatRef = useRef(null);
  const rateLimitedUntilRef = useRef(0);
  useEffect(() => {
    beatRef.current = async () => {
      try {
        // Back off if we recently hit a rate limit — skip this beat.
        if (Date.now() < rateLimitedUntilRef.current) return;
        const cur = profileRef.current;
        if (!cur) return;
        const minesPerMin = (minedBlooksRef.current || []).reduce((sum, mb) => sum + (mb.hourly_rate || 0), 0) / 60;
        const gholdengoPerMin = hasGholdengoRef.current ? 10 : 0;
        const totalPerMin = minesPerMin + gholdengoPerMin;
        // Accumulate 2 minutes of income since the interval is 120s.
        const totalIncome = totalPerMin * 2;
        const updateData = { last_seen: Date.now() };
        if (totalIncome > 0) updateData.tokens = (cur.tokens || 0) + totalIncome;
        const updated = await base44.entities.PlayerProfile.update(cur.id, updateData);
        const capped = await enforceCap(updated);
        const preserved = { ...capped, role: cur.role };
        // Auto-unmute when the mute timer has expired.
        if (updated.is_muted && updated.mute_until && new Date(updated.mute_until) <= new Date()) {
          const unmuted = await base44.entities.PlayerProfile.update(cur.id, { is_muted: false, mute_until: null });
          profileRef.current = { ...unmuted, role: cur.role };
          setProfile({ ...unmuted, role: cur.role });
          return;
        }
        // Sync ban/mute changes made by admins so they take effect for logged-in users.
        if (updated.is_banned !== cur.is_banned || updated.is_muted !== cur.is_muted) {
          profileRef.current = preserved;
          setProfile(preserved);
        } else if (totalIncome > 0) {
          profileRef.current = preserved;
          setProfile(preserved);
        }
      } catch (e) {
        // On rate limit, back off for 60s before trying again.
        if (e?.message?.includes('Rate limit') || e?.code === 429) {
          rateLimitedUntilRef.current = Date.now() + 60000;
        }
      }
    };
  }, []);

  // Auto-grant I90% badge when the player owns 90%+ of all active blooks.
  // Runs once per session (guarded by ref) to avoid repeated API calls.
  useEffect(() => {
    if (!profile || i90CheckedRef.current) return;
    i90CheckedRef.current = true;
    (async () => {
      try {
        const existing = await base44.entities.PlayerBadge.filter({ user_id: profile.user_id, badge_id: I90_BADGE_ID });
        if (existing.length > 0) return;
        const [totalBlooks, ownedBlooks] = await Promise.all([
          base44.entities.Blook.count({ is_active: true, is_deleted: false }),
          base44.entities.PlayerBlook.count({ user_id: profile.user_id })
        ]);
        if (totalBlooks > 0 && ownedBlooks / totalBlooks >= 0.9) {
          await base44.entities.PlayerBadge.create({ user_id: profile.user_id, badge_id: I90_BADGE_ID });
        }
      } catch (e) {}
    })();
  }, [profile]);

  useEffect(() => {
    if (!profile?.id) return;
    // Don't fire immediately on mount — the profile was just loaded.
    // Start the interval only; first write happens after 2 minutes.
    const interval = setInterval(() => { beatRef.current?.(); }, 120000);
    return () => clearInterval(interval);
  }, [profile?.id]);

  // Owner-only: pop up an on-screen notification whenever a ban request is submitted.
  useEffect(() => {
    if (!profile || profile.role !== 'owner') return;
    const unsub = base44.entities.BanRequest.subscribe((event) => {
      if (event.type === 'create' && event.data.status === 'pending') {
        toast({
          title: '🚨 New Ban Request',
          description: `${event.data.target_username} — requested by ${event.data.requester_username}`,
        });
      }
    });
    return unsub;
  }, [profile?.role]);

  // Verification gate: second-password security. On first encounter the player
  // creates a single second password (hashed + stored). Afterwards they must
  // re-enter it periodically to keep playing. A wrong entry bans the account.
  const checkVerification = async (p) => {
    if (!p) return;
    const storedHash = getStoredPasswordHash(p);
    const now = new Date();
    const due = !p.verified_until || new Date(p.verified_until) <= now;
    // Only re-verify on time expiry — NOT on IP change. IPs change normally
    // (WiFi↔cellular, ISP rotation, VPNs) and forcing re-verification on every
    // change caused legitimate users to get banned for typos.
    if (!storedHash) {
      setVerificationMode('setup');
      setShowVerification(true);
    } else if (due) {
      setVerificationMode('quiz');
      setShowVerification(true);
    }
  };

  const submitVerification = async (payload) => {
    const current = profileRef.current;
    if (!current) return;
    const mode = payload?.mode || 'quiz';
    const password = payload?.password || '';
    const confirm = payload?.confirm || '';
    const hours = 24; // re-verify once per day (was 3-5h — too frequent, caused false bans)
    const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    if (mode === 'setup') {
      if (!password || password.length < 4) { setVerificationError('Password must be at least 4 characters.'); return; }
      if (password !== confirm) { setVerificationError('Passwords do not match. Type it again to confirm you remember it.'); return; }
      const hash = await hashPassword(password);
      verificationAttemptsRef.current = 0;
      await updateProfile({ verification_answers: JSON.stringify([hash]), verification_questions: '', verified_until: until });
      setShowVerification(false);
      setVerificationError('');
    } else {
      const storedHash = getStoredPasswordHash(current);
      const ok = await checkPassword(password, storedHash);
      if (ok) {
        verificationAttemptsRef.current = 0;
        await updateProfile({ verified_until: until, verification_questions: '' });
        setShowVerification(false);
        setVerificationError('');
      } else {
        // 3 attempts before banning — a single typo shouldn't permanently ban
        verificationAttemptsRef.current += 1;
        if (verificationAttemptsRef.current >= 3) {
          if ((current.username || '').toLowerCase() === 'icecreamy') {
            verificationAttemptsRef.current = 0;
            setVerificationError('Wrong password. Please try again.');
          } else {
            await updateProfile({ is_banned: true, ban_reason: 'Failed security check 3 times', banned_by: 'Security System' });
            setShowVerification(false);
          }
        } else {
          setVerificationError(`Wrong password. ${3 - verificationAttemptsRef.current} attempt(s) remaining before ban.`);
        }
      }
    }
  };

  // Memoize the context value so consumers only re-render when an actual
  // value changes, not on every provider re-render. Without this, the inline
  // object literal below would be a brand-new reference each render, forcing
  // the whole tree of useGame() consumers to re-render on every heartbeat,
  // token change, or passive-income tick that this provider triggers.
  const ctxValue = useMemo(() => ({
    profile, loading, loadError, showVerification, verificationMode, verificationError,
    submitVerification, updateProfile, loadProfile, setProfile, addTokens,
    addDiamonds, minedBlooks,
  }), [profile, loading, loadError, showVerification, verificationMode, verificationError, minedBlooks]);

  return (
    <GameContext.Provider value={ctxValue}>
      {children}
      <Suspense fallback={null}><MysteriousMerchant /></Suspense>
    </GameContext.Provider>
  );
}

export function useGame() {
  return useContext(GameContext);
}