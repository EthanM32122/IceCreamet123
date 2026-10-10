import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RARITY_COLORS, ROLE_HIERARCHY } from '@/lib/constants';
import { Gavel, Search, Coins, Sparkles } from 'lucide-react';
import AuctionCard from '@/components/game/AuctionCard';

const DURATIONS = [
  { hours: 1, label: '1h' },
  { hours: 6, label: '6h' },
  { hours: 12, label: '12h' },
  { hours: 24, label: '1d' },
  { hours: 72, label: '3d' }
];

const ADMIN_ROLES = ['admin', 'co-owner', 'owner'];

export default function AuctionHouse() {
  const { profile, updateProfile } = useGame();
  const [auctions, setAuctions] = useState([]);
  const [myBlooks, setMyBlooks] = useState([]);
  const [allBlooks, setAllBlooks] = useState([]);
  const [showList, setShowList] = useState(false);
  const [isEventListing, setIsEventListing] = useState(false);
  const [selectedBlook, setSelectedBlook] = useState(null);
  const [startPrice, setStartPrice] = useState(50);
  const [duration, setDuration] = useState(24);
  const [now, setNow] = useState(Date.now());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all');

  const isAdmin = profile && ADMIN_ROLES.includes(profile.role);

  useEffect(() => {
    if (!profile) return;
    loadData();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [profile?.user_id]);

  const loadData = async () => {
    const [activeAuctions, myPb, ab] = await Promise.all([
      base44.entities.Auction.filter({ status: 'active', game: 'icecreamet' }),
      base44.entities.PlayerBlook.filter({ user_id: profile.user_id, game: 'icecreamet' }),
      base44.entities.Blook.filter({})
    ]);
    const nowMs = Date.now();
    const expired = activeAuctions.filter((a) => new Date(a.end_time).getTime() < nowMs - 86400000);
    if (expired.length) {
      await Promise.all(expired.map((a) => base44.entities.Auction.update(a.id, { status: 'cancelled' })));
    }
    const live = activeAuctions.filter((a) => new Date(a.end_time).getTime() >= nowMs - 86400000);
    setAuctions(live.sort((a, b) => new Date(a.end_time) - new Date(b.end_time)));
    setMyBlooks(myPb);
    setAllBlooks(ab);
  };

  const blookMap = {};
  allBlooks.forEach((b) => {
    blookMap[b.id] = b;
  });

  const listAuction = async () => {
    if (!selectedBlook) return;
    const b = blookMap[selectedBlook.blook_id];
    const endTime = new Date(Date.now() + duration * 3600000).toISOString();
    if (selectedBlook.isShiny) {
      const newSq = (selectedBlook.shiny_quantity || 0) - 1;
      if (newSq <= 0 && (selectedBlook.quantity || 0) <= 0) {
        await base44.entities.PlayerBlook.delete(selectedBlook.id);
      } else {
        await base44.entities.PlayerBlook.update(selectedBlook.id, { shiny_quantity: newSq });
      }
    } else {
      if (selectedBlook.quantity <= 1) {
        await base44.entities.PlayerBlook.delete(selectedBlook.id);
      } else {
        await base44.entities.PlayerBlook.update(selectedBlook.id, { quantity: selectedBlook.quantity - 1 });
      }
    }
    await base44.entities.Auction.create({
      seller_id: profile.user_id,
      seller_username: profile.username,
      blook_id: selectedBlook.blook_id,
      blook_name: b?.name || 'Unknown',
      blook_image_url: b?.image_url || '',
      blook_rarity: b?.rarity || 'uncommon',
      starting_price: startPrice,
      current_bid: 0,
      bid_count: 0,
      end_time: endTime,
      status: 'active',
      game: b?.game || 'icecreamet',
      is_shiny: !!selectedBlook.isShiny,
      is_event: isEventListing
    });
    setShowList(false);
    setIsEventListing(false);
    setSelectedBlook(null);
    setStartPrice(50);
    setDuration(24);
    loadData();
  };

  const placeBid = async (auction, amount) => {
    const minBid = auction.current_bid > 0 ? auction.current_bid + 1 : auction.starting_price;
    if (!amount || amount < minBid) return;
    if (amount > (profile.tokens || 0)) {
      alert('Not enough tokens!');
      return;
    }
    await base44.entities.Auction.update(auction.id, {
      current_bid: amount,
      current_bidder_id: profile.user_id,
      current_bidder_username: profile.username,
      bid_count: (auction.bid_count || 0) + 1
    });
    loadData();
  };

  const claimAuction = async (auction) => {
    if ((profile.tokens || 0) < auction.current_bid) {
      alert('Not enough tokens!');
      return;
    }
    const sellerBlooks = await base44.entities.PlayerBlook.filter({ user_id: auction.seller_id, blook_id: auction.blook_id });
    const sellerHas = sellerBlooks[0] && (auction.is_shiny ? (sellerBlooks[0].shiny_quantity || 0) >= 1 : (sellerBlooks[0].quantity || 0) >= 1);
    if (!sellerHas) {
      alert('Seller no longer has this blook!');
      await base44.entities.Auction.update(auction.id, { status: 'claimed' });
      loadData();
      return;
    }
    const sellerProfiles = await base44.entities.PlayerProfile.filter({ user_id: auction.seller_id });
    if (sellerProfiles[0]) {
      await base44.entities.PlayerProfile.update(sellerProfiles[0].id, { tokens: (sellerProfiles[0].tokens || 0) + auction.current_bid });
    }
    await updateProfile({ tokens: (profile.tokens || 0) - auction.current_bid });
    const sb = sellerBlooks[0];
    if (auction.is_shiny) {
      const newSq = (sb.shiny_quantity || 0) - 1;
      if (newSq <= 0 && (sb.quantity || 0) <= 0) {
        await base44.entities.PlayerBlook.delete(sb.id);
      } else {
        await base44.entities.PlayerBlook.update(sb.id, { shiny_quantity: newSq });
      }
    } else {
      if (sb.quantity > 1) {
        await base44.entities.PlayerBlook.update(sb.id, { quantity: sb.quantity - 1 });
      } else {
        await base44.entities.PlayerBlook.delete(sb.id);
      }
    }
    const myExisting = await base44.entities.PlayerBlook.filter({ user_id: profile.user_id, blook_id: auction.blook_id });
    if (myExisting[0]) {
      if (auction.is_shiny) {
        await base44.entities.PlayerBlook.update(myExisting[0].id, { shiny_quantity: (myExisting[0].shiny_quantity || 0) + 1 });
      } else {
        await base44.entities.PlayerBlook.update(myExisting[0].id, { quantity: myExisting[0].quantity + 1 });
      }
    } else {
      await base44.entities.PlayerBlook.create({ user_id: profile.user_id, blook_id: auction.blook_id, quantity: auction.is_shiny ? 0 : 1, shiny_quantity: auction.is_shiny ? 1 : 0, game: 'icecreamet' });
    }
    await base44.entities.Auction.update(auction.id, { status: 'claimed' });
    loadData();
  };

  const openListDialog = (eventMode) => {
    setIsEventListing(eventMode);
    setShowList(true);
    setSelectedBlook(null);
    setStartPrice(50);
    setDuration(24);
  };

  const filteredAuctions = auctions.filter((a) => {
    if (filterMode === 'regular' && a.is_event) return false;
    if (filterMode === 'event' && !a.is_event) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (a.blook_name || '').toLowerCase().includes(q) || (a.seller_username || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-2xl font-display text-panel">Auction House</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white rounded-xl px-3 py-1.5">
            <Coins size={16} className="text-[#ffcc00]" />
            <span className="font-display text-panel text-sm">{(profile?.tokens || 0).toLocaleString()}</span>
          </div>
          <Button onClick={() => openListDialog(false)} style={{ backgroundColor: 'rgb(var(--user-sidebar))' }}>
            <Gavel size={14} className="mr-1" /> List Blook
          </Button>
          {isAdmin && (
            <Button onClick={() => openListDialog(true)} className="bg-purple-500 hover:bg-purple-600 text-white">
              <Sparkles size={14} className="mr-1" /> Event Auction
            </Button>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by blook name or seller..."
            className="pl-9 bg-panel border-white/10 text-white placeholder:text-white/40"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'all', label: 'All' },
          { key: 'regular', label: 'Regular' },
          { key: 'event', label: 'Event' }
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilterMode(f.key)}
            className={`px-4 py-1.5 rounded-lg text-xs font-display transition-colors ${
              filterMode === f.key
                ? 'bg-panel text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Auction grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredAuctions.map((auction) => (
          <AuctionCard
            key={auction.id}
            auction={auction}
            profile={profile}
            now={now}
            onBid={placeBid}
            onClaim={claimAuction}
          />
        ))}
      </div>
      {filteredAuctions.length === 0 && (
        <p className="text-white/50 text-sm text-center py-8">
          {searchQuery || filterMode !== 'all' ? 'No auctions match your filters.' : 'No active auctions. List a blook to start!'}
        </p>
      )}

      {/* List dialog (shared for regular + event auctions) */}
      <Dialog open={showList} onOpenChange={(v) => { setShowList(v); if (!v) setIsEventListing(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEventListing ? '✨ List an Event Auction' : 'List a Blook for Auction'}
            </DialogTitle>
          </DialogHeader>
          {isEventListing && (
            <p className="text-xs text-purple-500 bg-purple-500/10 rounded-lg p-2 mb-2">
              Event Auctions are highlighted with a special EVENT badge and shown to all players.
            </p>
          )}
          <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2 mb-3">
            {myBlooks.flatMap((pb) => {
              const b = blookMap[pb.blook_id];
              if (!b) return [];
              const items = [
                <button
                  key={pb.id}
                  onClick={() => setSelectedBlook(pb)}
                  className={`w-full flex items-center gap-2 p-1.5 rounded text-left text-xs ${
                    selectedBlook?.id === pb.id && !selectedBlook?.isShiny ? 'bg-[#a7fcc9] ring-1 ring-panel' : 'hover:bg-muted'
                  }`}
                >
                  {b.image_url ? <img src={b.image_url} className="w-6 h-6 object-contain" alt="" /> : <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/0d5e6b887_image.png" alt="" className="w-6 h-6 object-contain" />}
                  <span className="truncate" style={{ color: RARITY_COLORS[b.rarity] }}>{b.name}</span>
                  <span className="text-muted-foreground ml-auto">x{pb.quantity}</span>
                </button>
              ];
              if ((pb.shiny_quantity || 0) > 0) {
                items.push(
                  <button
                    key={pb.id + '-shiny'}
                    onClick={() => setSelectedBlook({ ...pb, isShiny: true })}
                    className={`w-full flex items-center gap-2 p-1.5 rounded text-left text-xs ${
                      selectedBlook?.id === pb.id && selectedBlook?.isShiny ? 'bg-yellow-400 ring-1 ring-yellow-500' : 'hover:bg-muted'
                    }`}
                  >
                    {b.image_url ? <img src={b.image_url} className="w-6 h-6 object-contain shiny-blook" alt="" /> : <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/0d5e6b887_image.png" alt="" className="w-6 h-6 object-contain" />}
                    <span className="truncate text-yellow-600">✨ {b.name}</span>
                    <span className="text-yellow-600 ml-auto">x{pb.shiny_quantity}</span>
                  </button>
                );
              }
              return items;
            })}
            {myBlooks.length === 0 && <p className="text-muted-foreground text-xs text-center py-4">No blooks to list</p>}
          </div>
          {selectedBlook && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Starting Price (🪙)</label>
                <Input type="number" value={startPrice} onChange={(e) => setStartPrice(parseInt(e.target.value) || 0)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Duration</label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.hours}
                      onClick={() => setDuration(d.hours)}
                      className={`px-3 py-1 rounded text-xs ${duration === d.hours ? 'bg-panel text-white' : 'bg-muted'}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                onClick={listAuction}
                className="w-full"
                style={isEventListing ? { backgroundColor: '#a855f7', color: '#fff' } : { backgroundColor: 'rgb(var(--user-sidebar))' }}
              >
                {isEventListing ? '✨ List Event Auction' : 'List for Auction'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}