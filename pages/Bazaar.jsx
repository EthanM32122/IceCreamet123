import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { SELL_PRICES, ROLE_HIERARCHY } from '@/lib/constants';
import { getAllPlayers } from '@/lib/playersCache';
import { getActiveBlooks, getPacks, getActiveBanners } from '@/lib/gameDataCache';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Bomb, Shield, Search, X } from 'lucide-react';
import { BAZAAR_RESTRICTED_BLOOK_IDS } from '@/lib/hivelands';

const RARITIES = [
  { key: 'uncommon', color: '#4ade80' },
  { key: 'rare', color: '#60a5fa' },
  { key: 'epic', color: '#a855f7' },
  { key: 'legendary', color: '#f59e0b' },
  { key: 'mythical', color: '#f472b6' },
  { key: 'chroma', color: '#00ccff' },
  { key: 'supreme', color: '#ef4444' },
  { key: 'iridescent' },
  { key: 'unique' },
  { key: 'icecreamacle' },
  { key: 'paradox' },
];

export default function Bazaar() {
  const { profile, updateProfile } = useGame();
  const [eventBlooks, setEventBlooks] = useState([]);
  const [listings, setListings] = useState([]);
  const [allBlooks, setAllBlooks] = useState([]);
  const [myBlooks, setMyBlooks] = useState([]);
  const [packs, setPacks] = useState([]);
  const [blooksByPack, setBlooksByPack] = useState({});
  const [loading, setLoading] = useState(true);
  const [listDialog, setListDialog] = useState(null);
  const [listPrice, setListPrice] = useState('');
  const [tab, setTab] = useState('blooks');
  const [banners, setBanners] = useState([]);
  const [myBanners, setMyBanners] = useState([]);
  const [players, setPlayers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [selectedPack, setSelectedPack] = useState(null);
  const [selectedRarity, setSelectedRarity] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBlook, setSelectedBlook] = useState(null);
  const [editBlookImage, setEditBlookImage] = useState('');
  const [savingImage, setSavingImage] = useState(false);
  const [seedListings, setSeedListings] = useState([]);
  const [seedQty, setSeedQty] = useState('');
  const [seedPrice, setSeedPrice] = useState('');
  const [sendDialog, setSendDialog] = useState(false);
  const [sendTarget, setSendTarget] = useState('');
  const [sendQty, setSendQty] = useState('');
  const [seedBusy, setSeedBusy] = useState(false);
  const isAdmin = profile && ROLE_HIERARCHY[profile.role] >= ROLE_HIERARCHY.admin;

  useEffect(() => { if (!profile) return; loadData(); }, [profile?.user_id]);

  const loadData = async () => {
    const [ebI, ebP, abI, abP, mb, lst, bnrs, myBnrs, allPlayers, pkI, pkP, sl] = await Promise.all([
      base44.entities.Blook.filter({ bazaar_event: true, is_active: true, game: 'icecreamet' }),
      base44.entities.Blook.filter({ bazaar_event: true, is_active: true, game: 'pokemon' }),
      getActiveBlooks('icecreamet'),
      getActiveBlooks('pokemon'),
      base44.entities.PlayerBlook.filter({ user_id: profile.user_id }),
      base44.entities.BazaarListing.filter({ status: 'active' }),
      getActiveBanners(),
      base44.entities.PlayerBanner.filter({ user_id: profile.user_id }),
      getAllPlayers().catch(() => []),
      getPacks('icecreamet'),
      getPacks('pokemon'),
      base44.entities.SeedListing.filter({ status: 'active' }).then(p => p.items || []).catch(() => [])
    ]);
    const eb = [...ebI, ...ebP];
    const ab = [...abI, ...abP];
    const pk = [...pkI, ...pkP];
    setEventBlooks(eb.filter(b => !BAZAAR_RESTRICTED_BLOOK_IDS.has(b.id)));
    setSeedListings(sl);
    setAllBlooks(ab);
    setMyBlooks(mb);
    setListings(lst);
    setBanners(bnrs);
    setMyBanners(myBnrs);
    setPlayers(allPlayers);
    setPacks(pk);
    const grouped = {};
    ab.forEach(b => { if (b.pack_id) { (grouped[b.pack_id] = grouped[b.pack_id] || []).push(b); } });
    setBlooksByPack(grouped);
    setLoading(false);
  };

  const blookMap = {};
  allBlooks.forEach(b => { blookMap[b.id] = b; });

  const buyGrenade = async () => {
    if (!profile || profile.tokens < 5000 || busy) return;
    setBusy(true);
    await updateProfile({ tokens: profile.tokens - 5000, grenades: (profile.grenades || 0) + 1 });
    setBusy(false);
    loadData();
  };

  const buyShield = async () => {
    if (!profile || profile.tokens < 3000 || busy) return;
    setBusy(true);
    await updateProfile({ tokens: profile.tokens - 3000, shields: (profile.shields || 0) + 1 });
    setBusy(false);
    loadData();
  };

  const buyEventBlook = async (blook) => {
    const price = (blook.sell_price || SELL_PRICES[blook.rarity] || 5) * 5;
    if (!profile || profile.tokens < price) return;
    // Grant the card first (re-fetch to avoid stale local state), then deduct.
    const current = await base44.entities.PlayerBlook.filter({ user_id: profile.user_id, blook_id: blook.id, game: 'icecreamet' });
    if (current.length > 0) {
      await base44.entities.PlayerBlook.update(current[0].id, { quantity: (current[0].quantity || 1) + 1 });
    } else {
      await base44.entities.PlayerBlook.create({ user_id: profile.user_id, blook_id: blook.id, quantity: 1, game: 'icecreamet' });
    }
    await updateProfile({ tokens: profile.tokens - price });
    setMyBlooks(await base44.entities.PlayerBlook.filter({ user_id: profile.user_id, game: 'icecreamet' }));
  };

  const openListDialog = (pb, isShiny = false) => {
    if (BAZAAR_RESTRICTED_BLOOK_IDS.has(pb.blook_id)) return;
    const blook = blookMap[pb.blook_id];
    if (!blook) return;
    setListDialog({ ...pb, isShiny });
    setListPrice(String((SELL_PRICES[blook.rarity] || 5) * (isShiny ? 10 : 2)));
  };

  const confirmList = async () => {
    if (!listDialog || !listPrice) return;
    if (BAZAAR_RESTRICTED_BLOOK_IDS.has(listDialog.blook_id)) return;
    const price = parseInt(listPrice) || 0;
    if (price <= 0) return;
    if (listDialog.isShiny) {
      const newSq = (listDialog.shiny_quantity || 0) - 1;
      if (newSq <= 0 && (listDialog.quantity || 0) <= 0) {
        await base44.entities.PlayerBlook.delete(listDialog.id);
      } else {
        await base44.entities.PlayerBlook.update(listDialog.id, { shiny_quantity: newSq });
      }
      await base44.entities.BazaarListing.create({ seller_id: profile.user_id, seller_username: profile.username, blook_id: listDialog.blook_id, price, status: 'active', is_shiny: true, game: (blookMap[listDialog.blook_id] || {}).game || 'icecreamet' });
    } else {
      if (listDialog.quantity <= 1) {
        await base44.entities.PlayerBlook.delete(listDialog.id);
      } else {
        await base44.entities.PlayerBlook.update(listDialog.id, { quantity: listDialog.quantity - 1 });
      }
      await base44.entities.BazaarListing.create({ seller_id: profile.user_id, seller_username: profile.username, blook_id: listDialog.blook_id, price, status: 'active', game: (blookMap[listDialog.blook_id] || {}).game || 'icecreamet' });
    }
    setListDialog(null);
    setListPrice('');
    loadData();
  };

  // --- Pumpkin seed trading (server-authoritative) ---
  const seedAction = async (action, payload) => {
    const res = await base44.functions.invoke('seedTradeAction', { action, ...payload });
    return res.data;
  };
  const reloadSeeds = async () => {
    setSeedListings((await base44.entities.SeedListing.filter({ status: 'active' }).catch(() => ({ items: [] }))).items || []);
  };

  const listSeeds = async () => {
    const qty = parseInt(seedQty) || 0;
    const price = parseInt(seedPrice) || 0;
    if (qty <= 0 || price <= 0 || seedBusy) return;
    setSeedBusy(true);
    const res = await seedAction('list', { quantity: qty, price });
    if (res?.ok) {
      setSeedQty(''); setSeedPrice('');
      await updateProfile({ pumpkin_seeds: (profile.pumpkin_seeds || 0) - qty });
      reloadSeeds();
    }
    setSeedBusy(false);
  };

  const buySeedListing = async (listing) => {
    if (seedBusy) return;
    setSeedBusy(true);
    const res = await seedAction('buy', { listing_id: listing.id });
    if (res?.ok) {
      await updateProfile({ tokens: (profile.tokens || 0) - listing.price, pumpkin_seeds: (profile.pumpkin_seeds || 0) + listing.quantity });
      reloadSeeds();
    }
    setSeedBusy(false);
  };

  const cancelSeedListing = async (listing) => {
    if (seedBusy) return;
    setSeedBusy(true);
    const res = await seedAction('cancel', { listing_id: listing.id });
    if (res?.ok) {
      await updateProfile({ pumpkin_seeds: (profile.pumpkin_seeds || 0) + listing.quantity });
      reloadSeeds();
    }
    setSeedBusy(false);
  };

  const sendSeeds = async () => {
    const qty = parseInt(sendQty) || 0;
    const targetName = sendTarget.trim().toLowerCase();
    if (qty <= 0 || !targetName || seedBusy) return;
    const target = players.find(p => (p.username || '').toLowerCase() === targetName);
    if (!target) return;
    setSeedBusy(true);
    const res = await seedAction('send', { receiver_user_id: target.user_id, quantity: qty });
    if (res?.ok) {
      await updateProfile({ pumpkin_seeds: (profile.pumpkin_seeds || 0) - qty });
      setSendDialog(false); setSendTarget(''); setSendQty('');
    }
    setSeedBusy(false);
  };

  const buyListing = async (listing) => {
    if (BAZAAR_RESTRICTED_BLOOK_IDS.has(listing.blook_id)) return;
    if (!profile || profile.tokens < listing.price) return;
    if (listing.seller_id === profile.user_id) return;
    // Grant the card the second you buy — re-fetch current inventory to avoid
    // stale local state, then deduct tokens and settle the seller.
    const current = await base44.entities.PlayerBlook.filter({ user_id: profile.user_id, blook_id: listing.blook_id });
    if (current.length > 0) {
      if (listing.is_shiny) {
        await base44.entities.PlayerBlook.update(current[0].id, { shiny_quantity: (current[0].shiny_quantity || 0) + 1 });
      } else {
        await base44.entities.PlayerBlook.update(current[0].id, { quantity: (current[0].quantity || 1) + 1 });
      }
    } else {
      await base44.entities.PlayerBlook.create({ user_id: profile.user_id, blook_id: listing.blook_id, quantity: listing.is_shiny ? 0 : 1, shiny_quantity: listing.is_shiny ? 1 : 0, game: listing.game || 'icecreamet' });
    }
    setMyBlooks(await base44.entities.PlayerBlook.filter({ user_id: profile.user_id, game: 'icecreamet' }));
    await updateProfile({ tokens: profile.tokens - listing.price });
    const seller = players.find(p => p.user_id === listing.seller_id);
    if (seller) {
      await base44.entities.PlayerProfile.update(seller.id, { tokens: (seller.tokens || 0) + listing.price });
    }
    await base44.entities.BazaarListing.update(listing.id, { status: 'sold' });
    loadData();
  };

  const cancelListing = async (listing) => {
    const existing = myBlooks.find(pb => pb.blook_id === listing.blook_id);
    if (existing) {
      if (listing.is_shiny) {
        await base44.entities.PlayerBlook.update(existing.id, { shiny_quantity: (existing.shiny_quantity || 0) + 1 });
      } else {
        await base44.entities.PlayerBlook.update(existing.id, { quantity: (existing.quantity || 1) + 1 });
      }
    } else {
      await base44.entities.PlayerBlook.create({ user_id: profile.user_id, blook_id: listing.blook_id, quantity: listing.is_shiny ? 0 : 1, shiny_quantity: listing.is_shiny ? 1 : 0, game: listing.game || 'icecreamet' });
    }
    await base44.entities.BazaarListing.update(listing.id, { status: 'cancelled' });
    loadData();
  };

  const buyBanner = async (banner) => {
    if (profile.tokens < banner.cost) return;
    await updateProfile({ tokens: profile.tokens - banner.cost });
    await base44.entities.PlayerBanner.create({ user_id: profile.user_id, banner_id: banner.id });
    loadData();
  };

  const equipBanner = async (banner) => {
    await updateProfile({ equipped_banner_id: banner.id });
    loadData();
  };

  const openBlookDetail = (blook) => {
    setSelectedBlook(blook);
    setEditBlookImage(blook.image_url || '');
  };

  const saveBlookImage = async () => {
    if (!selectedBlook) return;
    setSavingImage(true);
    await base44.entities.Blook.update(selectedBlook.id, { image_url: editBlookImage });
    setSavingImage(false);
    setSelectedBlook(null);
    loadData();
  };

  if (loading || !profile) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-panel/30 border-t-panel rounded-full animate-spin" /></div>;

  const myListings = listings.filter(l => l.seller_id === profile.user_id && !BAZAAR_RESTRICTED_BLOOK_IDS.has(l.blook_id));
  const otherListings = listings.filter(l => l.seller_id !== profile.user_id);

  const filteredListings = otherListings.filter(l => {
    if (BAZAAR_RESTRICTED_BLOOK_IDS.has(l.blook_id)) return false;
    const blook = blookMap[l.blook_id];
    if (!blook) return false;
    if (selectedPack && blook.pack_id !== selectedPack.id) return false;
    if (selectedRarity && blook.rarity !== selectedRarity) return false;
    if (searchQuery && !blook.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }).sort((a, b) => a.price - b.price);

  const togglePack = (pack) => {
    setSelectedPack(prev => (prev && prev.id === pack.id ? null : pack));
  };

  // Active listings grouped by blook (cheapest first), used when browsing a pack.
  const listingsByBlook = {};
  otherListings.forEach(l => { if (BAZAAR_RESTRICTED_BLOOK_IDS.has(l.blook_id)) return; (listingsByBlook[l.blook_id] = listingsByBlook[l.blook_id] || []).push(l); });
  Object.values(listingsByBlook).forEach(arr => arr.sort((a, b) => a.price - b.price));

  // Leftovers = blooks with no pack (orphaned). Browseable like any pack.
  const leftoversBlooks = allBlooks.filter(b => !b.pack_id && !BAZAAR_RESTRICTED_BLOOK_IDS.has(b.id));

  // When a pack is selected, browse that pack's blooks (listed or not).
  const packBlooks = selectedPack
    ? (selectedPack.id === 'leftovers' ? leftoversBlooks : (blooksByPack[selectedPack.id] || [])).filter(b => {
        if (selectedRarity && b.rarity !== selectedRarity) return false;
        if (searchQuery && !b.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      })
    : [];

  return (
    <div className="space-y-4">
      {/* Header + search */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-3xl font-display text-white">Bazaar</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search" className="pl-8 w-40 bg-white/10 border-white/15 text-white placeholder:text-white/40 h-9" />
          </div>
          <Button size="sm" variant="outline" className="border-white/15 text-white hover:bg-white/10" onClick={() => { setSearchQuery(''); setSelectedRarity(null); setSelectedPack(null); }}>Clear</Button>
        </div>
      </div>

      {/* Toggle buttons */}
      <div className="flex gap-2">
        {[
          { key: 'blooks', label: 'Blooks' },
          { key: 'listings', label: 'Listings' },
          { key: 'seeds', label: 'Seeds 🎃' },
          { key: 'banners', label: 'Banners' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-5 py-2 rounded-lg text-sm font-display transition-colors ${tab === t.key ? 'bg-white/15 text-white' : 'bg-white/5 text-white/50 hover:text-white/80'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {eventBlooks.length > 0 && (
        <div className="bg-panel rounded-2xl border border-white/10 p-4">
          <h3 className="font-display text-[#a7fcc9] mb-3">✨ Event Blooks</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {eventBlooks.map(blook => {
              const price = (blook.sell_price || SELL_PRICES[blook.rarity] || 5) * 5;
              return (
                <div key={blook.id} className="rounded-xl p-[2px] rainbow-border">
                  <div className="bg-panel rounded-xl p-3 text-center">
                    <div className="w-16 h-16 mx-auto mb-2 flex items-center justify-center">
                      {blook.image_url ? <img src={blook.image_url} alt={blook.name} className="w-full h-full object-contain" /> : <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/0d5e6b887_image.png" alt="" className="w-8 h-8 object-contain" />}
                    </div>
                    <p className={`text-xs font-display rarity-${blook.rarity} truncate`}>{blook.name}</p>
                    <p className="text-[10px] text-white/60 capitalize mb-2">{blook.rarity}</p>
                    <Button size="sm" className="w-full text-xs" onClick={() => buyEventBlook(blook)} disabled={profile.tokens < price} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
                      Buy 🪙{price}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'blooks' && (
        <div className="space-y-4">
          {/* Pack filter grid */}
          <div>
            <p className="text-xs text-white/50 mb-2 font-display">Packs</p>
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
              {leftoversBlooks.length > 0 && (
                <button onClick={() => setSelectedPack(prev => (prev && prev.id === 'leftovers' ? null : { id: 'leftovers', name: 'Leftovers' }))} className={`rounded-lg p-2 text-center transition-all relative overflow-hidden ${selectedPack?.id === 'leftovers' ? 'ring-2 ring-[#a7fcc9] bg-white/10' : 'hover:opacity-90 bg-white/5'}`}>
                  <div className="w-12 h-12 mx-auto mb-1 flex items-center justify-center text-2xl">📦</div>
                  <p className={`text-[10px] truncate ${selectedPack?.id === 'leftovers' ? 'text-[#a7fcc9]' : 'text-white/90'}`}>Leftovers</p>
                  <p className="text-[9px] text-white/40">{leftoversBlooks.length}</p>
                </button>
              )}
              {packs.map(pack => {
                const active = selectedPack?.id === pack.id;
                return (
                  <button key={pack.id} onClick={() => togglePack(pack)} className={`rounded-lg p-2 text-center transition-all relative overflow-hidden ${active ? 'ring-2 ring-[#a7fcc9]' : 'hover:opacity-90'}`} style={pack.background_url ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${pack.background_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: active ? 'rgba(167,252,201,0.2)' : 'rgba(255,255,255,0.05)' }}>
                    <div className="w-12 h-12 mx-auto mb-1 flex items-center justify-center relative z-10">
                      {pack.image_url ? <img src={pack.image_url} alt={pack.name} className="w-full h-full object-contain" /> : <span className="text-2xl">📦</span>}
                    </div>
                    <p className="text-[10px] text-white/90 truncate relative z-10">{pack.name}</p>
                  </button>
                );
              })}
              {packs.length === 0 && <p className="col-span-full text-white/50 text-sm">No packs available</p>}
            </div>
          </div>

          {/* Rarity filter row */}
          <div className="bg-white/5 rounded-xl p-2">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button onClick={() => setSelectedRarity(null)} className={`flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-display transition-colors ${!selectedRarity ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'}`}>All</button>
              {RARITIES.map(r => (
                <button key={r.key} onClick={() => setSelectedRarity(prev => prev === r.key ? null : r.key)} className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-display capitalize transition-colors ${selectedRarity === r.key ? 'bg-white/20' : 'hover:bg-white/10'}`}>
                  <span className={`w-3 h-3 rounded-sm ${r.color ? '' : `rarity-${r.key}`} ${r.color ? 'rainbow-name' : ''}`} style={r.color ? { backgroundColor: r.color } : {}} />
                  <span className={selectedRarity === r.key ? `rarity-${r.key}` : 'text-white/60'}>{r.key}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          <div>
            <p className="text-center text-white font-display mb-3">
              {selectedPack ? `Results: ${packBlooks.length} blooks in ${selectedPack.name}` : `Results: ${filteredListings.length} listings`}
            </p>
            <div className="rounded-2xl p-3 max-h-[60vh] overflow-y-auto" style={selectedPack?.background_url ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${selectedPack.background_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: 'rgba(255,255,255,0.05)' }}>
              {selectedPack ? (
                packBlooks.length === 0 ? (
                  <p className="text-white/50 text-sm text-center py-10">No blooks in this pack match your filters.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {packBlooks.map(blook => {
                      const blookListings = listingsByBlook[blook.id] || [];
                      const cheapest = blookListings[0];
                      return (
                        <div key={blook.id} className="bg-panel rounded-xl border border-white/10 p-3 text-center flex flex-col">
                          <button onClick={() => openBlookDetail(blook)} className="mb-1">
                            <div className="w-16 h-16 mx-auto flex items-center justify-center">
                              {blook.image_url ? <img src={blook.image_url} alt={blook.name} className="w-full h-full object-contain" /> : <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/0d5e6b887_image.png" alt="" className="w-8 h-8 object-contain" />}
                            </div>
                          </button>
                          <p className={`text-xs font-display rarity-${blook.rarity} truncate`}>{blook.name}</p>
                          {cheapest ? (
                            <>
                              <p className="text-[10px] text-white/50 truncate mb-1">{cheapest.seller_username}</p>
                              <p className="text-sm font-display text-[#a7fcc9] flex items-center justify-center gap-1 mb-2">
                                <span>🪙</span>{cheapest.price.toLocaleString()}
                              </p>
                              <Button size="sm" className="w-full text-xs mt-auto" onClick={() => buyListing(cheapest)} disabled={profile.tokens < cheapest.price} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
                                Buy
                              </Button>
                              {blookListings.length > 1 && <p className="text-[10px] text-white/40 mt-1">{blookListings.length} listings</p>}
                            </>
                          ) : (
                            <p className="text-[10px] text-white/40 mt-auto py-2">Not listed</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : filteredListings.length === 0 ? (
                <p className="text-white/50 text-sm text-center py-10">No listings match your filters. Pick a pack to browse its blooks.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {filteredListings.map(listing => {
                    const blook = blookMap[listing.blook_id];
                    if (!blook) return null;
                    return (
                      <div key={listing.id} className={`bg-panel rounded-xl border p-3 text-center flex flex-col ${listing.is_shiny ? 'border-yellow-400/50' : 'border-white/10'}`}>
                        <button onClick={() => openBlookDetail(blook)} className="mb-1">
                          <div className="w-16 h-16 mx-auto flex items-center justify-center">
                            {blook.image_url ? <img src={blook.image_url} alt={blook.name} className={`w-full h-full object-contain ${listing.is_shiny ? 'shiny-blook' : ''}`} /> : <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/0d5e6b887_image.png" alt="" className="w-8 h-8 object-contain" />}
                          </div>
                        </button>
                        <p className={`text-xs font-display rarity-${blook.rarity} truncate`}>{listing.is_shiny && '✨ '}{blook.name}</p>
                        <p className="text-[10px] text-white/50 truncate mb-1">{listing.seller_username}</p>
                        <p className="text-sm font-display text-[#a7fcc9] flex items-center justify-center gap-1 mb-2">
                          <span>🪙</span>{listing.price.toLocaleString()}
                        </p>
                        <Button size="sm" className="w-full text-xs mt-auto" onClick={() => buyListing(listing)} disabled={profile.tokens < listing.price} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
                          Buy
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* War Shop */}
          <div className="bg-panel rounded-2xl border border-white/10 p-4">
            <h3 className="font-display text-[#a7fcc9] mb-1">⚔️ War Shop</h3>
            <p className="text-xs text-white/50 mb-3">Buy weapons to bomb enemy clans or shields to protect yours!</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <Bomb size={28} className="mx-auto mb-2 text-red-400" />
                <p className="text-sm font-display text-white">Grenade</p>
                <p className="text-[10px] text-white/50 mb-2">Bomb a clan, reduce XP 50%</p>
                <Button size="sm" className="w-full" onClick={buyGrenade} disabled={profile.tokens < 5000 || busy} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
                  Buy 🪙 5,000
                </Button>
                <p className="text-[10px] text-white/50 mt-1">Owned: {profile.grenades || 0}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <Shield size={28} className="mx-auto mb-2 text-blue-400" />
                <p className="text-sm font-display text-white">Shield</p>
                <p className="text-[10px] text-white/50 mb-2">Protect your clan 24h</p>
                <Button size="sm" className="w-full" onClick={buyShield} disabled={profile.tokens < 3000 || busy} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
                  Buy 🪙 3,000
                </Button>
                <p className="text-[10px] text-white/50 mt-1">Owned: {profile.shields || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'listings' && (
        <div className="space-y-4">
          <div className="bg-panel rounded-2xl border border-white/10 p-4">
            <h3 className="font-display text-[#a7fcc9] mb-3">Your Active Listings</h3>
            {myListings.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {myListings.map(listing => {
                  const blook = blookMap[listing.blook_id];
                  if (!blook) return null;
                  return (
                    <div key={listing.id} className={`bg-white/5 rounded-xl border p-3 text-center ${listing.is_shiny ? 'border-yellow-400/50' : 'border-white/10'}`}>
                      <div className="w-16 h-16 mx-auto mb-2 flex items-center justify-center">
                        {blook.image_url ? <img src={blook.image_url} alt={blook.name} className={`w-full h-full object-contain ${listing.is_shiny ? 'shiny-blook' : ''}`} /> : <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/0d5e6b887_image.png" alt="" className="w-8 h-8 object-contain" />}
                      </div>
                      <p className={`text-xs font-display rarity-${blook.rarity} truncate`}>{listing.is_shiny && '✨ '}{blook.name}</p>
                      <p className="text-[10px] text-[#a7fcc9] flex items-center justify-center gap-1 mb-2">🪙 {listing.price.toLocaleString()}</p>
                      <Button size="sm" variant="outline" className="w-full text-xs border-white/20 text-white" onClick={() => cancelListing(listing)}>Cancel</Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-white/50 text-sm">No active listings</p>
            )}
          </div>

          <div className="bg-panel rounded-2xl border border-white/10 p-4">
            <h3 className="font-display text-[#a7fcc9] mb-1">List a Blook for Sale</h3>
            <p className="text-xs text-white/50 mb-3">Select a blook from your inventory to list on the market — you set the price!</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {myBlooks.filter(pb => !BAZAAR_RESTRICTED_BLOOK_IDS.has(pb.blook_id)).map(pb => {
                const blook = blookMap[pb.blook_id];
                if (!blook) return null;
                return (
                  <div key={pb.id} className="bg-white/5 rounded-xl border border-white/10 p-3 text-center">
                    <div className="w-16 h-16 mx-auto mb-2 flex items-center justify-center">
                      {blook.image_url ? <img src={blook.image_url} alt={blook.name} className="w-full h-full object-contain" /> : <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/0d5e6b887_image.png" alt="" className="w-8 h-8 object-contain" />}
                    </div>
                    <p className={`text-xs font-display rarity-${blook.rarity} truncate`}>{blook.name}</p>
                    <p className="text-[10px] text-white/50">x{pb.quantity}{(pb.shiny_quantity || 0) > 0 && <span className="text-yellow-400"> ✨{pb.shiny_quantity}</span>}</p>
                    <Button size="sm" variant="outline" className="w-full text-xs mt-2 border-white/20 text-white" onClick={() => openListDialog(pb)}>List</Button>
                    {(pb.shiny_quantity || 0) > 0 && (
                      <Button size="sm" variant="outline" className="w-full text-xs mt-1 border-yellow-400/40 text-yellow-300 hover:bg-yellow-400/10" onClick={() => openListDialog(pb, true)}>✨ List Shiny</Button>
                    )}
                  </div>
                );
              })}
              {myBlooks.length === 0 && <p className="col-span-full text-white/50 text-sm">No blooks to list</p>}
            </div>
          </div>
        </div>
      )}

      {tab === 'seeds' && (
        <div className="space-y-4">
          {/* Balance + send */}
          <div className="bg-panel rounded-2xl border border-orange-400/40 p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs text-white/60 uppercase tracking-wide mb-1">My Pumpkin Seeds</p>
              <p className="text-3xl font-display text-orange-300">🎃 {profile.pumpkin_seeds || 0}</p>
            </div>
            <Button size="sm" variant="outline" className="border-white/20 text-white" onClick={() => setSendDialog(true)}>
              ➤ Send Seeds
            </Button>
          </div>

          {/* List seeds */}
          <div className="bg-panel rounded-2xl border border-white/10 p-4">
            <h3 className="font-display text-[#a7fcc9] mb-1">List Pumpkin Seeds for Sale</h3>
            <p className="text-xs text-white/50 mb-3">Sell seeds for tokens — buyers get the seeds, you get paid.</p>
            <div className="flex gap-2 flex-wrap">
              <Input type="number" value={seedQty} onChange={e => setSeedQty(e.target.value)} placeholder="Quantity" className="w-28 bg-white/10 border-white/15 text-white placeholder:text-white/40 h-9" />
              <Input type="number" value={seedPrice} onChange={e => setSeedPrice(e.target.value)} placeholder="Price 🪙" className="w-32 bg-white/10 border-white/15 text-white placeholder:text-white/40 h-9" />
              <Button size="sm" onClick={listSeeds} disabled={seedBusy || !seedQty || !seedPrice} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
                {seedBusy ? 'Working...' : 'List for Sale'}
              </Button>
            </div>
            <p className="text-[10px] text-white/50 mt-2">One listing = the whole batch; buyers pay the full price to take all {seedQty || 'N'} seeds.</p>
          </div>

          {/* Active seed listings */}
          <div className="bg-panel rounded-2xl border border-white/10 p-4">
            <h3 className="font-display text-[#a7fcc9] mb-3">Seed Market</h3>
            {seedListings.length === 0 ? (
              <p className="text-white/50 text-sm text-center py-6">No seeds listed for sale yet.</p>
            ) : (
              <div className="divide-y divide-white/5">
                {seedListings.slice().sort((a, b) => a.price - b.price).map(listing => {
                  const mine = listing.seller_id === profile.user_id;
                  return (
                    <div key={listing.id} className="flex items-center gap-3 py-2.5">
                      <div className="w-9 h-9 rounded-lg bg-black/40 flex items-center justify-center text-lg shrink-0">🎃</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-display text-white truncate">{mine ? 'You' : listing.seller_username}</p>
                        <p className="text-[10px] text-orange-300">🎃 {listing.quantity} seeds · 🪙 {listing.price.toLocaleString()}</p>
                      </div>
                      {mine ? (
                        <Button size="sm" variant="outline" className="border-white/20 text-white text-xs" onClick={() => cancelSeedListing(listing)} disabled={seedBusy}>Cancel</Button>
                      ) : (
                        <Button size="sm" className="text-xs" onClick={() => buySeedListing(listing)} disabled={profile.tokens < listing.price || seedBusy} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
                          Buy
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'banners' && (
        <div className="bg-panel rounded-2xl border border-white/10 p-4">
          <h3 className="font-display text-[#a7fcc9] mb-1">Banners</h3>
          <p className="text-xs text-white/50 mb-3">Buy banners and equip them to display on your Stats page!</p>
          {banners.length === 0 ? (
            <p className="text-white/50 text-sm">No banners available</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {banners.map(banner => {
                const owned = myBanners.some(mb => mb.banner_id === banner.id);
                const equipped = profile.equipped_banner_id === banner.id;
                return (
                  <div key={banner.id} className="bg-white/5 rounded-xl border border-white/10 p-3">
                    <div className="w-full h-24 rounded-lg overflow-hidden mb-2">
                      <img src={banner.image_url} alt={banner.name} className="w-full h-full object-cover" />
                    </div>
                    <p className="text-xs font-display text-[#a7fcc9] mb-2">{banner.name}</p>
                    {equipped ? (
                      <Button size="sm" variant="outline" className="w-full text-xs border-white/20 text-white" disabled>Equipped</Button>
                    ) : owned ? (
                      <Button size="sm" variant="outline" className="w-full text-xs border-white/20 text-white" onClick={() => equipBanner(banner)}>Equip</Button>
                    ) : (
                      <Button size="sm" className="w-full text-xs" onClick={() => buyBanner(banner)} disabled={profile.tokens < banner.cost} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
                        Buy 🪙{banner.cost}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Dialog open={!!listDialog} onOpenChange={(open) => { if (!open) { setListDialog(null); setListPrice(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{listDialog?.isShiny ? '✨ ' : ''}List {listDialog ? blookMap[listDialog.blook_id]?.name : ''}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Set the price (in tokens) other players will pay to buy this blook.</p>
          <Input type="number" value={listPrice} onChange={e => setListPrice(e.target.value)} placeholder="Price in tokens" />
          <Button onClick={confirmList} style={{ backgroundColor: 'rgb(var(--user-sidebar))' }}>List for Sale</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedBlook} onOpenChange={(open) => { if (!open) setSelectedBlook(null); }}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedBlook?.image_url ? <img src={selectedBlook.image_url} alt="" className="w-10 h-10 object-contain" /> : <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/0d5e6b887_image.png" alt="" className="w-8 h-8 object-contain" />}
              <span className={`rarity-${selectedBlook?.rarity}`}>{selectedBlook?.name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {(() => {
              if (!selectedBlook) return null;
              const blookListings = listings.filter(l => l.blook_id === selectedBlook.id).sort((a, b) => a.price - b.price);
              if (blookListings.length === 0) {
                const mine = myBlooks.find(pb => pb.blook_id === selectedBlook.id);
                return (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground mb-3">No active listings for this blook yet.</p>
                    {mine && <Button size="sm" onClick={() => { setListDialog(mine); setListPrice(String((SELL_PRICES[selectedBlook.rarity] || 5) * 2)); setSelectedBlook(null); }} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>List Yours</Button>}
                  </div>
                );
              }
              return blookListings.map(listing => {
                const mine = listing.seller_id === profile.user_id;
                return (
                  <div key={listing.id} className="flex items-center justify-between border rounded-lg p-2">
                    <div>
                      <p className="text-sm">{listing.is_shiny && '✨ '}{mine ? 'You' : listing.seller_username}</p>
                      <p className="text-xs text-muted-foreground">🪙 {listing.price.toLocaleString()}</p>
                    </div>
                    {mine ? (
                      <Button size="sm" variant="outline" onClick={() => { cancelListing(listing); setSelectedBlook(null); }}>Cancel</Button>
                    ) : (
                      <Button size="sm" onClick={() => { buyListing(listing); setSelectedBlook(null); }} disabled={profile.tokens < listing.price} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
                        Buy
                      </Button>
                    )}
                  </div>
                );
              });
            })()}
          </div>
          {isAdmin && (
            <div className="mt-4 pt-3 border-t border-white/10">
              <p className="text-xs text-[#a7fcc9] font-display mb-1">Admin: Change Image URL</p>
              <Input value={editBlookImage} onChange={e => setEditBlookImage(e.target.value)} placeholder="Paste new image URL" className="mb-2" />
              <Button size="sm" onClick={saveBlookImage} disabled={savingImage} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>{savingImage ? 'Saving...' : 'Save Image'}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={sendDialog} onOpenChange={(open) => { if (!open) { setSendDialog(false); setSendTarget(''); setSendQty(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🎃 Send Pumpkin Seeds</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Send pumpkin seeds to another player. This cannot be undone.</p>
          <Input value={sendTarget} onChange={e => setSendTarget(e.target.value)} placeholder="Recipient username" className="mb-2" />
          <Input type="number" value={sendQty} onChange={e => setSendQty(e.target.value)} placeholder="Quantity" />
          <Button onClick={sendSeeds} disabled={seedBusy || !sendTarget || !sendQty} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
            {seedBusy ? 'Sending...' : 'Send Seeds'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}