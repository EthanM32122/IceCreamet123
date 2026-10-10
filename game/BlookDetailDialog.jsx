import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { RARITY_COLORS, SELL_PRICES, PLACEHOLDER_BLOOK_IMG } from '@/lib/constants';
import { shinySellPrice, shinyDiamondValue } from '@/lib/shiny';
import { X, Coins, Gavel, Store, Gift } from 'lucide-react';
import { DiamondIcon, TokenIcon } from '@/components/game/CurrencyIcon';

export default function BlookDetailDialog({ blook, pack, onClose, reload, initialAction }) {
  const { profile, updateProfile } = useGame();
  const [action, setAction] = useState(null);
  const [sellQty, setSellQty] = useState(1);
  const [bazaarPrice, setBazaarPrice] = useState('');
  const [auctionPrice, setAuctionPrice] = useState('');
  const [auctionDays, setAuctionDays] = useState(1);
  const [busy, setBusy] = useState(false);
  const [shinySellQty, setShinySellQty] = useState(1);
  const [giftSearch, setGiftSearch] = useState('');
  const [giftSelected, setGiftSelected] = useState(null);
  const [giftQty, setGiftQty] = useState(1);
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    if (action === 'gift' && players.length === 0) {
      base44.entities.PlayerProfile.filter({}).then(ps => setPlayers(ps.filter(p => p.user_id !== profile?.user_id))).catch(() => {});
    }
  }, [action]);

  // When the dialog opens, jump straight to the requested action (if any).
  useEffect(() => {
    if (blook) setAction(initialAction || null);
  }, [blook, initialAction]);

  if (!blook) return null;

  const sellValue = blook.sell_price || SELL_PRICES[blook.rarity] || 5;
  const shinyValue = shinyDiamondValue(blook);
  const qty = blook.quantity || 1;
  const shinyQty = blook.shiny_quantity || 0;
  const bg = pack?.background_url
    ? `url(${pack.background_url}) center/cover`
    : 'linear-gradient(135deg, #a7fcc9, #6b3a8e)';

  const deduct = async (n) => {
    if (qty - n <= 0) {
      await base44.entities.PlayerBlook.delete(blook.pbId);
    } else {
      await base44.entities.PlayerBlook.update(blook.pbId, { quantity: qty - n });
    }
  };

  const deductShiny = async (n) => {
    const newSq = shinyQty - n;
    if (newSq <= 0 && qty <= 0) {
      await base44.entities.PlayerBlook.delete(blook.pbId);
    } else {
      await base44.entities.PlayerBlook.update(blook.pbId, { shiny_quantity: newSq });
    }
  };

  const doSell = async () => {
    if (busy) return;
    const n = Math.max(1, Math.min(sellQty, qty));
    setBusy(true);
    try {
      const total = n * sellValue;
      await deduct(n);
      await updateProfile({ tokens: (profile.tokens || 0) + total });
      reload();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const doShinySell = async () => {
    if (busy || shinyQty <= 0) return;
    const n = Math.max(1, Math.min(shinySellQty, shinyQty));
    setBusy(true);
    try {
      const total = Math.round((n * shinyValue) * 100) / 100;
      const newSq = shinyQty - n;
      if (newSq <= 0 && qty <= 0) {
        await base44.entities.PlayerBlook.delete(blook.pbId);
      } else {
        await base44.entities.PlayerBlook.update(blook.pbId, { shiny_quantity: newSq });
      }
      await updateProfile({ diamonds: Math.round(((profile.diamonds || 0) + total) * 100) / 100 });
      reload();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const doBazaar = async () => {
    const price = parseInt(bazaarPrice) || 0;
    if (price <= 0 || busy) return;
    setBusy(true);
    try {
      if (blook.isShiny) await deductShiny(1);
      else await deduct(1);
      await base44.entities.BazaarListing.create({
        seller_id: profile.user_id, seller_username: profile.username,
        blook_id: blook.id, price, status: 'active', game: blook.game || 'icecreamet', is_shiny: !!blook.isShiny
      });
      reload();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const doGift = async () => {
    if (!giftSelected || busy) return;
    const n = Math.max(1, Math.min(giftQty, blook.isShiny ? shinyQty : qty));
    setBusy(true);
    try {
      const res = await base44.functions.invoke('giftBlook', {
        receiver_user_id: giftSelected.user_id,
        blook_id: blook.id,
        quantity: n,
        is_shiny: !!blook.isShiny
      });
      if (res?.data?.error) { alert(res.data.error); return; }
      alert(`Gifted ${n}× ${blook.name}${blook.isShiny ? ' ✨' : ''} to ${giftSelected.username}!`);
      reload();
      onClose();
    } catch (e) {
      alert(e.message || 'Failed to send gift');
    } finally {
      setBusy(false);
    }
  };

  const doAuction = async () => {
    const price = parseInt(auctionPrice) || 0;
    if (price <= 0 || busy) return;
    setBusy(true);
    try {
      if (blook.isShiny) await deductShiny(1);
      else await deduct(1);
      const end = new Date(Date.now() + auctionDays * 86400000).toISOString();
      await base44.entities.Auction.create({
        seller_id: profile.user_id, seller_username: profile.username, blook_id: blook.id,
        blook_name: blook.name, blook_image_url: blook.image_url, blook_rarity: blook.rarity,
        starting_price: price, current_bid: price, end_time: end, status: 'active', game: 'icecreamet', is_shiny: !!blook.isShiny
      });
      reload();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!blook} onOpenChange={(o) => { if (!o) { setAction(null); onClose(); } }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-0" style={{ backgroundColor: '#8e44ad', borderRadius: '1rem' }}>
        <button onClick={onClose} className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50">
          <X size={16} />
        </button>
        <div className="flex flex-col sm:flex-row">
          {/* Left: blook image on pack background */}
          <div className="sm:w-1/2 aspect-square sm:aspect-auto sm:min-h-[320px] relative" style={{ background: bg, backgroundSize: 'cover', backgroundPosition: 'center' }}>
            {blook.image_url ? (
              <img src={blook.image_url} alt={blook.name} className={`absolute inset-0 w-full h-full object-contain p-6 drop-shadow-2xl ${blook.isShiny ? 'shiny-blook' : ''}`} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center"><img src={PLACEHOLDER_BLOOK_IMG} alt="" className="w-24 h-24 object-contain rounded-lg" /></div>
            )}
          </div>
          {/* Right: details + actions */}
          <div className="sm:w-1/2 p-5 text-white flex flex-col">
            <h2 className="text-2xl font-display leading-tight">{blook.isShiny && '✨ '}{blook.name}</h2>
            <p className="text-sm text-white/80 mb-3">{pack?.name || 'Unknown Pack'}</p>

            <div className="flex flex-wrap gap-2 mb-3">
              <span className="inline-flex items-center gap-1 text-xs font-display px-2 py-1 rounded-full capitalize" style={{ backgroundColor: 'rgba(0,0,0,0.25)', color: RARITY_COLORS[blook.rarity] || '#fff' }}>
                ▲ {blook.rarity}
              </span>
              {blook.isShiny && (
                <span className="inline-flex items-center gap-1 text-xs font-display px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(241,196,15,0.25)', color: '#fde68a' }}>
                  ✨ Shiny
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-xs font-display px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.25)', color: '#f1c40f' }}>
                <Coins size={12} /> {sellValue}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-display px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.25)', color: '#fff' }}>
                ★ {qty}
              </span>
            </div>

            <div className="rounded-lg px-3 py-2 mb-4 text-sm font-display text-white flex items-center gap-3" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
              <span>★ {qty} normal</span>
              {shinyQty > 0 && <span className="text-yellow-300">✨ {shinyQty} shiny</span>}
            </div>

            {!action && (
              <div className="space-y-2 mt-auto">
                <div className="flex items-center gap-2">
                  <Input type="number" min={1} max={qty} value={sellQty} onChange={e => setSellQty(Math.max(1, Math.min(qty, parseInt(e.target.value) || 1)))} className="w-20 bg-black/30 border-white/20 text-white" />
                  <Button onClick={doSell} disabled={busy} className="flex-1 text-white border-0" style={{ backgroundColor: '#34495e' }}>
                    Sell {sellQty} for <TokenIcon size={14} /> {sellQty * sellValue}
                  </Button>
                </div>
                {shinyQty > 0 && (
                  <div className="flex items-center gap-2">
                    <Input type="number" min={1} max={shinyQty} value={shinySellQty} onChange={e => setShinySellQty(Math.max(1, Math.min(shinyQty, parseInt(e.target.value) || 1)))} className="w-20 bg-black/30 border-yellow-500/50 text-yellow-300" />
                    <Button onClick={doShinySell} disabled={busy} className="flex-1 text-black border-0" style={{ backgroundColor: '#f1c40f' }}>
                      ✨ Sell {shinySellQty} Shiny for <DiamondIcon size={14} /> {(shinySellQty * shinyValue).toLocaleString()}
                    </Button>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <Button onClick={() => setAction('bazaar')} variant="outline" className="bg-black/20 border-white/30 text-white hover:bg-black/40 hover:text-white"><Store size={14} className="mr-1" /> {blook.isShiny ? '✨ Bazaar' : 'Bazaar'}</Button>
                  <Button onClick={() => setAction('auction')} variant="outline" className="bg-black/20 border-white/30 text-white hover:bg-black/40 hover:text-white"><Gavel size={14} className="mr-1" /> {blook.isShiny ? '✨ Auction' : 'Auction'}</Button>
                  <Button onClick={() => setAction('gift')} variant="outline" className="bg-black/20 border-white/30 text-white hover:bg-black/40 hover:text-white"><Gift size={14} className="mr-1" /> {blook.isShiny ? '✨ Gift' : 'Gift'}</Button>
                </div>
              </div>
            )}

            {action === 'bazaar' && (
              <div className="mt-auto space-y-2">
                <p className="text-xs text-white/80">List on Bazaar for how many tokens?</p>
                <Input type="number" value={bazaarPrice} onChange={e => setBazaarPrice(e.target.value)} placeholder="Price" className="bg-black/30 border-white/20 text-white placeholder:text-white/50" />
                <div className="flex gap-2">
                  <Button onClick={doBazaar} disabled={busy || !bazaarPrice} className="flex-1 text-white border-0" style={{ backgroundColor: '#34495e' }}>{busy ? 'Listing...' : 'Confirm Listing'}</Button>
                  <Button onClick={() => setAction(null)} variant="outline" className="bg-black/20 border-white/30 text-white hover:bg-black/40 hover:text-white">Cancel</Button>
                </div>
              </div>
            )}

            {action === 'auction' && (
              <div className="mt-auto space-y-2">
                <p className="text-xs text-white/80">Starting bid (tokens):</p>
                <Input type="number" value={auctionPrice} onChange={e => setAuctionPrice(e.target.value)} placeholder="Starting price" className="bg-black/30 border-white/20 text-white placeholder:text-white/50" />
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-white/80">Duration:</span>
                  {[1, 3, 7].map(d => (
                    <button key={d} onClick={() => setAuctionDays(d)} className={`px-2 py-1 rounded text-xs font-display ${auctionDays === d ? 'bg-white text-[#8e44ad]' : 'bg-black/30 text-white'}`}>{d}d</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button onClick={doAuction} disabled={busy || !auctionPrice} className="flex-1 text-white border-0" style={{ backgroundColor: '#34495e' }}>{busy ? 'Listing...' : 'Confirm Auction'}</Button>
                  <Button onClick={() => setAction(null)} variant="outline" className="bg-black/20 border-white/30 text-white hover:bg-black/40 hover:text-white">Cancel</Button>
                </div>
              </div>
            )}

            {action === 'gift' && (
              <div className="mt-auto space-y-2">
                <p className="text-xs text-white/80">Gift {blook.isShiny ? '✨ ' : ''}{blook.name} to:</p>
                <Input value={giftSearch} onChange={e => setGiftSearch(e.target.value)} placeholder="Search player by username..." className="bg-black/30 border-white/20 text-white placeholder:text-white/50" />
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {players.filter(p => p.username?.toLowerCase().includes(giftSearch.toLowerCase())).slice(0, 10).map(p => (
                    <button key={p.user_id} onClick={() => setGiftSelected(p)} className={`w-full flex items-center gap-2 p-1.5 rounded text-left text-xs ${giftSelected?.user_id === p.user_id ? 'bg-[#a7fcc9] text-[#8e44ad] ring-1 ring-[#8e44ad]' : 'bg-black/20 text-white hover:bg-black/40'}`}>
                      {p.avatar_url ? <img src={p.avatar_url} className="w-5 h-5 avatar-rounded-square object-cover" alt="" /> : <span className="w-5 h-5 flex items-center justify-center bg-white/10 rounded">{p.username?.[0]?.toUpperCase()}</span>}
                      <span className="truncate">{p.username}</span>
                    </button>
                  ))}
                </div>
                {giftSelected && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/80">Qty:</span>
                    <Input type="number" min={1} max={blook.isShiny ? shinyQty : qty} value={giftQty} onChange={e => setGiftQty(Math.max(1, Math.min(blook.isShiny ? shinyQty : qty, parseInt(e.target.value) || 1)))} className="w-16 bg-black/30 border-white/20 text-white" />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button onClick={doGift} disabled={busy || !giftSelected} className="flex-1 text-white border-0" style={{ backgroundColor: '#27ae60' }}>{busy ? 'Sending...' : 'Send Gift'}</Button>
                  <Button onClick={() => { setAction(null); setGiftSelected(null); setGiftSearch(''); setGiftQty(1); }} variant="outline" className="bg-black/20 border-white/30 text-white hover:bg-black/40 hover:text-white">Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}