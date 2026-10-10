import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { SELL_PRICES, MEGA_CHARIZARD_BLOOK_ID, TROPHY_BLOOKS, BLOOK_SCORE_POINTS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import BulkSellDialog from '@/components/game/BulkSellDialog';
import BlookDetailDialog from '@/components/game/BlookDetailDialog';
import { Lock, Search, Coins } from 'lucide-react';

const TROPHY_IDS = new Set([...Object.values(TROPHY_BLOOKS), MEGA_CHARIZARD_BLOOK_ID]);
const LEFTOVER_WHITELIST = new Set(["icecreamy's birthday cake", "spooder man", "cube", "nexus", "flabby pird"]);
const PAC3_PACK_ID = '__pac3_event_2026__';
const PAC3_BANNER = 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/3da0043ff_Pokeball.webp';

export default function Blooks() {
  const { profile, updateProfile } = useGame();
  const [playerBlooks, setPlayerBlooks] = useState([]);
  const [allBlooks, setAllBlooks] = useState([]);
  const [packs, setPacks] = useState([]);
  const [banners, setBanners] = useState([]);
  const [ownedBanners, setOwnedBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('blooks');
  const [dialogBlook, setDialogBlook] = useState(null);
  const [dialogAction, setDialogAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [bulkSellOpen, setBulkSellOpen] = useState(false);

  const [loadError, setLoadError] = useState(false);
  const load = async () => {
    if (!profile) return;
    try {
      setLoadError(false);
      const [pb, ab, pks, bn, ob] = await Promise.all([
        base44.entities.PlayerBlook.filter({ user_id: profile.user_id, game: 'icecreamet' }, null, 2000),
        base44.entities.Blook.filter({ is_active: true, is_deleted: false, game: 'icecreamet' }, null, 2000),
        base44.entities.Pack.filter({ game: 'icecreamet' }, 'order'),
        base44.entities.Banner.filter({ is_active: true }).catch(() => banners),
        base44.entities.PlayerBanner.filter({ user_id: profile.user_id }).catch(() => ownedBanners)
      ]);
      // Only load OWNED PAC3 prize blooks (no locked cards display).
      // Owned prizes appear in Leftovers with their actual blook definitions.
      let mergedAb = ab;
      let mergedPb = pb;
      try {
        const owned = await base44.entities.PlayerBlook.filter({ user_id: profile.user_id, game: 'pokemon' }, null, 500);
        if (owned.length > 0) {
          const ids = owned.map(o => o.blook_id);
          const prizeBlooks = await base44.entities.Blook.filter({ id: { $in: ids }, is_active: true, is_deleted: false }, null, 200);
          mergedAb = [...mergedAb, ...prizeBlooks.map(b => ({ ...b, pack_id: null }))];
          mergedPb = [...mergedPb, ...owned];
        }
      } catch {}
      setPlayerBlooks(mergedPb);
      setAllBlooks(mergedAb);
      setPacks(pks);
      setBanners(bn);
      setOwnedBanners(ob);
      setLoading(false);
    } catch (e) {
      setLoadError(true);
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [profile?.user_id]);

  const ownedMap = {};
  playerBlooks.forEach(pb => { ownedMap[pb.blook_id] = pb; });

  const packMap = {};
  packs.forEach(p => { packMap[p.id] = p; });

  const allByPack = {};
  const noPackBlooks = [];
  const packIdSet = new Set(packs.map(p => p.id));
  allBlooks.forEach(b => {
    if (b.pack_id && packIdSet.has(b.pack_id)) {
      if (!allByPack[b.pack_id]) allByPack[b.pack_id] = [];
      allByPack[b.pack_id].push(b);
    } else {
      noPackBlooks.push(b);
    }
  });
  const pac3Blooks = noPackBlooks.filter(b => b.game === 'pokemon');
  const leftoverBlooks = noPackBlooks.filter(b => b.game !== 'pokemon');

  const searchLower = search.toLowerCase();
  const filterBlooks = (blooks) => search ? blooks.filter(b => b.name?.toLowerCase().includes(searchLower)) : blooks;

  const buyBanner = async (banner) => {
    if (!profile || profile.tokens < banner.cost) return;
    if (ownedBanners.some(ob => ob.banner_id === banner.id)) return;
    setBusy(true);
    await updateProfile({ tokens: profile.tokens - banner.cost });
    const ob = await base44.entities.PlayerBanner.create({ user_id: profile.user_id, banner_id: banner.id });
    setOwnedBanners(prev => [...prev, ob]);
    setBusy(false);
  };

  const equipBanner = async (bannerId) => {
    setBusy(true);
    await updateProfile({ equipped_banner_id: bannerId });
    setBusy(false);
  };

  if (loading || !profile) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-panel/30 border-t-panel rounded-full animate-spin" /></div>;
  if (loadError) return (
    <div className="text-center py-12">
      <p className="text-white/60 mb-3">Failed to load blooks. Please try again.</p>
      <Button onClick={() => { setLoading(true); load(); }} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Retry</Button>
    </div>
  );

  const totalUnlocked = Object.keys(ownedMap).length;

  const ownedList = playerBlooks.map(pb => {
    const b = allBlooks.find(x => x.id === pb.blook_id);
    return b ? {
      pbId: pb.id, id: b.id, name: b.name, image_url: b.image_url, rarity: b.rarity,
      quantity: pb.quantity, shiny_quantity: pb.shiny_quantity || 0,
      sell_price: b.sell_price || SELL_PRICES[b.rarity] || 5
    } : null;
  }).filter(Boolean);

  const blookScore = playerBlooks.reduce((sum, pb) => {
    const b = allBlooks.find(x => x.id === pb.blook_id);
    return b ? sum + (BLOOK_SCORE_POINTS[b.rarity] || 0) : sum;
  }, 0);
  const rarityCounts = {};
  playerBlooks.forEach(pb => {
    const b = allBlooks.find(x => x.id === pb.blook_id);
    if (b) rarityCounts[b.rarity] = (rarityCounts[b.rarity] || 0) + 1;
  });
  const totalValue = playerBlooks.reduce((sum, pb) => {
    const b = allBlooks.find(x => x.id === pb.blook_id);
    if (b) return sum + (b.sell_price || SELL_PRICES[b.rarity] || 5) * (pb.quantity || 0);
    return sum;
  }, 0);

  const handleBulkSold = async ({ tokens, diamonds }) => {
    const patch = {};
    if (tokens > 0) patch.tokens = (profile.tokens || 0) + tokens;
    if (diamonds > 0) patch.diamonds = Math.round(((profile.diamonds || 0) + diamonds) * 100) / 100;
    if (Object.keys(patch).length > 0) await updateProfile(patch);
    load();
  };

  const tileBg = (pack) => pack?.background_url
    ? { backgroundImage: `url(${pack.background_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: '#3d3d3d' };

  const BlookTile = ({ blook, pack }) => {
    const owned = ownedMap[blook.id];
    return (
      <button
        onClick={() => owned && setDialogBlook({ ...blook, pbId: owned.id, quantity: owned.quantity, shiny_quantity: owned.shiny_quantity || 0 })}
        className="aspect-square rounded-md overflow-hidden relative group transition-transform hover:scale-110"
        style={tileBg(pack)}
        title={blook.name}
      >
        {owned ? (
          <>
            {blook.image_url && <img src={blook.image_url} alt={blook.name} className="w-full h-full object-contain p-0.5" />}
            {owned.quantity > 1 && (
              <span className="absolute bottom-0.5 left-0.5 min-w-4 h-4 px-1 rounded-full bg-green-500 text-white text-[9px] font-display flex items-center justify-center ring-1 ring-white/80">{owned.quantity}</span>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-black/70">
            {blook.image_url ? (
              <img src={blook.image_url} alt="" className="w-full h-full object-contain p-0.5" style={{ filter: 'brightness(0) drop-shadow(0 0 1px rgba(255,255,255,0.35))' }} />
            ) : (
              <Lock size={14} className="text-white/30" />
            )}
            <Lock size={10} className="absolute text-white/70 drop-shadow" />
          </div>
        )}
      </button>
    );
  };

  const ShinyTile = ({ blook, pack, owned }) => (
    <button
      onClick={() => owned && setDialogBlook({ ...blook, pbId: owned.id, quantity: owned.quantity, shiny_quantity: owned.shiny_quantity || 0, isShiny: true })}
      className="aspect-square rounded-md overflow-hidden relative group transition-transform hover:scale-110 ring-2 ring-yellow-400/60"
      style={tileBg(pack)}
      title={`${blook.name} ✨`}
    >
      {blook.image_url && <img src={blook.image_url} alt={blook.name} className="w-full h-full object-contain p-0.5 shiny-blook" />}
      <span className="absolute bottom-0.5 left-0.5 min-w-4 h-4 px-1 rounded-full bg-yellow-400 text-black text-[9px] font-display flex items-center justify-center ring-1 ring-white/80">✨{owned.shiny_quantity}</span>
    </button>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-display text-[#a7fcc9]">My Blooks</h2>
        <span className="text-sm text-white/60">{totalUnlocked} / {allBlooks.length} unlocked</span>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search blooks..." className="pl-9 bg-panel border-white/20 text-white placeholder:text-white/40" />
      </div>

      <div className="flex gap-2 mb-4 items-center flex-wrap">
        <Button size="sm" variant={tab === 'blooks' ? 'default' : 'outline'} onClick={() => setTab('blooks')} style={tab === 'blooks' ? { backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' } : {}} className={tab !== 'blooks' ? 'border-white/20 text-white' : ''}>Blooks</Button>
        <Button size="sm" variant={tab === 'shinies' ? 'default' : 'outline'} onClick={() => setTab('shinies')} style={tab === 'shinies' ? { backgroundColor: '#f1c40f', color: '#000' } : {}} className={tab !== 'shinies' ? 'border-yellow-400/40 text-yellow-300' : ''}>✨ Shinies</Button>
        <Button size="sm" variant={tab === 'banners' ? 'default' : 'outline'} onClick={() => setTab('banners')} style={tab === 'banners' ? { backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' } : {}} className={tab !== 'banners' ? 'border-white/20 text-white' : ''}>Banners</Button>
        {tab === 'blooks' && ownedList.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setBulkSellOpen(true)} className="ml-auto border-white/20 text-white" style={{ borderColor: '#f1c40f', color: '#f1c40f' }}>
            <Coins size={14} className="mr-1" /> Bulk Sell
          </Button>
        )}
      </div>

      {tab === 'blooks' && (
        <div className="rounded-2xl overflow-hidden bg-panel border border-white/10">
          {packs.map((pack, idx) => {
            const packBlooks = filterBlooks(allByPack[pack.id] || []);
            if (packBlooks.length === 0) return null;
            const packOwned = packBlooks.filter(b => ownedMap[b.id]).length;
            return (
              <div key={pack.id} className={`p-3 ${idx > 0 ? 'border-t border-white/15' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-white flex items-center gap-2">
                    {pack.image_url ? <img src={pack.image_url} alt="" className="w-6 h-6 object-contain" /> : <span>📦</span>}
                    {pack.name}
                  </h3>
                  <span className="text-xs text-white/50">{packOwned}/{packBlooks.length}</span>
                </div>
                <div className="grid grid-cols-8 sm:grid-cols-12 lg:grid-cols-[repeat(16,minmax(0,1fr))] xl:grid-cols-[repeat(20,minmax(0,1fr))] gap-1">
                  {packBlooks.flatMap(blook => {
                    const owned = ownedMap[blook.id];
                    const tiles = [<BlookTile key={blook.id} blook={blook} pack={pack} />];
                    if (owned && (owned.shiny_quantity || 0) > 0) tiles.push(<ShinyTile key={blook.id + '-shiny'} blook={blook} pack={pack} owned={owned} />);
                    return tiles;
                  })}
                </div>
              </div>
            );
          })}
          {pac3Blooks.length > 0 && filterBlooks(pac3Blooks).length > 0 && (
            <div className="p-3 border-t border-white/15">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-white flex items-center gap-2">
                  <img src={PAC3_BANNER} alt="" className="w-6 h-6 object-contain" />
                  PAC3 2026 EVENT
                </h3>
                <span className="text-xs text-white/50">{pac3Blooks.filter(b => ownedMap[b.id]).length}/{pac3Blooks.length}</span>
              </div>
              <div className="grid grid-cols-8 sm:grid-cols-12 lg:grid-cols-[repeat(16,minmax(0,1fr))] xl:grid-cols-[repeat(20,minmax(0,1fr))] gap-1">
                {filterBlooks(pac3Blooks).flatMap(blook => {
                  const owned = ownedMap[blook.id];
                  const tiles = [<BlookTile key={blook.id} blook={blook} pack={null} />];
                  if (owned && (owned.shiny_quantity || 0) > 0) tiles.push(<ShinyTile key={blook.id + '-shiny'} blook={blook} pack={null} owned={owned} />);
                  return tiles;
                })}
              </div>
            </div>
          )}
          {leftoverBlooks.length > 0 && filterBlooks(leftoverBlooks).length > 0 && (
            <div className="p-4 border-t border-white/15">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-white flex items-center gap-2"><span>📦</span>Leftovers</h3>
                <span className="text-xs text-white/50">{leftoverBlooks.filter(b => ownedMap[b.id]).length}/{leftoverBlooks.length}</span>
              </div>
              <div className="grid grid-cols-8 sm:grid-cols-12 lg:grid-cols-[repeat(16,minmax(0,1fr))] xl:grid-cols-[repeat(20,minmax(0,1fr))] gap-1">
                {filterBlooks(leftoverBlooks).flatMap(blook => {
                  const owned = ownedMap[blook.id];
                  const tiles = [<BlookTile key={blook.id} blook={blook} pack={null} />];
                  if (owned && (owned.shiny_quantity || 0) > 0) tiles.push(<ShinyTile key={blook.id + '-shiny'} blook={blook} pack={null} owned={owned} />);
                  return tiles;
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'shinies' && (
        <div className="rounded-2xl overflow-hidden bg-panel border border-white/10">
          {(() => {
            const shinyByPack = {};
            const shinyLeftovers = [];
            const shinyPac3 = [];
            playerBlooks.forEach(pb => {
              if ((pb.shiny_quantity || 0) > 0) {
                const b = allBlooks.find(x => x.id === pb.blook_id);
                if (!b) return;
                if (b.pack_id && packMap[b.pack_id]) {
                  if (!shinyByPack[b.pack_id]) shinyByPack[b.pack_id] = [];
                  shinyByPack[b.pack_id].push({ ...b, pbId: pb.id, shiny_quantity: pb.shiny_quantity });
                } else if (b.game === 'pokemon') {
                  shinyPac3.push({ ...b, pbId: pb.id, shiny_quantity: pb.shiny_quantity });
                } else {
                  shinyLeftovers.push({ ...b, pbId: pb.id, shiny_quantity: pb.shiny_quantity });
                }
              }
            });
            const totalShiny = Object.values(shinyByPack).flat().length + shinyLeftovers.length + shinyPac3.length;
            if (totalShiny === 0) {
              return <div className="p-8 text-center"><p className="text-yellow-300/70 text-sm mb-1">✨ No shiny blooks yet!</p><p className="text-white/40 text-xs">Open packs to find shiny variants (1% chance, 1.9× with diamonds).</p></div>;
            }
            return (
              <>
                {packs.map((pack, idx) => {
                  const shinies = filterBlooks(shinyByPack[pack.id] || []);
                  if (shinies.length === 0) return null;
                  return (
                    <div key={pack.id} className={`p-3 ${idx > 0 ? 'border-t border-white/15' : ''}`}>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-display text-yellow-300 flex items-center gap-2">
                          {pack.image_url ? <img src={pack.image_url} alt="" className="w-6 h-6 object-contain" /> : <span>📦</span>}
                          {pack.name}
                        </h3>
                        <span className="text-xs text-yellow-300/60">✨ {shinies.length}</span>
                      </div>
                      <div className="grid grid-cols-8 sm:grid-cols-12 lg:grid-cols-[repeat(16,minmax(0,1fr))] xl:grid-cols-[repeat(20,minmax(0,1fr))] gap-1">
                        {shinies.map(blook => (
                          <ShinyTile key={blook.id} blook={blook} pack={pack} owned={{ id: blook.pbId, shiny_quantity: blook.shiny_quantity, quantity: 0 }} />
                        ))}
                      </div>
                    </div>
                  );
                })}
                {shinyPac3.length > 0 && filterBlooks(shinyPac3).length > 0 && (
                  <div className="p-3 border-t border-white/15">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-display text-yellow-300 flex items-center gap-2">
                        <img src={PAC3_BANNER} alt="" className="w-6 h-6 object-contain" />
                        PAC3 2026 EVENT
                      </h3>
                      <span className="text-xs text-yellow-300/60">✨ {shinyPac3.length}</span>
                    </div>
                    <div className="grid grid-cols-8 sm:grid-cols-12 lg:grid-cols-[repeat(16,minmax(0,1fr))] xl:grid-cols-[repeat(20,minmax(0,1fr))] gap-1">
                      {filterBlooks(shinyPac3).map(blook => (
                        <ShinyTile key={blook.id} blook={blook} pack={null} owned={{ id: blook.pbId, shiny_quantity: blook.shiny_quantity, quantity: 0 }} />
                      ))}
                    </div>
                  </div>
                )}
                {shinyLeftovers.length > 0 && filterBlooks(shinyLeftovers).length > 0 && (
                  <div className="p-4 border-t border-white/15">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-display text-yellow-300 flex items-center gap-2"><span>📦</span>Leftovers</h3>
                      <span className="text-xs text-yellow-300/60">✨ {shinyLeftovers.length}</span>
                    </div>
                    <div className="grid grid-cols-8 sm:grid-cols-12 lg:grid-cols-[repeat(16,minmax(0,1fr))] xl:grid-cols-[repeat(20,minmax(0,1fr))] gap-1">
                      {filterBlooks(shinyLeftovers).map(blook => (
                        <ShinyTile key={blook.id} blook={blook} pack={null} owned={{ id: blook.pbId, shiny_quantity: blook.shiny_quantity, quantity: 0 }} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {tab === 'banners' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {banners.map(banner => {
            const isOwned = ownedBanners.some(ob => ob.banner_id === banner.id);
            const isEquipped = profile?.equipped_banner_id === banner.id;
            const isBartBanner = banner.name === 'Click The Bart Banner';
            return (
              <div key={banner.id} className="bg-panel rounded-xl border border-white/10 overflow-hidden">
                {banner.image_url && <img src={banner.image_url} alt={banner.name} className="w-full h-24 object-cover" />}
                <div className="p-3">
                  <p className="font-display text-[#a7fcc9] text-sm">{banner.name}</p>
                  {isBartBanner ? (
                    <p className="text-xs text-white/60 mb-2">🎯 Click Bart 50× in 10s</p>
                  ) : (
                    <p className="text-xs text-white/60 mb-2">🪙 {banner.cost}</p>
                  )}
                  {isEquipped ? (
                    <Button size="sm" disabled className="w-full text-xs">Equipped</Button>
                  ) : isOwned ? (
                    <Button size="sm" className="w-full text-xs" onClick={() => equipBanner(banner.id)} disabled={busy} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Equip</Button>
                  ) : isBartBanner ? (
                    <Button size="sm" disabled className="w-full text-xs" title="Find and click Bart around the game to unlock this banner">
                      <Lock size={12} className="mr-1" />Locked
                    </Button>
                  ) : (
                    <Button size="sm" className="w-full text-xs" onClick={() => buyBanner(banner)} disabled={busy || profile?.tokens < banner.cost} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Buy</Button>
                  )}
                </div>
              </div>
            );
          })}
          {banners.length === 0 && <p className="col-span-full text-center text-white/60">No banners available</p>}
        </div>
      )}

      <BulkSellDialog open={bulkSellOpen} onOpenChange={setBulkSellOpen} ownedBlooks={ownedList} onSold={handleBulkSold} />

      <BlookDetailDialog
        blook={dialogBlook}
        initialAction={dialogAction}
        pack={dialogBlook?.pack_id ? packMap[dialogBlook.pack_id] : null}
        onClose={() => { setDialogBlook(null); setDialogAction(null); }}
        reload={load}
      />
    </div>
  );
}