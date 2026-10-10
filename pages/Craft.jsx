import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { RARITY_ORDER, MEGA_CHARIZARD_BLOOK_ID, TROPHY_BLOOKS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Hammer, Search, Plus, X } from 'lucide-react';

const TROPHY_IDS = new Set([...Object.values(TROPHY_BLOOKS), MEGA_CHARIZARD_BLOOK_ID]);
const CRAFT_COST = 50;
const LUCK_MULT = 2.5;
const MIN_ING = 2;
const MAX_ING = 5;

const rarityIndex = (r) => { const i = RARITY_ORDER.indexOf(r); return i < 0 ? 0 : i; };
// Fixed tiny weights for chroma+ so their craft chance stays at/below ~0.01%,
// each higher rarity rarer than the last. Lower tiers use the dynamic factor.
const CHROMA_PLUS_WEIGHT = {
  chroma: 0.0001,        // ~0.01%
  supreme: 0.00005,      // ~0.005%
  mythical: 0.00002,    // ~0.002%
  iridescent: 0.00001,  // ~0.001%
  unique: 0.000005,    // ~0.0005%
  icecreamacle: 0.000002, // ~0.0002%
  paradox: 0.000001      // ~0.0001%
};
const isExcludedResultPack = (pack) => {
  const n = (pack?.name || '').toLowerCase();
  return n.includes('golden') || n.includes('summer');
};
// Exclude blooks whose names suggest they belong to summer/golden packs even
// when the pack record is missing (pack was deleted but blook kept its name).
const isExcludedBlookName = (blook) => {
  const n = (blook?.name || '').toLowerCase();
  return n.includes('summer') || n.includes('golden') || n.includes('plush');
};
// Best result rarity index allowed for a given max-ingredient rarity index.
const resultCapFor = (maxIdx) => {
  if (maxIdx <= 0) return 2;   // uncommon  -> epic
  if (maxIdx === 1) return 3;  // rare      -> legendary
  if (maxIdx === 2) return 4;  // epic      -> chroma
  if (maxIdx === 3) return 5;  // legendary -> supreme
  if (maxIdx === 4) return 6;  // chroma    -> mythical
  return 9;                    // supreme+  -> icecreamacle
};

