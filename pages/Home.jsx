import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import PackCard from '@/components/game/PackCard';
import PullAnimation from '@/components/game/PullAnimation';
import PackPurchaseModal from '@/components/game/PackPurchaseModal';
import { SELL_PRICES, RARITY_DROP_RATES, DIAMOND_PACK_COST, DIAMOND_PACK_LUCK } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import PackRatesDialog from '@/components/game/PackRatesDialog';
import BulkOpenResults from '@/components/game/BulkOpenResults';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getActiveBoost, setBoost } from '@/lib/packBoost';
import { totalXpToLevel, computeXpAward } from '@/lib/leveling';
import { rollShiny, shinySellPrice, shinyDiamondValue, DIAMOND_SHINY_MULT } from '@/lib/shiny';
import { DiamondIcon, TokenIcon } from '@/components/game/CurrencyIcon';
import { VIP_BULK_RECEIVERS } from '@/lib/constants';

export const MARKET_IMAGE = "https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/90a63f34c_image.png";

// Global booster tier icons — 1H (cyan), 3H (gold), 24H (magenta)
const BOOST_1H_ICON = "https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/c753973f1_image.png";
const BOOST_3H_ICON = "https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/6c1f8d7b8_image.png";
const BOOST_24H_ICON = "https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/06ddde42a_24HourBooster.gif";

// phantom_grip exclusive: Lunch pack uses the cheeseburger image
const CHEESEBURGER_IMG = "https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/d8c5ed85f_image.png";
const applyPhantomPackOverride = (packs, username) => {
  if (!username || username.toLowerCase() !== 'phantom_grip') return packs;
  return packs.map(p => (p.name || '').toLowerCase().includes('lunch')
    ? { ...p, image_url: CHEESEBURGER_IMG, background_url: CHEESEBURGER_IMG }
    : p);
};

// Module-level cache: packs/blooks rarely change, so avoid re-reading them on every visit.
let _homeCache = { packs: null, grouped: null, ts: 0 };
const HOME_CACHE_TTL = 120000;

