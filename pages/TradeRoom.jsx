import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Search, Coins, X } from 'lucide-react';
import { getActiveBlooks } from '@/lib/gameDataCache';

export default function TradeRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { profile, updateProfile } = useGame();
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [blookMap, setBlookMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [chat, setChat] = useState('');
  const [tokenInput, setTokenInput] = useState(0);
  const [themBalance, setThemBalance] = useState(0);
  const [busy, setBusy] = useState(false);

  const completedRef = useRef(false);
  const chatEndRef = useRef(null);

  // load blook data
  useEffect(() => {
    if (!room) return;
    base44.entities.Blook.filter({ is_active: true, is_deleted: false }).then(bs => {
      const map = {}; bs.forEach(b => { map[b.id] = b; });
      setBlookMap(map);
    }).catch(() => {});
  }, [room?.id]);

  // load + subscribe room
  useEffect(() => {
    if (!roomId) return;
    base44.entities.TradeRoom.get(roomId).then(r => { setRoom(r); setLoading(false); }).catch(() => setLoading(false));
    const u1 = base44.entities.TradeRoom.subscribe(e => { if (e.data?.id === roomId) setRoom(e.data); });
    base44.entities.TradeMessage.filter({ room_id: roomId }).then(ms => setMessages(ms.sort((a, b) => new Date(a.created_date) - new Date(b.created_date))));
    const u2 = base44.entities.TradeMessage.subscribe(e => {
      if (e.data?.room_id !== roomId) return;
      setMessages(prev => {
        if (e.type === 'create') return prev.find(m => m.id === e.data.id) ? prev : [...prev, e.data].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
        if (e.type === 'delete') return prev.filter(m => m.id !== e.data.id);
        return prev;
      });
    });
    return () => { u1 && u1(); u2 && u2(); };
  }, [roomId]);

  // load my inventory + their balance
  useEffect(() => {
    if (!room || !profile) return;
    base44.entities.PlayerBlook.filter({ user_id: profile.user_id }).then(setInventory).catch(() => {});
    const otherId = room.player_a_id === profile.user_id ? room.player_b_id : room.player_a_id;
    base44.entities.PlayerProfile.filter({ user_id: otherId }).then(ps => setThemBalance(ps[0]?.tokens || 0)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, profile?.user_id]);

  // auto-scroll chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const isA = room && profile && room.player_a_id === profile.user_id;
  const me = profile;
  const them = room ? (isA ? { username: room.player_b_username, avatar: room.player_b_avatar } : { username: room.player_a_username, avatar: room.player_a_avatar }) : null;
  const myOfferIds = room ? (JSON.parse((isA ? room.a_blooks : room.b_blooks) || '[]')) : [];
  const theirOfferIds = room ? (JSON.parse((isA ? room.b_blooks : room.a_blooks) || '[]')) : [];
  const myTokens = room ? (isA ? (room.a_tokens || 0) : (room.b_tokens || 0)) : 0;
  const theirTokens = room ? (isA ? (room.b_tokens || 0) : (room.a_tokens || 0)) : 0;
  const myAccepted = room ? (isA ? room.a_accepted : room.b_accepted) : false;
  const theirAccepted = room ? (isA ? room.b_accepted : room.a_accepted) : false;

  // keep token input synced with the saved offer
  useEffect(() => { setTokenInput(myTokens || 0); }, [myTokens]);

  // completion watcher — only player A executes to prevent the double-
  // execution race where both clients fire executeTrade simultaneously and
  // the backend transfers blooks twice. Player B gets a 3s fallback in case
  // A's client is closed or unresponsive.
  useEffect(() => {
    if (!room || !profile) return;
    if (room.status === 'active' && room.a_accepted && room.b_accepted && !completedRef.current) {
      if (room.player_a_id === profile.user_id) {
        executeTrade(room);
      } else if (room.player_b_id === profile.user_id) {
        const timer = setTimeout(() => { if (!completedRef.current) executeTrade(room); }, 3000);
        return () => clearTimeout(timer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  // polling fallback: re-fetch room every 3s in case subscriptions miss updates
  useEffect(() => {
    if (!roomId) return;
    const interval = setInterval(async () => {
      try { const r = await base44.entities.TradeRoom.get(roomId); setRoom(r); } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [roomId]);

  // refresh my tokens when completed
  useEffect(() => {
    if (!room || !profile) return;
    if (room.status !== 'completed') return;
    base44.entities.PlayerProfile.filter({ user_id: profile.user_id }).then(ps => { if (ps[0]) updateProfile({ tokens: ps[0].tokens }); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.status]);

  const parseEntry = (entry) => {
    if (typeof entry !== 'string') return { id: entry, isShiny: false };
    if (entry.endsWith(':shiny')) return { id: entry.slice(0, -6), isShiny: true };
    return { id: entry, isShiny: false };
  };

  const ownedCount = (blookId) => {
    const pb = inventory.find(p => p.blook_id === blookId);
    return pb ? (pb.quantity || 1) : 0;
  };
  const ownedShinyCount = (blookId) => {
    const pb = inventory.find(p => p.blook_id === blookId);
    return pb ? (pb.shiny_quantity || 0) : 0;
  };
  const inOfferCount = (entry) => myOfferIds.filter(e => e === entry).length;

  const updateMyOffer = async (newIds, newTokens) => {
    if (!room) return;
    const patch = isA
      ? { a_blooks: JSON.stringify(newIds), a_tokens: newTokens, a_accepted: false, b_accepted: false }
      : { b_blooks: JSON.stringify(newIds), b_tokens: newTokens, a_accepted: false, b_accepted: false };
    await base44.entities.TradeRoom.update(room.id, patch);
  };

  const addBlook = (blookId, isShiny = false) => {
    const entry = isShiny ? blookId + ':shiny' : blookId;
    const max = isShiny ? ownedShinyCount(blookId) : ownedCount(blookId);
    if (myOfferIds.length >= 4) return;
    if (inOfferCount(entry) >= max) return;
    updateMyOffer([...myOfferIds, entry], myTokens);
  };
  const removeSlot = (idx) => {
    const arr = [...myOfferIds]; arr.splice(idx, 1);
    updateMyOffer(arr, myTokens);
  };
  const setTokens = (val) => {
    const v = Math.max(0, Math.min(val, me?.tokens || 0));
    setTokenInput(v);
    updateMyOffer(myOfferIds, v);
  };

  const sendChat = async () => {
    if (!chat.trim() || !room || !me) return;
    await base44.entities.TradeMessage.create({ room_id: room.id, user_id: me.user_id, username: me.username, avatar_url: me.avatar_url, content: chat.trim() });
    setChat('');
  };

  const toggleAccept = async () => {
    if (!room || room.status !== 'active') return;
    setBusy(true);
    const patch = isA ? { a_accepted: !myAccepted } : { b_accepted: !myAccepted };
    await base44.entities.TradeRoom.update(room.id, patch);
    setBusy(false);
  };

  const decline = async () => {
    if (!room) return;
    await base44.entities.TradeRoom.update(room.id, { status: 'cancelled' });
    await base44.entities.TradeMessage.create({ room_id: room.id, is_system: true, username: 'Trade Bot', content: `${me?.username} declined the trade.` }).catch(() => {});
  };

  const acceptInvite = async () => {
    if (!room) return;
    await base44.entities.TradeRoom.update(room.id, { status: 'active' });
    await base44.entities.TradeMessage.create({ room_id: room.id, is_system: true, username: 'Trade Bot', content: `${me?.username} accepted the trade request.` }).catch(() => {});
  };

  const executeTrade = async (r) => {
    if (completedRef.current) return;
    completedRef.current = true;
    try {
      const fresh = await base44.entities.TradeRoom.get(r.id);
      if (fresh.status !== 'active') { completedRef.current = false; return; }
      // Server-authoritative execution: the executeTrade backend function
      // re-validates ownership + balances and moves blooks/tokens with full
      // permission (asServiceRole), so cross-player data can actually change.
      // The backend also sets the room to completed and posts the ✅ message.
      await base44.functions.invoke('executeTrade', { room_id: r.id });
    } catch (e) {
      completedRef.current = false;
      // If the backend died mid-execution it leaves the room "completing" —
      // unwind to an editable state so the players can retry. A validation
      // failure already reset the room to active server-side, so no duplicate
      // message is posted there.
      try {
        const fr = await base44.entities.TradeRoom.get(r.id);
        if (fr.status === 'completing') {
          await base44.entities.TradeRoom.update(r.id, { status: 'active', a_accepted: false, b_accepted: false });
          await base44.entities.TradeMessage.create({ room_id: r.id, is_system: true, username: 'Trade Bot', content: '⚠️ ' + (e?.message || 'Trade failed') }).catch(() => {});
        }
      } catch {}
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-panel/30 border-t-panel rounded-full animate-spin" /></div>;
  if (!room) return <div className="text-center py-12 text-white/60">Trade not found. <button onClick={() => navigate('/trade')} className="text-[#a7fcc9] underline">Back</button></div>;

  const myInvList = inventory.map(pb => ({ pb, blook: blookMap[pb.blook_id] })).filter(x => x.blook);
  const filteredInv = myInvList.filter(x => x.blook.name?.toLowerCase().includes(search.toLowerCase()));

  if (room.status === 'pending') {
    const imRecipient = room.player_b_id === me?.user_id;
    return (
      <div className="max-w-md mx-auto mt-10 rounded-2xl p-6 text-center" style={{ backgroundColor: '#2e2e2e' }}>
        <h2 className="font-display text-[#a7fcc9] text-xl mb-2">Trade Request</h2>
        <p className="text-white/80 mb-4">{imRecipient ? `${room.player_a_username} wants to trade with you!` : `Waiting for ${room.player_b_username} to accept...`}</p>
        <div className="flex gap-2">
          {imRecipient ? (
            <>
              <Button className="flex-1" style={{ backgroundColor: '#2ecc71', color: '#fff' }} onClick={acceptInvite}>Accept</Button>
              <Button className="flex-1" style={{ backgroundColor: '#e74c3c', color: '#fff' }} onClick={decline}>Decline</Button>
            </>
          ) : (
            <Button className="flex-1" variant="outline" onClick={decline} style={{ borderColor: '#e74c3c', color: '#e74c3c' }}>Cancel Request</Button>
          )}
        </div>
      </div>
    );
  }

  if (room.status === 'declined' || room.status === 'cancelled') {
    return (
      <div className="max-w-md mx-auto mt-10 rounded-2xl p-6 text-center" style={{ backgroundColor: '#2e2e2e' }}>
        <p className="text-white/80 mb-4">{room.status === 'declined' ? 'Trade request declined.' : 'Trade cancelled.'}</p>
        <Button onClick={() => navigate('/trade')} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Back to Trade</Button>
      </div>
    );
  }
  if (room.status === 'completed') {
    return (
      <div className="max-w-md mx-auto mt-10 rounded-2xl p-6 text-center" style={{ backgroundColor: '#2e2e2e' }}>
        <p className="text-3xl mb-2">🤝</p>
        <p className="font-display text-[#a7fcc9] text-xl mb-4">Trade Completed!</p>
        <Button onClick={() => navigate('/trade')} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Back to Trade</Button>
      </div>
    );
  }

  const Slot = ({ entry, idx, mine }) => {
    const { id, isShiny } = parseEntry(entry);
    const b = blookMap[id];
    if (mine) {
      return (
        <button onClick={() => removeSlot(idx)} className={`aspect-square rounded-md overflow-hidden relative ${isShiny ? 'ring-2 ring-yellow-400' : ''}`} style={{ background: '#1c1c1c' }} title={b?.name}>
          {b?.image_url ? <img src={b.image_url} className={`w-full h-full object-contain p-1 ${isShiny ? 'shiny-blook' : ''}`} alt={b.name} /> : <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/0d5e6b887_image.png" alt="" className="w-6 h-6 object-contain opacity-60" />}
          {isShiny && <span className="absolute top-0.5 left-0.5 text-[8px]">✨</span>}
          <X size={12} className="absolute top-0.5 right-0.5 text-red-400" />
        </button>
      );
    }
    return (
      <div className={`aspect-square rounded-md overflow-hidden relative ${isShiny ? 'ring-2 ring-yellow-400' : ''}`} style={{ background: '#1c1c1c' }} title={b?.name}>
        {b?.image_url ? <img src={b.image_url} className={`w-full h-full object-contain p-1 ${isShiny ? 'shiny-blook' : ''}`} alt={b.name} /> : <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/0d5e6b887_image.png" alt="" className="w-6 h-6 object-contain opacity-60" />}
        {isShiny && <span className="absolute top-0.5 left-0.5 text-[8px]">✨</span>}
      </div>
    );
  };
  const EmptySlot = () => <div className="aspect-square rounded-md border border-dashed border-white/15" />;
  const renderSlots = (ids, mine) => (
    <div className="grid grid-cols-2 gap-1.5">
      {Array.from({ length: 4 }).map((_, i) => ids[i] ? <Slot key={i} entry={ids[i]} idx={i} mine={mine} /> : <EmptySlot key={i} />)}
    </div>
  );

  const checker = {
    backgroundColor: '#2e2e2e',
    backgroundImage: `linear-gradient(45deg, #262626 25%, transparent 25%), linear-gradient(-45deg, #262626 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #262626 75%), linear-gradient(-45deg, transparent 75%, #262626 75%)`,
    backgroundSize: '20px 20px',
    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
  };
  const inputStyle = { background: '#1c1c1c', borderColor: '#444', color: '#fff' };
  const canAccept = room.status === 'active';

  return (
    <div className="rounded-2xl overflow-hidden border border-white/10" style={checker}>
      <div className="flex items-center justify-between p-3 border-b border-black/30" style={{ background: 'rgba(0,0,0,0.25)' }}>
        <button onClick={() => navigate('/trade')} className="text-white/70 hover:text-white flex items-center gap-1 text-sm"><ArrowLeft size={16} /> Leave</button>
        <span className="font-display text-[#a7fcc9]">Live Trade</span>
        <span className="text-xs text-white/60">{room.status === 'completing' ? 'Completing...' : theirAccepted ? 'They accepted ✓' : ''}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr_1fr] gap-3 p-3">
        {/* My side (left) */}
        <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-12 h-12 avatar-rounded-square bg-white/10 overflow-hidden flex items-center justify-center">
              {me?.avatar_url ? <img src={me.avatar_url} className="w-full h-full object-cover" alt="" /> : <span className="text-white">{me?.username?.[0]?.toUpperCase()}</span>}
            </div>
            <div>
              <p className="font-display text-sm text-[#f1c40f]">{me?.username} (You)</p>
              <p className="text-xs text-[#f1c40f]">🪙 {me?.tokens?.toLocaleString() || 0}</p>
            </div>
          </div>
          {renderSlots(myOfferIds, true)}
          <div className="flex items-center gap-1 mt-2">
            <Coins size={14} className="text-[#f1c40f]" />
            <Input type="number" value={tokenInput} onChange={e => setTokens(parseInt(e.target.value) || 0)} className="h-8 text-sm" style={inputStyle} />
          </div>
        </div>

        {/* Center: inventory + chat */}
        <div className="flex flex-col gap-3">
          <div className="rounded-xl p-2" style={{ background: 'rgba(0,0,0,0.3)' }}>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/40" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your blooks..." className="pl-7 h-8 text-sm" style={inputStyle} />
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5 max-h-44 overflow-y-auto pr-1">
              {filteredInv.flatMap(({ pb, blook }) => {
                const normalUsed = inOfferCount(blook.id);
                const normalMax = ownedCount(blook.id);
                const normalDisabled = myOfferIds.length >= 4 || normalUsed >= normalMax;
                const items = [
                  <button key={pb.id} onClick={() => addBlook(blook.id)} disabled={normalDisabled} className={`aspect-square rounded-md overflow-hidden relative ${normalDisabled ? 'opacity-40' : 'hover:ring-1 ring-[#a7fcc9]'}`} style={{ background: '#1c1c1c' }} title={blook.name}>
                    {blook.image_url ? <img src={blook.image_url} className="w-full h-full object-contain p-0.5" alt={blook.name} /> : <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/0d5e6b887_image.png" alt="" className="w-6 h-6 object-contain" />}
                    <span className="absolute bottom-0 right-0 text-[9px] text-white/70 bg-black/50 px-0.5 rounded">{normalMax}</span>
                  </button>
                ];
                if ((pb.shiny_quantity || 0) > 0) {
                  const shinyEntry = blook.id + ':shiny';
                  const shinyUsed = inOfferCount(shinyEntry);
                  const shinyMax = ownedShinyCount(blook.id);
                  const shinyDisabled = myOfferIds.length >= 4 || shinyUsed >= shinyMax;
                  items.push(
                    <button key={pb.id + '-shiny'} onClick={() => addBlook(blook.id, true)} disabled={shinyDisabled} className={`aspect-square rounded-md overflow-hidden relative ring-1 ring-yellow-400/50 ${shinyDisabled ? 'opacity-40' : 'hover:ring-2 hover:ring-yellow-400'}`} style={{ background: '#1c1c1c' }} title={`✨ ${blook.name}`}>
                      {blook.image_url ? <img src={blook.image_url} className="w-full h-full object-contain p-0.5 shiny-blook" alt={blook.name} /> : <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/0d5e6b887_image.png" alt="" className="w-6 h-6 object-contain" />}
                      <span className="absolute top-0.5 left-0.5 text-[8px]">✨</span>
                      <span className="absolute bottom-0 right-0 text-[9px] text-yellow-300 bg-black/50 px-0.5 rounded">{shinyMax}</span>
                    </button>
                  );
                }
                return items;
              })}
              {filteredInv.length === 0 && <p className="col-span-full text-center text-white/40 text-xs py-3">No blooks</p>}
            </div>
          </div>

          <div className="rounded-xl p-2 flex-1 flex flex-col" style={{ background: 'rgb(var(--user-sidebar))' }}>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-52">
              {messages.map(m => m.is_system ? (
                <div key={m.id} className="text-center text-xs text-[#a7fcc9] py-0.5">{m.content}</div>
              ) : (
                <div key={m.id} className="flex items-start gap-1.5">
                  <div className="w-5 h-5 avatar-rounded-square bg-white/10 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {m.avatar_url ? <img src={m.avatar_url} className="w-full h-full object-cover" alt="" /> : <span className="text-[9px] text-white">{m.username?.[0]?.toUpperCase()}</span>}
                  </div>
                  <div><span className="text-xs text-white/70">{m.username}: </span><span className="text-sm text-white">{m.content}</span></div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="flex gap-1 mt-2">
              <Input value={chat} onChange={e => setChat(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendChat(); }} placeholder="Message..." className="h-8 text-sm" style={inputStyle} />
              <Button size="sm" onClick={sendChat} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Send</Button>
            </div>
          </div>
        </div>

        {/* Their side (right) */}
        <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-12 h-12 avatar-rounded-square bg-white/10 overflow-hidden flex items-center justify-center relative">
              {them?.avatar ? <img src={them.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-white">{them?.username?.[0]?.toUpperCase()}</span>}
              <span className="absolute bottom-0 left-0 w-2.5 h-2.5 rounded-full bg-green-500 border border-black/30" />
            </div>
            <div>
              <p className="font-display text-sm text-[#9b59b6]">{them?.username}</p>
              <p className="text-xs text-[#f1c40f]">🪙 {themBalance.toLocaleString()}</p>
            </div>
          </div>
          {renderSlots(theirOfferIds, false)}
          <div className="flex items-center gap-1 mt-2">
            <Coins size={14} className="text-[#f1c40f]" />
            <div className="h-8 flex items-center px-2 rounded text-sm text-[#f1c40f]" style={{ background: '#1c1c1c', border: '1px solid #444' }}>{theirTokens || 0}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3 border-t border-black/30" style={{ background: 'rgba(0,0,0,0.25)' }}>
        <Button disabled={!canAccept || busy} onClick={toggleAccept} className="w-full" style={{ backgroundColor: myAccepted ? '#27ae60' : '#2ecc71', color: '#fff' }}>
          {room.status === 'completing' ? 'Completing...' : myAccepted ? 'Accepted ✓ (undo)' : 'Accept'}
        </Button>
        <Button disabled={busy || room.status === 'completing'} onClick={decline} className="w-full" style={{ backgroundColor: '#e74c3c', color: '#fff' }}>Decline</Button>
      </div>
    </div>
  );
}