export default function Craft() {
  const { profile, updateProfile } = useGame();
  const [playerBlooks, setPlayerBlooks] = useState([]);
  const [allBlooks, setAllBlooks] = useState([]);
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [crafting, setCrafting] = useState(false);
  const [result, setResult] = useState(null);

  const load = async () => {
    if (!profile) return;
    try {
      const [pb, ab, pks] = await Promise.all([
        base44.entities.PlayerBlook.filter({ user_id: profile.user_id, game: 'icecreamet' }, null, 2000),
        base44.entities.Blook.filter({ is_active: true, is_deleted: false, game: 'icecreamet' }, null, 2000),
        base44.entities.Pack.filter({ game: 'icecreamet' }, 'order')
      ]);
      setPlayerBlooks(pb);
      setAllBlooks(ab);
      setPacks(pks);
      setLoading(false);
    } catch (e) {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [profile?.user_id]);

  const packMap = useMemo(() => { const m = {}; packs.forEach(p => m[p.id] = p); return m; }, [packs]);
  const blookMap = useMemo(() => { const m = {}; allBlooks.forEach(b => m[b.id] = b); return m; }, [allBlooks]);

  const ownedList = useMemo(() => {
    return playerBlooks.map(pb => {
      const b = blookMap[pb.blook_id];
      if (!b || TROPHY_IDS.has(b.id)) return null;
      if (b.pack_id && isExcludedResultPack(packMap[b.pack_id])) return null;
      if (isExcludedBlookName(b)) return null;
      return { pbId: pb.id, blookId: b.id, name: b.name, image_url: b.image_url, rarity: b.rarity, quantity: pb.quantity || 1 };
    }).filter(Boolean);
  }, [playerBlooks, blookMap, packMap]);

  const eligibleResults = useMemo(() => {
    const ingredientIds = new Set(selected.map(s => s.blookId));
    const avgIdx = selected.length ? selected.reduce((s, b) => s + rarityIndex(b.rarity), 0) / selected.length : 0;
    const floor = Math.floor(avgIdx);
    const cap = resultCapFor(floor);
    return allBlooks.filter(b => {
      if (b.craftable === false) return false;
      if (TROPHY_IDS.has(b.id)) return false;
      if (ingredientIds.has(b.id)) return false;
      if (b.pack_id && isExcludedResultPack(packMap[b.pack_id])) return false;
      if (isExcludedBlookName(b)) return false;
      if ((b.name || '').toLowerCase().includes('gojo')) return false;
      if (/icecreamy'?s birthday cake/i.test(b.name || '')) return false;
      const idx = rarityIndex(b.rarity);
      if (idx < floor) return false;
      if (idx > cap) return false;
      return true;
    });
  }, [allBlooks, packMap, selected]);

  const luckActive = !!(profile?.luck_booster_until && new Date(profile.luck_booster_until) > new Date());

  const possible = useMemo(() => {
    if (selected.length < MIN_ING || eligibleResults.length === 0) return [];
    const avgIdx = selected.reduce((s, b) => s + rarityIndex(b.rarity), 0) / selected.length;
    // Weight decreases with rarity (lower rarity = more likely). Better
    // ingredients raise the factor toward 1, flattening the curve so higher
    // results become relatively more likely — but never inverting it.
    let factor = 0.35 + avgIdx * 0.06;
    if (luckActive) factor *= 1.25;
    factor = Math.min(0.95, factor);
    const weighted = eligibleResults.map(b => {
      const idx = rarityIndex(b.rarity);
      const weight = idx < 4 ? Math.pow(factor, idx) : (CHROMA_PLUS_WEIGHT[b.rarity] || 0.000001);
      return { blook: b, weight };
    });
    const chosen = [];
    const pool = [...weighted];
    while (chosen.length < 5 && pool.length > 0) {
      const total = pool.reduce((s, w) => s + w.weight, 0);
      let r = Math.random() * total;
      let idx = 0;
      for (let i = 0; i < pool.length; i++) { r -= pool[i].weight; if (r <= 0) { idx = i; break; } }
      chosen.push(pool[idx]);
      pool.splice(idx, 1);
    }
    const totalW = chosen.reduce((s, c) => s + c.weight, 0);
    return chosen.map(c => ({ blook: c.blook, chance: c.weight / totalW }));
  }, [selected, eligibleResults, luckActive]);

  const canCraft = selected.length >= MIN_ING && selected.length <= MAX_ING && (profile?.tokens || 0) >= CRAFT_COST && possible.length > 0 && !crafting;

  const addIngredient = (item) => {
    if (selected.length >= MAX_ING) return;
    const used = selected.filter(s => s.blookId === item.blookId).length;
    if (used >= item.quantity) return;
    setSelected(prev => [...prev, item]);
  };

  const removeIngredient = (idx) => setSelected(prev => prev.filter((_, i) => i !== idx));

  const rollResult = () => {
    const total = possible.reduce((s, p) => s + p.chance, 0);
    let r = Math.random() * total;
    for (const p of possible) { r -= p.chance; if (r <= 0) return p; }
    return possible[possible.length - 1];
  };

  const doCraft = async () => {
    if (!canCraft) return;
    setCrafting(true);
    try {
      const won = rollResult();
      await updateProfile({ tokens: (profile.tokens || 0) - CRAFT_COST });
      for (const s of selected) {
        if (s.quantity > 1) {
          await base44.entities.PlayerBlook.update(s.pbId, { quantity: s.quantity - 1 });
        } else {
          await base44.entities.PlayerBlook.delete(s.pbId);
        }
      }
      const existing = playerBlooks.find(pb => pb.blook_id === won.blook.id);
      if (existing) {
        await base44.entities.PlayerBlook.update(existing.id, { quantity: (existing.quantity || 1) + 1 });
      } else {
        await base44.entities.PlayerBlook.create({ user_id: profile.user_id, blook_id: won.blook.id, quantity: 1, game: 'icecreamet' });
      }
      setResult(won);
      setSelected([]);
      await load();
    } catch (e) {
      alert('Craft failed: ' + e.message);
    }
    setCrafting(false);
  };

  if (loading || !profile) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-panel/30 border-t-panel rounded-full animate-spin" /></div>;

  const searchLower = search.toLowerCase();
  const filteredOwned = ownedList.filter(o => o.name?.toLowerCase().includes(searchLower));

  return (
    <div>
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-1">
          <Hammer className="text-[#a7fcc9]" size={28} />
          <h2 className="text-2xl font-display text-white">Craft</h2>
        </div>
        <p className="text-sm text-white/60">Put in 2 to 5 blooks — get back 1 of 5 possible blooks. Risky.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-panel rounded-2xl border border-white/10 p-4">
          <h3 className="font-display text-[#a7fcc9] mb-3">Ingredients ({selected.length}/{MAX_ING})</h3>
          <div className="grid grid-cols-5 gap-2 mb-4">
            {Array.from({ length: MAX_ING }).map((_, i) => {
              const s = selected[i];
              return (
                <button
                  key={i}
                  onClick={() => s && removeIngredient(i)}
                  className="aspect-square rounded-lg border border-white/15 bg-black/30 flex items-center justify-center relative overflow-hidden hover:border-white/30 transition-colors"
                >
                  {s ? (
                    <>
                      {s.image_url && <img src={s.image_url} alt="" className="w-full h-full object-contain p-1" />}
                      <span className="absolute top-1 right-1 bg-black/50 rounded-full p-0.5"><X size={10} className="text-white" /></span>
                    </>
                  ) : (
                    <Plus className="text-white/30" size={20} />
                  )}
                </button>
              );
            })}
          </div>

          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your blooks..." className="pl-9 bg-black/30 border-white/15 text-white placeholder:text-white/40" />
          </div>

          <div className="max-h-[420px] overflow-y-auto pr-1">
            <div className="grid grid-cols-5 gap-2">
              {filteredOwned.map(o => (
                <button
                  key={o.pbId + o.blookId}
                  onClick={() => addIngredient(o)}
                  className="aspect-square rounded-lg bg-black/30 border border-white/10 flex flex-col items-center justify-center p-1 relative hover:border-[#a7fcc9]/50 transition-colors"
                  title={o.name}
                >
                  {o.image_url ? <img src={o.image_url} alt="" className="w-full h-full object-contain" /> : <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/0d5e6b887_image.png" alt="" className="w-6 h-6 object-contain" />}
                  <span className="absolute top-1 right-1 min-w-5 px-1 rounded-full bg-[#3498db] text-white text-[9px] font-bold flex items-center justify-center">x{o.quantity}</span>
                  <span className="absolute bottom-0 inset-x-0 text-[8px] text-white/70 truncate px-0.5">{o.name}</span>
                </button>
              ))}
              {filteredOwned.length === 0 && <p className="col-span-5 text-center text-white/50 text-xs py-4">No blooks found</p>}
            </div>
          </div>
        </div>

        <div className="bg-panel rounded-2xl border border-white/10 p-4 flex flex-col">
          <h3 className="font-display text-[#a7fcc9] mb-3">Possible Results</h3>
          <div className="flex-1">
            {possible.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-white/50 py-10">
                <Hammer className="mb-2 opacity-40" size={32} />
                <p className="text-sm max-w-xs">Add blooks to see what you could craft. Every combo has its own 5 outcomes and chances.</p>
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-2">
                {possible.map((p, i) => (
                  <div key={p.blook.id + i} className="rounded-lg bg-black/30 border border-white/10 p-1 flex flex-col items-center">
                    <div className="aspect-square w-full flex items-center justify-center">
                      {p.blook.image_url ? <img src={p.blook.image_url} alt="" className="w-full h-full object-contain" /> : <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/0d5e6b887_image.png" alt="" className="w-6 h-6 object-contain" />}
                    </div>
                    <span className={`text-[9px] rarity-${p.blook.rarity} truncate w-full text-center`}>{p.blook.name}</span>
                    <span className="text-[10px] text-[#a7fcc9] font-bold">{(p.chance * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 rounded-lg p-2 flex items-center justify-between" style={{ backgroundColor: luckActive ? 'rgba(39,174,96,0.25)' : 'rgba(255,255,255,0.05)' }}>
            <span className="text-xs font-display text-white">{LUCK_MULT}x Craft Luck</span>
            <span className="text-[10px] text-white/60">{luckActive ? 'ACTIVE — boosted odds!' : 'NONE — GET IT FROM THE STARTER BUNDLE'}</span>
          </div>

          <Button onClick={doCraft} disabled={!canCraft} className="mt-3 w-full text-base font-display" style={{ backgroundColor: '#d35400', color: '#fff' }}>
            <Hammer size={18} className="mr-2" /> CRAFT — {CRAFT_COST} tokens
          </Button>
          <p className="text-[10px] text-white/50 text-center mt-2">COSTS {CRAFT_COST} TOKENS PER CRAFT. YOUR INGREDIENT BLOOKS ARE CONSUMED — WIN BIG OR LOSE THEM!</p>
        </div>
      </div>

      <Dialog open={!!result} onOpenChange={v => !v && setResult(null)}>
        <DialogContent className="bg-panel border-white/15 text-center max-w-sm">
          <h3 className="font-display text-[#a7fcc9] text-xl">You Crafted...</h3>
          {result?.blook?.image_url && <img src={result.blook.image_url} alt="" className="w-28 h-28 object-contain mx-auto my-3 animate-blook-rise" />}
          <p className={`font-display text-lg rarity-${result?.blook?.rarity}`}>{result?.blook?.name}</p>
          <p className="text-xs text-white/60 capitalize">{result?.blook?.rarity}</p>
          <Button onClick={() => setResult(null)} className="mt-4" style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Nice!</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}