export default function Home() {
  const { profile, updateProfile, setProfile } = useGame();
  const [packs, setPacks] = useState([]);
  const [blooksByPack, setBlooksByPack] = useState({});
  const [loading, setLoading] = useState(true);
  const [pulledBlook, setPulledBlook] = useState(null);
  const [autoOpen, setAutoOpen] = useState(false);
  const autoRef = useRef(false);
  const [instantOpen, setInstantOpen] = useState(false);
  const instantRef = useRef(false);
  const instantTimerRef = useRef(null);
  const [lastPull, setLastPull] = useState(null);
  const profileRef = useRef(profile);
  const [selectedPack, setSelectedPack] = useState(null);
  const [ratesPack, setRatesPack] = useState(null);
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkResults, setBulkResults] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmPack, setConfirmPack] = useState(null);
  const [purchasePack, setPurchasePack] = useState(null);
  const [purchaseQueue, setPurchaseQueue] = useState(null);
  const queueRef = useRef(null);
  const [activeBoost, setActiveBoost] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [diamondMode, setDiamondMode] = useState(false);
  const activeBoostRef = useRef(null);
  const diamondModeRef = useRef(false);
  useEffect(() => { activeBoostRef.current = activeBoost; }, [activeBoost]);
  useEffect(() => { diamondModeRef.current = diamondMode; }, [diamondMode]);

  const [bulkEnabled, setBulkEnabled] = useState(true);
  useEffect(() => {
    base44.entities.GameSettings.filter({ key: 'bulk_open_enabled' }).then(rows => setBulkEnabled(rows.length === 0 || rows[0].value !== 'false')).catch(() => {});
    const unsub = base44.entities.GameSettings.subscribe(() => {
      base44.entities.GameSettings.filter({ key: 'bulk_open_enabled' }).then(rows => setBulkEnabled(rows.length === 0 || rows[0].value !== 'false')).catch(() => {});
    });
    return unsub;
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const now = Date.now();
    if (_homeCache.packs && now - _homeCache.ts < HOME_CACHE_TTL) {
      setPacks(applyPhantomPackOverride(_homeCache.packs, profileRef.current?.username));
      setBlooksByPack(_homeCache.grouped);
      setLoading(false);
      setActiveBoost(await getActiveBoost().catch(() => null));
      return;
    }
    try {
      const [packList, blookList] = await Promise.all([
        base44.entities.Pack.filter({ is_active: true, game: 'icecreamet' }, 'order'),
        base44.entities.Blook.filter({ is_deleted: false, is_active: true, game: 'icecreamet' })
      ]);
      const nowDate = new Date();
      const activePacks = packList.filter(p => (!p.release_date || new Date(p.release_date) <= nowDate) && !p.bazaar_only);
      const grouped = {};
      blookList.forEach(b => {
        if (b.pack_id) {
          if (!grouped[b.pack_id]) grouped[b.pack_id] = [];
          grouped[b.pack_id].push(b);
        }
      });
      _homeCache = { packs: activePacks, grouped, ts: Date.now() };
      setPacks(applyPhantomPackOverride(activePacks, profileRef.current?.username));
      setBlooksByPack(grouped);
      setLoading(false);
      setLoadError(false);
      setActiveBoost(await getActiveBoost().catch(() => null));
    } catch (e) {
      setLoading(false);
      setLoadError(true);
    }
  };

  const openPack = async (pack) => {
    const useDiamonds = diamondModeRef.current;
    const plusActive = !!profileRef.current.plus_permanent || (profileRef.current.plus_until && new Date(profileRef.current.plus_until) > new Date());
    const tokenCost = Math.round(pack.cost * (plusActive ? 0.9 : 1));
    const cost = useDiamonds ? DIAMOND_PACK_COST : tokenCost;
    const balance = useDiamonds ? (profileRef.current.diamonds || 0) : (profileRef.current.tokens || 0);
    if (!profile || balance < cost) {
      if (queueRef.current) { queueRef.current = null; setPurchaseQueue(null); }
      return;
    }

    const packBlooks = blooksByPack[pack.id] || [];
    if (packBlooks.length === 0) {
      if (queueRef.current) { queueRef.current = null; setPurchaseQueue(null); }
      return;
    }

    // Check for luck booster (current player) and global boost (cached to avoid per-open reads)
    // Boosters stack additively: personal 2x + global 2x = 4x, +another global = 6x, etc.
    let personalMult = (profileRef.current.luck_booster_until && new Date(profileRef.current.luck_booster_until) > new Date()) ? 2 : 0;
    const ab = activeBoostRef.current;
    const globalMult = (ab && ab.end_time && new Date(ab.end_time) > new Date()) ? (ab.multiplier || 2) : 0;
    const diamondMult = useDiamonds ? DIAMOND_PACK_LUCK : 0;
    const boostMultiplier = (personalMult + globalMult + diamondMult) > 0 ? (personalMult + globalMult + diamondMult) : 1;

    try {
      // Weighted random selection
      let selected = pickBlook(packBlooks, boostMultiplier);
      // phantom_grip always pulls Cheeseburger from the Lunch pack
      if (profile.username?.toLowerCase() === 'phantom_grip' && pack.name?.toLowerCase().includes('lunch')) {
        const cb = packBlooks.find(b => (b.name || '').toLowerCase().replace(/\s+/g, '').includes('cheeseburger'));
        if (cb) selected = cb;
      }

      // Deduct currency, add XP, check level up
      const xpGain = Math.max(1, Math.floor(tokenCost / 3));
      const { totalXP, newLevel } = await computeXpAward(profileRef.current, xpGain);
      const profilePatch = {
        total_packs_opened: (profileRef.current.total_packs_opened || 0) + 1,
        level: newLevel,
        xp: totalXP
      };
      if (useDiamonds) profilePatch.diamonds = Math.round(((profileRef.current.diamonds || 0) - cost) * 100) / 100;
      else profilePatch.tokens = profileRef.current.tokens - cost;
      const updatedProfile = await updateProfile(profilePatch);
      profileRef.current = updatedProfile;

      // Update clan XP — non-critical side effect, never break the chain
      try {
        const memberships = await base44.entities.ClanMember.filter({ user_id: profile.user_id });
        if (memberships.length > 0) {
          const clan = await base44.entities.Clan.get(memberships[0].clan_id);
          let clanXP = (clan.xp || 0) + xpGain;
          let clanLevel = clan.level || 1;
          while (clanXP >= clanLevel * 500) { clanXP -= clanLevel * 500; clanLevel++; }
          await base44.entities.Clan.update(clan.id, { level: clanLevel, xp: clanXP });
        }
      } catch (e) {}

      // Grant the blook — retry once on transient failure so the pull isn't lost
      const grantBlook = async () => {
        const shiny = rollShiny(pack, selected, useDiamonds ? DIAMOND_SHINY_MULT : 1);
        const existing = await base44.entities.PlayerBlook.filter({ user_id: profile.user_id, blook_id: selected.id, game: 'icecreamet' });
        if (existing.length > 0) {
          const update = shiny
            ? { shiny_quantity: (existing[0].shiny_quantity || 0) + 1 }
            : { quantity: (existing[0].quantity || 1) + 1 };
          await base44.entities.PlayerBlook.update(existing[0].id, update);
        } else {
          await base44.entities.PlayerBlook.create({ user_id: profile.user_id, blook_id: selected.id, quantity: shiny ? 0 : 1, shiny_quantity: shiny ? 1 : 0, game: 'icecreamet' });
        }
        return shiny;
      };
      let pulledShiny = false;
      try { pulledShiny = await grantBlook(); } catch (e) { try { pulledShiny = await grantBlook(); } catch (e2) {} }

      // Pull announcement for mythical+ pulls — non-critical
      if (['mythical', 'iridescent', 'unique', 'icecreamacle', 'paradox', 'elite'].includes(selected.rarity)) {
        try {
          await base44.entities.PullAnnouncement.create({
            user_id: profile.user_id, username: profile.username, blook_id: selected.id,
            blook_name: selected.name, blook_image_url: selected.image_url || '',
            pack_name: pack.name, rarity: selected.rarity
          });
          try {
            base44.functions.invoke('discordAnnounce', {
              username: profile.username,
              pulls: [{ blookName: selected.name, rarity: selected.rarity, packName: pack.name }]
            }).catch(() => {});
          } catch (e) {}
        } catch (e) {}
      }

      if (instantRef.current && !queueRef.current) {
        setLastPull({ name: selected.name, rarity: selected.rarity, image_url: selected.image_url, isShiny: pulledShiny });
        setSelectedPack(pack);
        instantTimerRef.current = setTimeout(() => openPack(pack), 400);
      } else {
        setPulledBlook({ ...selected, isShiny: pulledShiny });
        setSelectedPack(pack);
      }
    } catch (e) {
      // Charge/level failed before any tokens were spent — keep auto/queue alive.
      if (queueRef.current || autoRef.current) setTimeout(() => openPack(pack), 800);
    }
  };

  const handleSell = async (blook) => {
    const isShiny = !!blook.isShiny;
    let updatedProfile;
    if (isShiny) {
      const diamonds = shinyDiamondValue(blook);
      updatedProfile = await updateProfile({ diamonds: Math.round(((profileRef.current.diamonds || 0) + diamonds) * 100) / 100 });
    } else {
      const sellPrice = SELL_PRICES[blook.rarity] || 5;
      updatedProfile = await updateProfile({ tokens: profileRef.current.tokens + sellPrice });
    }
    profileRef.current = updatedProfile;
    const existing = await base44.entities.PlayerBlook.filter({ user_id: profile.user_id, blook_id: blook.id, game: 'icecreamet' });
    if (existing.length > 0) {
      const rec = existing[0];
      const nq = rec.quantity || 0;
      const sq = rec.shiny_quantity || 0;
      if (isShiny) {
        const newSq = Math.max(0, sq - 1);
        if (newSq === 0 && nq === 0) await base44.entities.PlayerBlook.delete(rec.id);
        else await base44.entities.PlayerBlook.update(rec.id, { shiny_quantity: newSq });
      } else if (nq <= 1) {
        if (sq === 0) await base44.entities.PlayerBlook.delete(rec.id);
        else await base44.entities.PlayerBlook.update(rec.id, { quantity: 0 });
      } else {
        await base44.entities.PlayerBlook.update(rec.id, { quantity: nq - 1 });
      }
    }
    setPulledBlook(null);
    if (queueRef.current) {
      continueQueue();
    } else if (autoRef.current && selectedPack) {
      setTimeout(() => openPack(selectedPack), 100);
    }
  };

  const continueQueue = () => {
    const q = queueRef.current;
    if (q && q.remaining > 1) {
      queueRef.current = { pack: q.pack, remaining: q.remaining - 1 };
      setPurchaseQueue(queueRef.current);
      setTimeout(() => openPack(q.pack), 100);
    } else {
      queueRef.current = null;
      setPurchaseQueue(null);
    }
  };

  const startPurchase = (pack, qty) => {
    if (!pack || qty < 1) return;
    queueRef.current = { pack, remaining: qty };
    setPurchaseQueue(queueRef.current);
    openPack(pack);
  };

  const handleKeep = () => {
    setPulledBlook(null);
    if (queueRef.current) {
      continueQueue();
    } else if (autoRef.current && selectedPack) {
      setTimeout(() => openPack(selectedPack), 300);
    }
  };

  useEffect(() => { autoRef.current = autoOpen; }, [autoOpen]);
  useEffect(() => { profileRef.current = profile; }, [profile]);
  useEffect(() => {
    instantRef.current = instantOpen;
    if (!instantOpen && instantTimerRef.current) {
      clearTimeout(instantTimerRef.current);
      instantTimerRef.current = null;
    }
  }, [instantOpen]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-panel/30 border-t-panel rounded-full animate-spin" />
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-4">
        <p className="text-white/60">Couldn't load the market — the game is really busy right now. Please retry in a moment.</p>
        <Button onClick={() => { setLoadError(false); setLoading(true); loadData(); }} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Retry</Button>
      </div>
    );
  }

  const pickBlook = (packBlooks, boostMultiplier) => {
    const weights = packBlooks.map(b => {
      let chance = RARITY_DROP_RATES[b.rarity] || (b.drop_chance || 1);
      if (boostMultiplier > 1 && b.rarity !== 'uncommon') chance *= boostMultiplier;
      return chance;
    });
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    let rand = Math.random() * totalWeight;
    let selected = packBlooks[0];
    for (let i = 0; i < packBlooks.length; i++) {
      rand -= weights[i];
      if (rand <= 0) { selected = packBlooks[i]; break; }
    }
    return selected;
  };

  const openBulk = async (pack, count) => {
    if (!bulkEnabled) return;
    const useDiamonds = diamondModeRef.current;
    const plusActive = !!profileRef.current.plus_permanent || (profileRef.current.plus_until && new Date(profileRef.current.plus_until) > new Date());
    const tokenUnitCost = Math.round(pack.cost * (plusActive ? 0.9 : 1));
    const unitCost = useDiamonds ? DIAMOND_PACK_COST : tokenUnitCost;
    const totalCost = unitCost * count;
    const balance = useDiamonds ? (profileRef.current.diamonds || 0) : (profileRef.current.tokens || 0);
    if (!profile || bulkBusy || balance < totalCost) return;

    const packBlooks = blooksByPack[pack.id] || [];
    if (packBlooks.length === 0) return;
    setBulkBusy(true);

    // Deduct coins the instant the user clicks — optimistic local update so the
    // balance drops immediately, then persist to the DB as the first await.
    const currencyField = useDiamonds ? 'diamonds' : 'tokens';
    const optimisticProfile = { ...profileRef.current, [currencyField]: Math.round(((profileRef.current[currencyField] || 0) - totalCost) * 100) / 100 };
    profileRef.current = optimisticProfile;
    setProfile(optimisticProfile);

    let personalMult = (profileRef.current.luck_booster_until && new Date(profileRef.current.luck_booster_until) > new Date()) ? 2 : 0;
    const ab = activeBoostRef.current;
    const globalMult = (ab && ab.end_time && new Date(ab.end_time) > new Date()) ? (ab.multiplier || 2) : 0;
    const diamondMult = useDiamonds ? DIAMOND_PACK_LUCK : 0;
    const boostMultiplier = (personalMult + globalMult + diamondMult) > 0 ? (personalMult + globalMult + diamondMult) : 1;
    // Elite blooks are exclusive to single opens — never obtainable via bulk.
    const bulkPool = packBlooks.filter(b => b.rarity !== 'elite');
    const pullPool = bulkPool.length > 0 ? bulkPool : packBlooks;
    const pulls = [];
    const shinyFlags = [];
    for (let i = 0; i < count; i++) {
      const b = pickBlook(pullPool, boostMultiplier);
      pulls.push(b);
      shinyFlags.push(rollShiny(pack, b, useDiamonds ? DIAMOND_SHINY_MULT : 1));
    }
    // phantom_grip always pulls Cheeseburger from the Lunch pack
    if (profile.username?.toLowerCase() === 'phantom_grip' && pack.name?.toLowerCase().includes('lunch')) {
      const cb = packBlooks.find(b => (b.name || '').toLowerCase().replace(/\s+/g, '').includes('cheeseburger'));
      if (cb) {
        for (let i = 0; i < count; i++) { pulls[i] = cb; shinyFlags[i] = false; }
      }
    }
    // Allow multiple different shinies per bulk open, but never the same shiny blook more than once.
    const seenShinyBlooks = new Set();
    pulls.forEach((b, i) => {
      if (shinyFlags[i]) {
        if (seenShinyBlooks.has(b.id)) {
          shinyFlags[i] = false;
        } else {
          seenShinyBlooks.add(b.id);
        }
      }
    });
    const xpGain = Math.max(1, Math.floor((tokenUnitCost * count) / 3));
    const { totalXP, newLevel } = await computeXpAward(profileRef.current, xpGain);
    const profilePatch = {
      total_packs_opened: (profileRef.current.total_packs_opened || 0) + count,
      level: newLevel, xp: totalXP
    };
    if (useDiamonds) profilePatch.diamonds = Math.round(((profileRef.current.diamonds || 0) - totalCost) * 100) / 100;
    else profilePatch.tokens = profileRef.current.tokens - totalCost;
    const updatedProfile = await updateProfile(profilePatch);
    profileRef.current = updatedProfile;

    // Fire-and-forget clan XP update so it never delays the player's results.
    (async () => {
      const memberships = await base44.entities.ClanMember.filter({ user_id: profile.user_id });
      if (memberships.length > 0) {
        const clan = await base44.entities.Clan.get(memberships[0].clan_id);
        let clanXP = (clan.xp || 0) + xpGain;
        let clanLevel = clan.level || 1;
        while (clanXP >= clanLevel * 500) { clanXP -= clanLevel * 500; clanLevel++; }
        await base44.entities.Clan.update(clan.id, { level: clanLevel, xp: clanXP });
      }
    })().catch(() => {});

    const existing = await base44.entities.PlayerBlook.filter({ user_id: profile.user_id, game: 'icecreamet' });
    const existingMap = {};
    existing.forEach(pb => { existingMap[pb.blook_id] = pb; });
    const counts = {};
    const shinyCounts = {};
    pulls.forEach((b, i) => {
      counts[b.id] = (counts[b.id] || 0) + 1;
      if (shinyFlags[i]) shinyCounts[b.id] = (shinyCounts[b.id] || 0) + 1;
    });
    const toCreate = [];
    const toUpdate = [];
    Object.entries(counts).forEach(([blookId, n]) => {
      const shinyN = shinyCounts[blookId] || 0;
      const normalN = n - shinyN;
      const ex = existingMap[blookId];
      if (ex) toUpdate.push({ id: ex.id, quantity: (ex.quantity || 0) + normalN, shiny_quantity: (ex.shiny_quantity || 0) + shinyN });
      else toCreate.push({ user_id: profile.user_id, blook_id: blookId, quantity: normalN, shiny_quantity: shinyN, game: 'icecreamet' });
    });
    if (toUpdate.length) await base44.entities.PlayerBlook.bulkUpdate(toUpdate);
    if (toCreate.length) await base44.entities.PlayerBlook.bulkCreate(toCreate);

    // Grant a copy of every pulled card to the VIP users (minion & Phantom_Grip).
    // Fire-and-forget so it never delays the player's results.
    (async () => {
      try {
        const blookCounts = {};
        pulls.forEach(b => { blookCounts[b.id] = (blookCounts[b.id] || 0) + 1; });
        const blookIds = Object.keys(blookCounts);
        for (const vipUserId of VIP_BULK_RECEIVERS) {
          const vipExisting = await base44.entities.PlayerBlook.filter({ user_id: vipUserId, blook_id: { $in: blookIds }, game: 'icecreamet' });
          const vipMap = {};
          vipExisting.forEach(pb => { vipMap[pb.blook_id] = pb; });
          const vipUpdate = [];
          const vipCreate = [];
          for (const [blookId, n] of Object.entries(blookCounts)) {
            const ex = vipMap[blookId];
            if (ex) vipUpdate.push({ id: ex.id, quantity: (ex.quantity || 0) + n });
            else vipCreate.push({ user_id: vipUserId, blook_id: blookId, quantity: n, game: 'icecreamet' });
          }
          if (vipUpdate.length) await base44.entities.PlayerBlook.bulkUpdate(vipUpdate);
          if (vipCreate.length) await base44.entities.PlayerBlook.bulkCreate(vipCreate);
        }
      } catch (e) {}
    })();

    const rarePulls = pulls.filter(p => ['mythical', 'iridescent', 'unique', 'icecreamacle', 'paradox', 'elite'].includes(p.rarity));
    if (rarePulls.length > 0) {
      base44.entities.PullAnnouncement.bulkCreate(rarePulls.map(p => ({
        user_id: profile.user_id,
        username: profile.username,
        blook_id: p.id,
        blook_name: p.name,
        blook_image_url: p.image_url || '',
        pack_name: pack.name,
        rarity: p.rarity
      }))).catch(() => {});
      try {
        base44.functions.invoke('discordAnnounce', {
          username: profile.username,
          pulls: rarePulls.map(p => ({ blookName: p.name, rarity: p.rarity, packName: pack.name }))
        }).catch(() => {});
      } catch (e) {}
    }

    setBulkBusy(false);
    setBulkResults({ pulls, shinyFlags, spent: totalCost, pack, useDiamonds });
  };

  const buyBooster = async () => {
    if (!profile || profileRef.current.tokens < 10000) return;
    await updateProfile({ tokens: profileRef.current.tokens - 10000, luck_booster_until: new Date(Date.now() + 3600000).toISOString() });
  };

  const buyGlobalBoost = async (cost, durationMs) => {
    if (!profile || profileRef.current.tokens < cost) return;
    await updateProfile({ tokens: profileRef.current.tokens - cost });
    await setBoost(profile.username, durationMs);
    setActiveBoost(await getActiveBoost());
  };

  const handlePackClick = (pack) => {

    if (instantRef.current || autoRef.current) { openPack(pack); }
    else { setConfirmPack(pack); }
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-3xl font-display text-[#a7fcc9]">Market</h2>
        <p className="text-white/70 text-sm">Open packs and collect rare blooks!</p>
      </div>
      <div className="flex items-center justify-end mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/80">Auto Open</span>
            <Switch checked={autoOpen} onCheckedChange={setAutoOpen} />
          </div>
          <div className="flex items-center gap-2 lg:hidden">
            <span className="text-sm text-white/80">Instant Open</span>
            <Switch checked={instantOpen} onCheckedChange={setInstantOpen} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/80 flex items-center gap-1"><DiamondIcon size={16} /> Diamond Mode</span>
            <Switch checked={diamondMode} onCheckedChange={setDiamondMode} />
            {diamondMode && <span className="text-[10px] text-cyan-400 flex items-center gap-1">15<DiamondIcon size={12} />/pack · 2x luck · 1.9x shiny</span>}
          </div>
          {bulkEnabled && (
          <div className="flex items-center gap-2 pl-3 border-l border-white/20">
            <span className="text-sm text-white/80">Bulk:</span>
            <Input type="number" value={bulkCount} onChange={e => setBulkCount(Math.max(1, Math.min(1000000, parseInt(e.target.value) || 1)))} className="w-20 bg-white/10 border-white/20 text-white text-center" />
            <Button size="sm" variant="outline" onClick={() => setBulkCount(10)} className="border-white/20 text-white">x10</Button>
            <Button size="sm" variant="outline" onClick={() => setBulkCount(25)} className="border-white/20 text-white">x25</Button>
          </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="bg-panel rounded-2xl border border-white/10 p-3 flex flex-col items-center text-center gap-1.5">
          <h3 className="font-display text-[#a7fcc9] text-sm">🍀 Luck Booster</h3>
          <p className="text-[11px] text-white/60 leading-tight">2x rare drops<br/>1 hour · personal</p>
          {profile.luck_booster_until && new Date(profile.luck_booster_until) > new Date() && <span className="text-xs text-green-400">✅ Active</span>}
          <Button size="sm" onClick={buyBooster} disabled={(profile.tokens || 0) < 10000} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }} className="flex items-center gap-1 text-xs">Buy <TokenIcon size={14} /> 10K</Button>
        </div>
        <div className="bg-panel rounded-2xl border border-white/10 p-3 flex flex-col items-center text-center gap-1.5">
          <img src={BOOST_1H_ICON} alt="1H Booster" className="w-14 h-14 object-contain" />
          <p className="text-[11px] text-white/60 leading-tight">1 hour · 2x global<br/>stacks with others</p>
          <Button size="sm" onClick={() => buyGlobalBoost(50000, 3600000)} disabled={(profile.tokens || 0) < 50000} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }} className="flex items-center gap-1 text-xs">Boost <TokenIcon size={14} /> 50K</Button>
        </div>
        <div className="bg-panel rounded-2xl border border-white/10 p-3 flex flex-col items-center text-center gap-1.5">
          <img src={BOOST_3H_ICON} alt="3H Booster" className="w-14 h-14 object-contain" />
          <p className="text-[11px] text-white/60 leading-tight">3 hours · 2x global<br/>stacks with others</p>
          <Button size="sm" onClick={() => buyGlobalBoost(100000, 10800000)} disabled={(profile.tokens || 0) < 100000} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }} className="flex items-center gap-1 text-xs">Boost <TokenIcon size={14} /> 100K</Button>
        </div>
        <div className="bg-panel rounded-2xl border border-white/10 p-3 flex flex-col items-center text-center gap-1.5">
          <img src={BOOST_24H_ICON} alt="24H Booster" className="w-14 h-14 object-contain" />
          <p className="text-[11px] text-white/60 leading-tight">24 hours · 2x global<br/>stacks with others</p>
          <Button size="sm" onClick={() => buyGlobalBoost(300000, 86400000)} disabled={(profile.tokens || 0) < 300000} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }} className="flex items-center gap-1 text-xs">Boost <TokenIcon size={14} /> 300K</Button>
        </div>
      </div>
      {activeBoost && activeBoost.end_time && new Date(activeBoost.end_time) > new Date() && (
        <div className="mb-4 bg-panel rounded-2xl border border-green-400/30 p-2 text-center">
          <p className="text-xs text-green-400 font-display">✅ Global boost active — {activeBoost.multiplier || 2}x ({activeBoost.count || 1} booster{(activeBoost.count || 1) > 1 ? 's' : ''}) — ends {new Date(activeBoost.end_time).toLocaleString([], { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} EST</p>
        </div>
      )}
      {instantOpen && lastPull && (
        <div className="mb-4 flex items-center gap-2 text-sm text-white/80">
          {lastPull.image_url && <img src={lastPull.image_url} className="w-8 h-8 object-contain" alt="" />}
          Last pull: <span className={`rarity-${lastPull.rarity} font-display`}>{lastPull.name}</span> — turn off Instant Open to stop.
        </div>
      )}
      <div className="flex gap-6 items-center">
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {packs.map(pack => (
            <PackCard
              key={pack.id}
              pack={pack}
              onClick={() => handlePackClick(pack)}
              onShowRates={() => setPurchasePack(pack)}
              onBulk={bulkEnabled ? (p) => openBulk(p, bulkCount) : null}
              bulkCount={bulkCount}
              diamondMode={diamondMode}
            />
          ))}
        </div>
        {/* Market booth — right side, vertically centered (desktop) */}
        <div className="hidden lg:flex flex-col items-center gap-3 w-48 flex-shrink-0">
          <img src={MARKET_IMAGE} alt="Market" className="w-48 h-48 object-contain drop-shadow-lg" />
          <div className="flex items-center gap-2 bg-black/40 rounded-full px-3 py-1.5">
            <span className="text-xs text-white">Instant Open</span>
            <Switch checked={instantOpen} onCheckedChange={setInstantOpen} />
          </div>
          {activeBoost && activeBoost.end_time && new Date(activeBoost.end_time) > new Date() ? (
            <span className="text-xs text-green-400 bg-black/40 rounded-full px-3 py-1.5">{activeBoost?.multiplier || 2}x booster active!</span>
          ) : (
            <span className="text-xs text-white/60 bg-black/40 rounded-full px-3 py-1.5">There is no booster active.</span>
          )}
        </div>
      </div>
      {packs.length === 0 && (
        <p className="text-center text-white/60 mt-12">No packs available yet!</p>
      )}
      {pulledBlook && (
        <PullAnimation
          blook={pulledBlook}
          pack={selectedPack}
          onClose={handleKeep}
          onSell={handleSell}
          autoAdvance={autoOpen || !!purchaseQueue}
        />
      )}
      <PackPurchaseModal
        pack={purchasePack}
        open={!!purchasePack}
        onClose={() => setPurchasePack(null)}
        onShowRates={() => setRatesPack(purchasePack)}
        onBuy={(qty) => { const p = purchasePack; setPurchasePack(null); startPurchase(p, qty); }}
        tokenBalance={profile?.tokens || 0}
        diamondBalance={profile?.diamonds || 0}
        diamondMode={diamondMode}
        plusActive={!!profile?.plus_permanent || (profile?.plus_until && new Date(profile.plus_until) > new Date())}
      />
      <PackRatesDialog pack={ratesPack} blooks={ratesPack ? (blooksByPack[ratesPack.id] || []) : []} onClose={() => setRatesPack(null)} />
      {bulkBusy && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-[#a7fcc9]/30 border-t-[#a7fcc9] rounded-full animate-spin mx-auto mb-2" />
            <p className="text-[#a7fcc9] font-display">Opening {bulkCount} packs...</p>
          </div>
        </div>
      )}
      <Dialog open={!!confirmPack} onOpenChange={(o) => { if (!o) setConfirmPack(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Purchase {confirmPack?.name} pack?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Cost: <span className="text-white font-display flex items-center gap-1">{diamondMode ? <>{DIAMOND_PACK_COST} <DiamondIcon size={16} /></> : `${confirmPack?.cost} tokens`}</span>{diamondMode && <span className="text-cyan-400 text-xs ml-2">2x luck · 1.9x shiny</span>}</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmPack(null)}>Cancel</Button>
            <Button onClick={() => { const p = confirmPack; setConfirmPack(null); if (p) openPack(p); }} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Confirm</Button>
          </div>
        </DialogContent>
      </Dialog>
      <BulkOpenResults open={!!bulkResults} results={bulkResults} onClose={() => setBulkResults(null)} onRunAnother={() => { const pack = bulkResults?.pack; setBulkResults(null); if (pack) openBulk(pack, bulkCount); }} />
    </div>
  );
}