export function applyMarketPatches(t) {
  // Resilient market load
  t = t.replace(
    `      const [packList, blookList] = await Promise.all([
        base44.entities.Pack.filter({ is_active: true, game: 'icecreamet' }, 'order'),
        base44.entities.Blook.filter({ is_deleted: false, is_active: true, game: 'icecreamet' })
      ]);`,
    `      let packList = [], blookList = [];
      try {
        [packList, blookList] = await Promise.all([
          base44.entities.Pack.filter({ is_active: true, game: 'icecreamet' }, 'order'),
          base44.entities.Blook.filter({ is_deleted: false, is_active: true, game: 'icecreamet' })
        ]);
      } catch (e1) {
        try {
          [packList, blookList] = await Promise.all([
            base44.entities.Pack.filter({ is_active: true }, 'order'),
            base44.entities.Blook.filter({ is_deleted: false })
          ]);
          packList = (packList || []).filter(p => !p.game || p.game === 'icecreamet');
          blookList = (blookList || []).filter(b => !b.game || b.game === 'icecreamet');
        } catch (e2) {
          packList = await base44.entities.Pack.list('order').catch(() => []);
          blookList = await base44.entities.Blook.list().catch(() => []);
          packList = (packList || []).filter(p => p && p.is_active !== false && (!p.game || p.game === 'icecreamet'));
          blookList = (blookList || []).filter(b => b && !b.is_deleted && (!b.game || b.game === 'icecreamet'));
        }
      }
      packList = packList || [];
      blookList = blookList || [];
      // Ensure pack fronts always have a usable image URL
      packList = packList.map(p => {
        if (!p) return p;
        const front = p.image_url || p.background_url || p.image || p.cover_url || '';
        const bg = p.background_url || p.image_url || '';
        return { ...p, image_url: front || p.image_url, background_url: bg || p.background_url };
      });`
  )
  t = t.replace(
    `    } catch (e) {
      setLoading(false);
      setLoadError(true);
    }
  };

  const openPack = async (pack) => {`,
    `    } catch (e) {
      if (_homeCache.packs) {
        setPacks(applyPhantomPackOverride(_homeCache.packs, profileRef.current?.username));
        setBlooksByPack(_homeCache.grouped || {});
        setLoadError(false);
      } else {
        setLoadError(true);
      }
      setLoading(false);
    }
  };

  const openPack = async (pack) => {`
  )

  // Unlimited packs for everyone — lag-free statistical opens
  if (!t.includes('MAX_PACKS_PER_OPEN')) {
    t = t.replace(
      '  const [bulkCount, setBulkCount] = useState(10);',
      '  const [bulkCount, setBulkCount] = useState(10);\n  const MAX_PACKS_PER_OPEN = 1e15; // any amount you can afford'
    )
  } else {
    t = t.replace(/const MAX_PACKS_PER_OPEN = [^;]+;/, 'const MAX_PACKS_PER_OPEN = 1e15; // any amount you can afford')
  }

  if (!t.includes('bulkSampleCounts')) {
    const helpers = `
  const binomialSample = (n, p) => {
    if (n <= 0 || p <= 0) return 0;
    if (p >= 1) return n;
    n = Math.floor(n);
    if (n < 80) {
      let c = 0;
      for (let i = 0; i < n; i++) if (Math.random() < p) c++;
      return c;
    }
    const mean = n * p;
    const std = Math.sqrt(Math.max(0, n * p * (1 - p)));
    const u1 = Math.random() || 1e-12;
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.max(0, Math.min(n, Math.round(mean + std * z)));
  };
  const bulkSampleCounts = (pool, boostMultiplier, count) => {
    const weights = pool.map(b => {
      let chance = RARITY_DROP_RATES[b.rarity] || (b.drop_chance || 1);
      if (boostMultiplier > 1 && b.rarity !== 'uncommon') chance *= boostMultiplier;
      return Math.max(0, chance);
    });
    let remaining = Math.floor(count);
    let weightLeft = weights.reduce((s, w) => s + w, 0);
    const counts = {};
    for (let i = 0; i < pool.length; i++) {
      const id = pool[i].id;
      if (remaining <= 0) { counts[id] = counts[id] || 0; continue; }
      if (i === pool.length - 1) { counts[id] = (counts[id] || 0) + remaining; break; }
      const p = weightLeft > 0 ? weights[i] / weightLeft : 0;
      const n = binomialSample(remaining, p);
      counts[id] = (counts[id] || 0) + n;
      remaining -= n;
      weightLeft -= weights[i];
    }
    return counts;
  };

`
    t = t.replace(
      '  const pickBlook = (packBlooks, boostMultiplier) => {',
      helpers + '  const pickBlook = (packBlooks, boostMultiplier) => {'
    )
  }

  t = t.replace(
    /const startPurchase = \(pack, qty\) => \{\s*if \(!pack \|\| qty < 1\) return;\s*queueRef\.current = \{ pack, remaining: qty \};\s*setPurchaseQueue\(queueRef\.current\);\s*openPack\(pack\);\s*\};/,
    `const startPurchase = (pack, qty) => {
    if (!pack || qty < 1) return;
    const n = Math.min(Math.max(1, Math.floor(Number(qty) || 1)), MAX_PACKS_PER_OPEN);
    if (n > 1) { openBulk(pack, n); return; }
    queueRef.current = { pack, remaining: 1 };
    setPurchaseQueue(queueRef.current);
    openPack(pack);
  };`
  )

  t = t.replace(
    /const handlePackClick = \(pack\) => \{[\s\S]*?if \(instantRef\.current \|\| autoRef\.current\) \{ openPack\(pack\); \}\s*else \{ setConfirmPack\(pack\); \}\s*\};/,
    `const handlePackClick = (pack) => {
    if (instantRef.current || autoRef.current) { openPack(pack); }
    else { setPurchasePack(pack); }
  };`
  )

  const oldHead = `  const openBulk = async (pack, count) => {
    if (!bulkEnabled) return;
    const useDiamonds = diamondModeRef.current;
    const plusActive = !!profileRef.current.plus_permanent || (profileRef.current.plus_until && new Date(profileRef.current.plus_until) > new Date());
    const tokenUnitCost = Math.round(pack.cost * (plusActive ? 0.9 : 1));
    const unitCost = useDiamonds ? DIAMOND_PACK_COST : tokenUnitCost;
    const totalCost = unitCost * count;
    const balance = useDiamonds ? (profileRef.current.diamonds || 0) : (profileRef.current.tokens || 0);
    if (!profile || bulkBusy || balance < totalCost) return;`

  const newHead = `  const openBulk = async (pack, count) => {
    const useDiamonds = diamondModeRef.current;
    const plusActive = !!profileRef.current.plus_permanent || (profileRef.current.plus_until && new Date(profileRef.current.plus_until) > new Date());
    const tokenUnitCost = Math.round(Number(pack.cost) * (plusActive ? 0.9 : 1));
    const unitCost = useDiamonds ? DIAMOND_PACK_COST : tokenUnitCost;
    const balance = useDiamonds ? (profileRef.current.diamonds || 0) : Math.floor(Number(profileRef.current.tokens) || 0);
    const maxAffordable = unitCost > 0 ? Math.floor(balance / unitCost) : 0;
    if (count < 1 || count === -1) count = maxAffordable;
    count = Math.min(Math.max(0, Math.floor(Number(count) || 0)), maxAffordable, MAX_PACKS_PER_OPEN);
    if (count < 1) return;
    const totalCost = unitCost * count;
    if (!profile || bulkBusy || balance < totalCost) return;`

  if (t.includes(oldHead)) t = t.replace(oldHead, newHead)

  const oldLoop = `    const pulls = [];
    const shinyFlags = [];
    for (let i = 0; i < count; i++) {
      const b = pickBlook(pullPool, boostMultiplier);
      pulls.push(b);
      shinyFlags.push(rollShiny(pack, b, useDiamonds ? DIAMOND_SHINY_MULT : 1));
    }`

  const newLoop = `    let counts = {};
    let shinyCounts = {};
    const pulls = [];
    const shinyFlags = [];
    const STAT_THRESHOLD = 200;
    if (count > STAT_THRESHOLD) {
      // Instant for millions/trillions — O(pool size), not O(count)
      counts = bulkSampleCounts(pullPool, boostMultiplier, count);
      const shinyMult = useDiamonds ? DIAMOND_SHINY_MULT : 1;
      const shinyChance = Math.min(0.5, 0.05 * shinyMult);
      const idToBlook = {};
      pullPool.forEach(b => { idToBlook[b.id] = b; });
      Object.entries(counts).forEach(([id, n]) => {
        if (n > 0) {
          const sn = binomialSample(Math.min(n, 1e9), shinyChance);
          if (sn > 0) shinyCounts[id] = Math.min(sn, 1);
        }
      });
      const SAMPLE = 48;
      for (const [id, n] of Object.entries(counts)) {
        const b = idToBlook[id];
        if (!b || !n) continue;
        const take = Math.min(n, Math.max(1, Math.floor(SAMPLE / Math.max(1, Object.keys(counts).length))));
        for (let i = 0; i < take && pulls.length < SAMPLE; i++) {
          pulls.push(b);
          shinyFlags.push(i === 0 && !!shinyCounts[id]);
        }
      }
    } else {
      for (let i = 0; i < count; i++) {
        const b = pickBlook(pullPool, boostMultiplier);
        pulls.push(b);
        shinyFlags.push(rollShiny(pack, b, useDiamonds ? DIAMOND_SHINY_MULT : 1));
      }
    }`

  if (t.includes(oldLoop)) t = t.replace(oldLoop, newLoop)

  const dupCounts = `    const counts = {};
    const shinyCounts = {};
    pulls.forEach((b, i) => {
      counts[b.id] = (counts[b.id] || 0) + 1;
      if (shinyFlags[i]) shinyCounts[b.id] = (shinyCounts[b.id] || 0) + 1;
    });`
  const fixDup = `    if (count <= 200) {
      counts = {};
      shinyCounts = {};
      pulls.forEach((b, i) => {
        counts[b.id] = (counts[b.id] || 0) + 1;
        if (shinyFlags[i]) shinyCounts[b.id] = (shinyCounts[b.id] || 0) + 1;
      });
    }`
  if (t.includes(dupCounts)) t = t.replace(dupCounts, fixDup)

  t = t.replace(
    `    if (useDiamonds) profilePatch.diamonds = Math.round(((profileRef.current.diamonds || 0) - totalCost) * 100) / 100;
    else profilePatch.tokens = profileRef.current.tokens - totalCost;`,
    `    if (useDiamonds) profilePatch.diamonds = Math.max(0, Math.round((balance - totalCost) * 100) / 100);
    else profilePatch.tokens = Math.max(0, balance - totalCost);`
  )
  t = t.replace(
    `    const optimisticProfile = { ...profileRef.current, [currencyField]: Math.round(((profileRef.current[currencyField] || 0) - totalCost) * 100) / 100 };`,
    `    const newBal = useDiamonds ? Math.max(0, Math.round((balance - totalCost) * 100) / 100) : Math.max(0, balance - totalCost);
    const optimisticProfile = { ...profileRef.current, [currencyField]: newBal };`
  )

  t = t.replace(
    /setBulkCount\(Math\.max\(1, Math\.min\(1000000, parseInt\(e\.target\.value\) \|\| 1\)\)\)/,
    'setBulkCount(Math.max(1, Math.min(MAX_PACKS_PER_OPEN, parseInt(e.target.value, 10) || 1)))'
  )

  return t
}
