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
import { bazaarList, bazaarBuy, bazaarCancel } from '@/lib/economyActions';

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
    try {
      await bazaarList({ blook_id: listDialog.blook_id, price, isShiny: !!listDialog.isShiny });
    } catch (e) {
      alert(e?.message || 'Failed to list item');
      return;
    }
    setListDialog(null);
    setListPrice('');
    loadData();
  };

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
    try {
      const data = await bazaarBuy(listing.id);
      if (data?.profile) await updateProfile(data.profile);
      else await updateProfile({ tokens: profile.tokens - listing.price });
    } catch (e) {
      alert(e?.message || 'Purchase failed — try again');
      return;
    }
    setMyBlooks(await base44.entities.PlayerBlook.filter({ user_id: profile.user_id, game: 'icecreamet' }));
    loadData();
  };

  const cancelListing = async (listing) => {
    try {
      await bazaarCancel(listing.id);
    } catch (e) {
      alert(e?.message || 'Cancel failed');
      return;
    }
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

  const listingsByBlook = {};
  otherListings.forEach(l => { if (BAZAAR_RESTRICTED_BLOOK_IDS.has(l.blook_id)) return; (listingsByBlook[l.blook_id] = listingsByBlook[l.blook_id] || []).push(l); });
  Object.values(listingsByBlook).forEach(arr => arr.sort((a, b) => a.price - b.price));
  const leftoversBlooks = allBlooks.filter(b => !b.pack_id && !BAZAAR_RESTRICTED_BLOOK_IDS.has(b.id));
  const packBlooks = selectedPack
    ? (selectedPack.id === 'leftovers' ? leftoversBlooks : (blooksByPack[selectedPack.id] || [])).filter(b => {
        if (selectedRarity && b.rarity !== selectedRarity) return false;
        if (searchQuery && !b.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      })
    : [];

  return (
    <div className="space-y-4">
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
      <div className="flex gap-2">
        {[{ key: 'blooks', label: 'Blooks' }, { key: 'listings', label: 'Listings' }, { key: 'seeds', label: 'Seeds' }, { key: 'banners', label: 'Banners' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-5 py-2 rounded-lg text-sm font-display transition-colors ${tab === t.key ? 'bg-white/15 text-white' : 'bg-white/5 text-white/50 hover:text-white/80'}`}>{t.label}</button>
        ))}
      </div>
      {tab === 'blooks' && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
            {packs.map(pack => (
              <button key={pack.id} onClick={() => setSelectedPack(prev => prev?.id === pack.id ? null : pack)} className={`rounded-lg p-2 text-center ${selectedPack?.id === pack.id ? 'ring-2 ring-[#a7fcc9] bg-white/10' : 'bg-white/5'}`}>
                <p className="text-[10px] truncate text-white/90">{pack.name}</p>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {(selectedPack ? packBlooks : []).map(blook => {
              const cheapest = (listingsByBlook[blook.id] || [])[0];
              return (
                <div key={blook.id} className="bg-panel rounded-xl border border-white/10 p-3 text-center">
                  <p className={`text-xs font-display rarity-${blook.rarity} truncate`}>{blook.name}</p>
                  {cheapest ? (
                    <Button size="sm" className="w-full text-xs mt-2" onClick={() => buyListing(cheapest)} disabled={profile.tokens < cheapest.price} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Buy {cheapest.price}</Button>
                  ) : (
                    <p className="text-[10px] text-white/40 mt-2">Not listed</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {tab === 'listings' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filteredListings.map(listing => {
            const blook = blookMap[listing.blook_id];
            if (!blook) return null;
            return (
              <div key={listing.id} className="bg-panel rounded-xl border border-white/10 p-3 text-center">
                <p className="text-xs font-display text-white truncate">{blook.name}</p>
                <p className="text-[10px] text-white/50">{listing.seller_username}</p>
                <Button size="sm" className="w-full text-xs mt-2" onClick={() => buyListing(listing)} disabled={profile.tokens < listing.price} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Buy {listing.price}</Button>
              </div>
            );
          })}
          {myListings.map(listing => {
            const blook = blookMap[listing.blook_id];
            return (
              <div key={listing.id} className="bg-panel rounded-xl border border-yellow-400/30 p-3 text-center">
                <p className="text-xs text-white">{blook?.name || 'Blook'}</p>
                <Button size="sm" variant="outline" className="mt-2 text-xs" onClick={() => cancelListing(listing)}>Cancel</Button>
              </div>
            );
          })}
        </div>
      )}
      {tab === 'seeds' && (
        <div className="space-y-4">
          <p className="text-white">Pumpkin Seeds: {profile.pumpkin_seeds || 0}</p>
          <div className="flex gap-2">
            <Input type="number" value={seedQty} onChange={e => setSeedQty(e.target.value)} placeholder="Qty" className="w-28" />
            <Input type="number" value={seedPrice} onChange={e => setSeedPrice(e.target.value)} placeholder="Price" className="w-28" />
            <Button onClick={listSeeds} disabled={seedBusy}>List</Button>
          </div>
          {seedListings.map(listing => (
            <div key={listing.id} className="flex justify-between text-white text-sm">
              <span>{listing.seller_username}: {listing.quantity} seeds for {listing.price}</span>
              {listing.seller_id === profile.user_id
                ? <Button size="sm" onClick={() => cancelSeedListing(listing)}>Cancel</Button>
                : <Button size="sm" onClick={() => buySeedListing(listing)}>Buy</Button>}
            </div>
          ))}
        </div>
      )}
      {tab === 'banners' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {banners.map(banner => {
            const owned = myBanners.some(mb => mb.banner_id === banner.id);
            return (
              <div key={banner.id} className="bg-panel p-3 rounded-xl">
                <p className="text-white text-sm">{banner.name}</p>
                {owned
                  ? <Button size="sm" onClick={() => equipBanner(banner)}>Equip</Button>
                  : <Button size="sm" onClick={() => buyBanner(banner)} disabled={profile.tokens < banner.cost}>Buy {banner.cost}</Button>}
              </div>
            );
          })}
        </div>
      )}
      <Dialog open={!!listDialog} onOpenChange={v => !v && setListDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>List for sale</DialogTitle></DialogHeader>
          <Input type="number" value={listPrice} onChange={e => setListPrice(e.target.value)} placeholder="Price" />
          <Button onClick={confirmList}>Confirm</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
