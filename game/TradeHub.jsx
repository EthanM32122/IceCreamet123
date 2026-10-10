import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { RARITY_COLORS } from '@/lib/constants';
import { Plus, ArrowRight, Check } from 'lucide-react';

export default function TradeHub() {
  const { profile, updateProfile } = useGame();
  const [offers, setOffers] = useState([]);
  const [players, setPlayers] = useState([]);
  const [allBlooks, setAllBlooks] = useState([]);
  const [myBlooks, setMyBlooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [offerSel, setOfferSel] = useState([]);
  const [requestSel, setRequestSel] = useState([]);
  const [offerTokens, setOfferTokens] = useState(0);
  const [requestTokens, setRequestTokens] = useState(0);
  const [search, setSearch] = useState('');
  const [posting, setPosting] = useState(false);
  const [accepting, setAccepting] = useState(null);

  useEffect(() => {
    if (!profile) return;
    loadData();
  }, [profile?.user_id]);

  const loadData = async () => {
    const [publicTrades, allPlayers, ab, myPb] = await Promise.all([
      base44.entities.TradeRequest.filter({ is_public: true, status: 'pending' }),
      base44.entities.PlayerProfile.filter({}),
      base44.entities.Blook.filter({}),
      base44.entities.PlayerBlook.filter({ user_id: profile.user_id })
    ]);
    setOffers(publicTrades.filter(t => t.from_user_id !== profile.user_id));
    setPlayers(allPlayers);
    setAllBlooks(ab);
    setMyBlooks(myPb);
    setLoading(false);
  };

  const playerMap = {};
  players.forEach(p => { playerMap[p.user_id] = p; });
  const blookMap = {};
  allBlooks.forEach(b => { blookMap[b.id] = b; });

  const toggleOffer = (pb) => {
    setOfferSel(prev => prev.some(p => p.blook_id === pb.blook_id) ? prev.filter(p => p.blook_id !== pb.blook_id) : [...prev, { blook_id: pb.blook_id, quantity: 1 }]);
  };

  const toggleRequest = (blookId) => {
    setRequestSel(prev => prev.includes(blookId) ? prev.filter(id => id !== blookId) : [...prev, blookId]);
  };

  const postOffer = async () => {
    if (offerSel.length === 0 && offerTokens === 0) return;
    if (requestSel.length === 0 && requestTokens === 0) return;
    setPosting(true);
    await base44.entities.TradeRequest.create({
      from_user_id: profile.user_id, to_user_id: 'public', is_public: true,
      offered_blooks: JSON.stringify(offerSel),
      requested_blooks: JSON.stringify(requestSel.map(id => ({ blook_id: id, quantity: 1 }))),
      offered_tokens: offerTokens || 0, requested_tokens: requestTokens || 0, status: 'pending'
    });
    setPosting(false);
    setShowPostDialog(false);
    setOfferSel([]); setRequestSel([]); setOfferTokens(0); setRequestTokens(0);
    loadData();
  };

  const acceptOffer = async (trade) => {
    setAccepting(trade.id);
    try {
      const res = await base44.functions.invoke('acceptTradeOffer', { trade_id: trade.id });
      if (res?.data?.profile) {
        await updateProfile(res.data.profile);
      }
      loadData();
    } catch (e) {
      alert(e?.message || 'Trade failed');
    }
    setAccepting(null);
  };

  const filteredBlooks = allBlooks.filter(b => b.name?.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-4 border-panel/30 border-t-panel rounded-full animate-spin" /></div>;
  }

  const renderBlookChip = (blookId, quantity) => {
    const b = blookMap[blookId];
    if (!b) return null;
    return (
      <div key={blookId} className="flex items-center gap-1 bg-white/10 rounded px-1.5 py-1 text-xs">
        {b.image_url ? <img src={b.image_url} className="w-5 h-5 object-contain" alt="" /> : <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/0d5e6b887_image.png" alt="" className="w-5 h-5 object-contain" />}
        <span style={{ color: RARITY_COLORS[b.rarity] }}>{b.name}</span>
        {quantity > 1 && <span className="text-white/60">x{quantity}</span>}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-white/60">Browse public trade offers or post your own — no friends required!</p>
        <Button size="sm" onClick={() => setShowPostDialog(true)} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
          <Plus size={14} className="mr-1" /> Post Offer
        </Button>
      </div>

      {offers.length === 0 ? (
        <div className="bg-panel rounded-xl border border-white/10 p-8 text-center">
          <p className="text-white/60 text-sm">No public offers yet. Be the first to post one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map(trade => {
            const offered = JSON.parse(trade.offered_blooks || '[]');
            const requested = JSON.parse(trade.requested_blooks || '[]');
            const poster = playerMap[trade.from_user_id];
            return (
              <div key={trade.id} className="bg-panel rounded-xl border border-white/10 p-4">
                <div className="flex items-center justify-between mb-3">
                  <Link to={`/player/${trade.from_user_id}`} className="text-sm font-display text-[#a7fcc9] hover:underline">
                    {poster?.username || 'Unknown'}
                  </Link>
                  <Button size="sm" onClick={() => acceptOffer(trade)} disabled={accepting === trade.id} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
                    <Check size={14} className="mr-1" /> {accepting === trade.id ? 'Processing...' : 'Accept'}
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div>
                    <p className="text-xs text-white/60 mb-1 font-display">Offering</p>
                    <div className="flex flex-wrap gap-1">
                      {offered.map(o => renderBlookChip(o.blook_id, o.quantity))}
                      {(trade.offered_tokens > 0) && <span className="text-yellow-400 text-xs flex items-center">🪙 {trade.offered_tokens}</span>}
                    </div>
                  </div>
                  <ArrowRight size={20} className="text-[#a7fcc9] mx-auto" />
                  <div>
                    <p className="text-xs text-white/60 mb-1 font-display">Wants</p>
                    <div className="flex flex-wrap gap-1">
                      {requested.map(r => renderBlookChip(r.blook_id, r.quantity))}
                      {(trade.requested_tokens > 0) && <span className="text-yellow-400 text-xs flex items-center">🪙 {trade.requested_tokens}</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showPostDialog} onOpenChange={(open) => { if (!open) { setShowPostDialog(false); setOfferSel([]); setRequestSel([]); setOfferTokens(0); setRequestTokens(0); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Post a Trade Offer</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-display text-sm text-panel mb-2">Your Offer</h4>
              <div className="max-h-40 overflow-y-auto space-y-1 border rounded-lg p-2 mb-2">
                {myBlooks.map(pb => {
                  const b = blookMap[pb.blook_id];
                  if (!b) return null;
                  const sel = offerSel.some(p => p.blook_id === pb.blook_id);
                  return (
                    <button key={pb.id} onClick={() => toggleOffer(pb)}
                      className={`w-full flex items-center gap-2 p-1.5 rounded text-left text-xs ${sel ? 'bg-[#a7fcc9] ring-1 ring-panel' : 'hover:bg-muted'}`}>
                      {b.image_url ? <img src={b.image_url} className="w-6 h-6 object-contain" alt="" /> : <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/0d5e6b887_image.png" alt="" className="w-5 h-5 object-contain" />}
                      <span className="truncate" style={{ color: RARITY_COLORS[b.rarity] }}>{b.name}</span>
                      <span className="text-muted-foreground ml-auto">x{pb.quantity}</span>
                    </button>
                  );
                })}
                {myBlooks.length === 0 && <p className="text-muted-foreground text-xs text-center py-4">No blooks to offer</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">🪙</span>
                <Input type="number" value={offerTokens || ''} onChange={e => setOfferTokens(Math.max(0, parseInt(e.target.value) || 0))} placeholder="Tokens" className="h-8 text-xs" />
              </div>
            </div>
            <div>
              <h4 className="font-display text-sm text-panel mb-2">Request Blooks</h4>
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search blooks..." className="mb-2 h-8 text-xs" />
              <div className="max-h-40 overflow-y-auto space-y-1 border rounded-lg p-2 mb-2">
                {filteredBlooks.slice(0, 50).map(b => {
                  const sel = requestSel.includes(b.id);
                  return (
                    <button key={b.id} onClick={() => toggleRequest(b.id)}
                      className={`w-full flex items-center gap-2 p-1.5 rounded text-left text-xs ${sel ? 'bg-[#a7fcc9] ring-1 ring-panel' : 'hover:bg-muted'}`}>
                      {b.image_url ? <img src={b.image_url} className="w-6 h-6 object-contain" alt="" /> : <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/0d5e6b887_image.png" alt="" className="w-5 h-5 object-contain" />}
                      <span className="truncate" style={{ color: RARITY_COLORS[b.rarity] }}>{b.name}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">🪙</span>
                <Input type="number" value={requestTokens || ''} onChange={e => setRequestTokens(Math.max(0, parseInt(e.target.value) || 0))} placeholder="Tokens" className="h-8 text-xs" />
              </div>
            </div>
          </div>
          <Button onClick={postOffer} disabled={posting || (offerSel.length === 0 && offerTokens === 0) || (requestSel.length === 0 && requestTokens === 0)} style={{ backgroundColor: 'rgb(var(--user-sidebar))' }} className="w-full text-white">
            {posting ? 'Posting...' : 'Post Offer'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}