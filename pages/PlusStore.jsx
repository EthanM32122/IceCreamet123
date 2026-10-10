import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import ColorPicker from '@/components/game/ColorPicker';
import StoreCard from '@/components/game/StoreCard';
import PlushStoreCard from '@/components/game/PlushStoreCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PLUS_BADGE_ID } from '@/lib/constants';
import { pullEveryblook, awardBlookToUser, getCrateRates } from '@/lib/everyblookCrate';

const PLUS_COST = 500000;
const CRATE_V1_COST = 100000;
const CRATE_V2_COST = 250000;

const PLUSHES = [
  { name: 'Kool Kat Plush', price: 4000000, color: '#111111', description: 'A cool black-cat plush rockin\' sunglasses. Exclusive Store collectible.', image: 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/0408d87f0_file_000000009b9081f6b607f99573e18c38-removebg-preview.png' },
  { name: 'Creepy TV Bot Plush', price: 4000000, color: '#202020', description: 'A creepy retro-TV bot plush that watches you back. Exclusive Store collectible.', image: 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/541fc1f3a_file_00000000557481f69958cae7ee371f33-removebg-preview.png' }
];

const PLUSH_EXPIRY = new Date('2026-10-12T23:59:59Z');

const COLLECTOR_TIERS = [
  { count: 1, badge: 'Collector' },
  { count: 2, badge: 'Golden Collector' },
  { count: 3, badge: 'Diamond Collector' },
  { count: 4, badge: 'Rainbow Collector' },
  { count: 5, badge: 'Void Collector' }
];

const DISCLAIMER = 'By clicking "Buy Now", you agree to ICECREAMET\'s Terms of Service and Privacy Policy. This is a one-time charge, you will NOT be charged monthly.';

const PLUS_FEATURES = [
  'Access To Banners', 'Exclusive Username Colors', 'Exclusive Chat Colors',
  'Exclusive Plus Badge', 'More Bazaar Listings', 'Access To Creating Clans',
  'Upload Files in Chat', 'Use Chat Embeds', 'Use Blook Emojis', 'Discord Plus Role'
];

export default function PlusStore() {
  const { profile, updateProfile, addTokens } = useGame();
  const [busy, setBusy] = useState(false);
  const [crateBusy, setCrateBusy] = useState(null);
  const [reveal, setReveal] = useState(null);
  const [rates, setRates] = useState(null);
  const [ratesBusy, setRatesBusy] = useState(null);
  const [nameColor, setNameColor] = useState(profile?.name_color || '');
  const [savingColor, setSavingColor] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [plushBlooks, setPlushBlooks] = useState({});
  const [plushBusy, setPlushBusy] = useState(null);
  const [collectorBadges, setCollectorBadges] = useState({});
  const [plushCount, setPlushCount] = useState(0);

  const isPlus = !!profile?.plus_permanent || (profile?.plus_until && new Date(profile.plus_until) > new Date());
  const isRainbow = (profile?.name_color || '').toLowerCase() === 'rainbow';

  const saveNameColor = async () => {
    setSavingColor(true);
    await updateProfile({ name_color: nameColor });
    setSavingColor(false);
  };

  const today = new Date().toDateString();
  const lastClaim = profile?.last_plus_claim ? new Date(profile.last_plus_claim).toDateString() : '';
  const canClaim = isPlus && today !== lastClaim;

  const claimDaily = async () => {
    if (!canClaim || claiming) return;
    setClaiming(true);
    await updateProfile({ tokens: (profile.tokens || 0) + 500, last_plus_claim: new Date().toISOString() });
    setClaiming(false);
  };

  const buyPlus = async () => {
    if (!profile || (profile.tokens || 0) < PLUS_COST) { alert('Not enough tokens (need 500,000)'); return; }
    setBusy(true);
    await updateProfile({ tokens: (profile.tokens || 0) - PLUS_COST, plus_permanent: true });
    const existing = await base44.entities.PlayerBadge.filter({ user_id: profile.user_id, badge_id: PLUS_BADGE_ID });
    if (existing.length === 0) await base44.entities.PlayerBadge.create({ user_id: profile.user_id, badge_id: PLUS_BADGE_ID });
    setBusy(false);
  };

  const toggleRainbow = async () => {
    if (!isPlus) return;
    const next = isRainbow ? '' : 'rainbow';
    setNameColor(next);
    await updateProfile({ name_color: next });
  };

  const openCrate = async (version) => {
    const cost = version === 1 ? CRATE_V1_COST : CRATE_V2_COST;
    if (!profile || (profile.tokens || 0) < cost) { alert(`Not enough tokens (need ${cost.toLocaleString()})`); return; }
    setCrateBusy(version);
    try {
      const pulled = await pullEveryblook(version);
      if (!pulled) { alert('No eligible blooks available right now.'); setCrateBusy(null); return; }
      await awardBlookToUser(profile.user_id, pulled);
      await updateProfile({ tokens: (profile.tokens || 0) - cost, total_packs_opened: (profile.total_packs_opened || 0) + 1 });
      setReveal({ blook: pulled, version });
    } catch (e) {
      alert('Something went wrong opening the crate.');
    }
    setCrateBusy(null);
  };

  const showRates = async (version) => {
    setRatesBusy(version);
    try {
      const data = await getCrateRates(version);
      setRates({ version, data });
    } catch (e) {
      alert('Could not load rates right now.');
    }
    setRatesBusy(null);
  };

  useEffect(() => {
    (async () => {
      try {
        const [koolkat, creepybot, allBadges] = await Promise.all([
          base44.entities.Blook.filter({ name: 'Kool Kat Plush', game: 'icecreamet' }),
          base44.entities.Blook.filter({ name: 'Creepy TV Bot Plush', game: 'icecreamet' }),
          base44.entities.Badge.filter({}, null, 200)
        ]);
        const map = {};
        if (koolkat[0]) map['Kool Kat Plush'] = koolkat[0];
        if (creepybot[0]) map['Creepy TV Bot Plush'] = creepybot[0];
        setPlushBlooks(map);
        const badgeMap = {};
        const tierNames = COLLECTOR_TIERS.map(t => t.badge);
        allBadges.forEach(b => { if (tierNames.includes(b.name)) badgeMap[b.name] = b; });
        setCollectorBadges(badgeMap);
      } catch (e) {
        console.error('Failed to load plush blooks', e);
      }
    })();
  }, []);

  useEffect(() => {
    if (!profile || Object.keys(plushBlooks).length === 0) return;
    (async () => {
      try {
        const plushIds = Object.values(plushBlooks).map(b => b.id).filter(Boolean);
        const playerBlooks = await base44.entities.PlayerBlook.filter({ user_id: profile.user_id, blook_id: { $in: plushIds } });
        const count = playerBlooks.reduce((s, pb) => s + (pb.quantity || 0) + (pb.shiny_quantity || 0), 0);
        setPlushCount(count);
      } catch (e) {}
    })();
  }, [profile, plushBlooks]);

  const buyPlush = async (plush) => {
    if (new Date() > PLUSH_EXPIRY) { alert('These plushies are no longer available!'); return; }
    if (!profile || (profile.tokens || 0) < plush.price) { alert(`Not enough tokens (need ${plush.price.toLocaleString()})`); return; }
    const blook = plushBlooks[plush.name];
    if (!blook) { alert('This plush is not available right now.'); return; }
    setPlushBusy(plush.name);
    try {
      await awardBlookToUser(profile.user_id, blook);
      await updateProfile({ tokens: (profile.tokens || 0) - plush.price });

      // Escalate collector badge
      const newCount = plushCount + 1;
      const tier = COLLECTOR_TIERS.filter(t => newCount >= t.count).pop();
      if (tier && collectorBadges[tier.badge]) {
        const collectorBadgeIds = Object.values(collectorBadges).map(b => b.id);
        const existing = await base44.entities.PlayerBadge.filter({ user_id: profile.user_id });
        const oldCollectorBadges = existing.filter(pb => collectorBadgeIds.includes(pb.badge_id));
        for (const pb of oldCollectorBadges) {
          await base44.entities.PlayerBadge.delete(pb.id);
        }
        await base44.entities.PlayerBadge.create({ user_id: profile.user_id, badge_id: collectorBadges[tier.badge].id });
      }
      setPlushCount(newCount);
      setReveal({ blook, version: 'plush' });
    } catch (e) {
      alert('Something went wrong purchasing this plush.');
    }
    setPlushBusy(null);
  };

  return (
    <div className="min-h-[78vh] rounded-2xl p-5 sm:p-8 bg-sidebar">
      <div className="flex items-center gap-3 mb-6 max-w-5xl mx-auto">
        <Link to="/market" className="text-white/70 hover:text-white transition-colors"><ArrowLeft size={22} /></Link>
        <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/2724130c5_file_00000000f0cc81f689edd7e643506d5b-removebg-preview.png" alt="ICECREAMET" className="h-8 w-auto object-contain" />
        <span className="font-display text-white text-lg">Store</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 max-w-5xl mx-auto mb-6 items-stretch">
        <StoreCard
          color="#00b8ff"
          title="Anything Crate V1"
          price="100,000"
          description="Can pull any active blook — uniform odds across the whole pool."
          bonus="1 Random Blook"
          buttonLabel={crateBusy === 1 ? 'Opening...' : 'Buy Now'}
          onBuy={() => openCrate(1)}
          disabled={crateBusy === 1 || (profile?.tokens || 0) < CRATE_V1_COST}
          onShowRates={() => showRates(1)}
          ratesLabel={ratesBusy === 1 ? 'Loading...' : 'View Rates'}
          disclaimer={DISCLAIMER}
        />

        <div className="lg:scale-105 lg:z-10">
          <StoreCard
            color="#3956e6"
            title="ICECREAMET Plus"
            price="500,000"
            perks={PLUS_FEATURES}
            bonus="+ Daily Tokens"
            buttonLabel={isPlus ? 'Already Owned' : (busy ? 'Processing...' : 'Buy Now')}
            onBuy={buyPlus}
            disabled={isPlus || busy || (profile?.tokens || 0) < PLUS_COST}
            disclaimer={DISCLAIMER}
            plusBadge
          />
        </div>

        <StoreCard
          color="#ffbc00"
          title="Anything Crate V2"
          price="250,000"
          description="Luckier than V1 — rarity-weighted odds that favor rare blooks."
          bonus="1 Boosted Blook"
          buttonLabel={crateBusy === 2 ? 'Opening...' : 'Buy Now'}
          onBuy={() => openCrate(2)}
          disabled={crateBusy === 2 || (profile?.tokens || 0) < CRATE_V2_COST}
          onShowRates={() => showRates(2)}
          ratesLabel={ratesBusy === 2 ? 'Loading...' : 'View Rates'}
          disclaimer={DISCLAIMER}
        />
      </div>

      <div className="max-w-5xl mx-auto mb-4">
        <h2 className="font-display text-white text-xl mb-1">🧸 Plush Collectibles</h2>
        <p className="text-xs text-white/60">Exclusive plush blooks — buy them with coins and add them to your collection.</p>
        {new Date() > PLUSH_EXPIRY ? (
          <p className="text-xs text-red-400 mt-1">⏰ These plushies are no longer available!</p>
        ) : (
          <p className="text-xs text-yellow-300/80 mt-1">⏰ Available until October 12, 2026 — then they're gone forever!</p>
        )}
        {plushCount > 0 && (() => {
          const tier = COLLECTOR_TIERS.filter(t => plushCount >= t.count).pop();
          return <p className="text-xs text-[#a7fcc9] mt-1">🏅 Collector Tier: {tier.badge} ({plushCount} plush{plushCount !== 1 ? 'es' : ''} owned)</p>;
        })()}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-5xl mx-auto mb-6">
        {PLUSHES.map(plush => (
          <PlushStoreCard
            key={plush.name}
            color={plush.color}
            title={plush.name}
            image={plush.image || plushBlooks[plush.name]?.image_url}
            price={plush.price.toLocaleString()}
            description={plush.description}
            buttonLabel={new Date() > PLUSH_EXPIRY ? 'Expired' : (plushBusy === plush.name ? 'Processing...' : 'Buy Now')}
            onBuy={() => buyPlush(plush)}
            disabled={new Date() > PLUSH_EXPIRY || plushBusy === plush.name || (profile?.tokens || 0) < plush.price}
            disclaimer={DISCLAIMER}
          />
        ))}
      </div>

      {isPlus && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
          <div className="bg-sidebar-accent rounded-xl border border-sidebar-border p-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-display text-white">🎁 Daily PLUS Bonus</h3>
              <p className="text-xs text-white/60">Claim 500 free tokens every day.</p>
            </div>
            <Button onClick={claimDaily} disabled={!canClaim || claiming} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>{canClaim ? (claiming ? 'Claiming...' : 'Claim 🪙 500') : 'Claimed today ✅'}</Button>
          </div>
          <div className="bg-sidebar-accent rounded-xl border border-sidebar-border p-4">
            <h3 className="font-display text-white mb-2">🎨 Username Color</h3>
            <div className="flex items-center gap-3 flex-wrap">
              <ColorPicker value={nameColor} onChange={setNameColor} />
              <Button size="sm" onClick={saveNameColor} disabled={savingColor || nameColor === (profile?.name_color || '')} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>{savingColor ? 'Saving...' : 'Save'}</Button>
              <Button size="sm" variant="outline" onClick={toggleRainbow} className="border-white/20 text-white">{isRainbow ? 'Disable Rainbow' : 'Rainbow'}</Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!reveal} onOpenChange={(open) => { if (!open) setReveal(null); }}>
        <DialogContent className="max-w-sm text-center">
          <p className="font-display text-[#a7fcc9] mb-2">You pulled a blook!</p>
          {reveal?.blook && (
            <>
              <div className="w-32 h-32 mx-auto flex items-center justify-center mb-3">
                {reveal.blook.image_url ? <img src={reveal.blook.image_url} alt={reveal.blook.name} className="w-full h-full object-contain animate-blook-rise" /> : <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/0d5e6b887_image.png" alt="" className="w-16 h-16 object-contain" />}
              </div>
              <p className={`font-display text-xl mb-1 rarity-${reveal.blook.rarity}`}>{reveal.blook.name}</p>
              <p className={`text-xs capitalize mb-4 rarity-${reveal.blook.rarity}`}>{reveal.blook.rarity}</p>
              <Button onClick={() => setReveal(null)} className="w-full" style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Keep</Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!rates} onOpenChange={(open) => { if (!open) setRates(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-display text-[#a7fcc9]">Anything Crate V{rates?.version} Rates</DialogTitle></DialogHeader>
          <p className="text-xs text-white/60 mb-3">Per-rarity chance per open. Trophies, Mega Charizard, Cube, Nexus, and Summer/Golden pack blooks are excluded.</p>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {rates?.data?.length === 0 && <p className="text-white/60 text-xs">No eligible blooks available.</p>}
            {rates?.data?.map(r => (
              <div key={r.rarity} className="flex items-center justify-between bg-sidebar-accent rounded-lg px-3 py-1.5">
                <span className={`text-sm capitalize rarity-${r.rarity}`}>{r.rarity}</span>
                <span className="text-xs text-white/80">{r.percent.toFixed(2)}% <span className="text-white/40">({r.count})</span></span>
              </div>
            ))}
          </div>
          <Button onClick={() => setRates(null)} className="w-full mt-4" style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Close</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}