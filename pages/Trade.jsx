import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import TradeHub from '@/components/game/TradeHub';

export default function Trade() {
  const { profile } = useGame();
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [friendReqs, setFriendReqs] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('friends');

  useEffect(() => { if (profile) loadData(); }, [profile?.user_id]);

  const loadData = async () => {
    const [allPlayers, fReqs, myRooms] = await Promise.all([
      base44.entities.PlayerProfile.filter({}),
      base44.entities.FriendRequest.filter({}),
      base44.entities.TradeRoom.filter({})
    ]);
    setPlayers(allPlayers.filter(p => p.user_id !== profile.user_id));
    setFriendReqs(fReqs);
    setRooms(myRooms.filter(r => r.player_a_id === profile.user_id || r.player_b_id === profile.user_id));
  };

  const playerMap = {};
  players.forEach(p => { playerMap[p.user_id] = p; });

  const myFriends = friendReqs.filter(fr => fr.status === 'accepted' && (fr.from_user_id === profile.user_id || fr.to_user_id === profile.user_id));
  const incomingRequests = friendReqs.filter(fr => fr.to_user_id === profile.user_id && fr.status === 'pending');
  const sentRequests = friendReqs.filter(fr => fr.from_user_id === profile.user_id && fr.status === 'pending');
  const isFriendOrPending = (userId) => friendReqs.some(fr => ((fr.from_user_id === profile.user_id && fr.to_user_id === userId) || (fr.to_user_id === profile.user_id && fr.from_user_id === userId)) && fr.status !== 'rejected');

  const sendFriendRequest = async (toUserId) => {
    if (isFriendOrPending(toUserId)) return;
    await base44.entities.FriendRequest.create({ from_user_id: profile.user_id, to_user_id: toUserId, status: 'pending' });
    loadData();
  };
  const respondFriendRequest = async (reqId, status) => {
    await base44.entities.FriendRequest.update(reqId, { status });
    loadData();
  };

  const startLiveTrade = async (targetUserId) => {
    const target = playerMap[targetUserId];
    if (!target) return;
    const room = await base44.entities.TradeRoom.create({
      player_a_id: profile.user_id, player_a_username: profile.username, player_a_avatar: profile.avatar_url,
      player_b_id: targetUserId, player_b_username: target.username, player_b_avatar: target.avatar_url,
      status: 'pending', a_blooks: '[]', b_blooks: '[]', a_tokens: 0, b_tokens: 0, game: 'icecreamet'
    });
    await base44.entities.Notification.create({ user_id: targetUserId, type: 'trade_received', title: 'Trade Request', message: `${profile.username} wants to trade!`, link: `/trade/room/${room.id}` });
    navigate(`/trade/room/${room.id}`);
  };

  const acceptRoom = async (r) => {
    await base44.entities.TradeRoom.update(r.id, { status: 'active' });
    navigate(`/trade/room/${r.id}`);
  };
  const declineRoom = async (r) => {
    await base44.entities.TradeRoom.update(r.id, { status: 'declined' });
    loadData();
  };

  const filtered = players.filter(p => p.username?.toLowerCase().includes(search.toLowerCase()));
  const pendingIncoming = rooms.filter(r => r.player_b_id === profile.user_id && r.status === 'pending');
  const activeRooms = rooms.filter(r => (r.status === 'active' || r.status === 'completing'));

  return (
    <div>
      <h2 className="text-2xl font-display text-[#a7fcc9] mb-4">Friends & Trading</h2>
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { key: 'friends', label: 'Friends' },
          { key: 'requests', label: `Requests${incomingRequests.length > 0 ? ` (${incomingRequests.length})` : ''}` },
          { key: 'trades', label: `Live Trades${pendingIncoming.length > 0 ? ` (${pendingIncoming.length})` : ''}` },
          { key: 'find', label: 'Find Players' },
          { key: 'hub', label: 'Trade Hub' }
        ].map(t => (
          <Button key={t.key} size="sm" variant={tab === t.key ? 'default' : 'outline'} onClick={() => setTab(t.key)} style={tab === t.key ? { backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' } : {}} className={tab !== t.key ? 'border-white/20 text-white' : ''}>{t.label}</Button>
        ))}
      </div>

      {tab === 'hub' && <TradeHub />}

      {tab === 'find' && (
        <div>
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search players..." className="mb-3 max-w-sm bg-panel border-white/20 text-white placeholder:text-white/40" />
          <div className="space-y-2">
            {filtered.slice(0, 20).map(p => (
              <div key={p.id} className="bg-panel rounded-xl border border-white/10 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 avatar-rounded-square bg-white/10 overflow-hidden flex-shrink-0">
                    {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-white">{p.username?.[0]?.toUpperCase()}</div>}
                  </div>
                  <Link to={`/player/${p.user_id}`} className="text-sm font-display hover:underline text-white">{p.username}</Link>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => startLiveTrade(p.user_id)} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Trade</Button>
                  <Button size="sm" variant="outline" onClick={() => sendFriendRequest(p.user_id)} disabled={isFriendOrPending(p.user_id)} className="border-white/20 text-white">{isFriendOrPending(p.user_id) ? 'Sent' : 'Add'}</Button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-white/60 text-sm">No players found</p>}
          </div>
        </div>
      )}

      {tab === 'requests' && (
        <div className="space-y-4">
          <div>
            <h3 className="font-display text-sm text-[#a7fcc9] mb-2">Incoming ({incomingRequests.length})</h3>
            {incomingRequests.length === 0 ? <p className="text-white/60 text-sm">No pending requests</p> : incomingRequests.map(fr => {
              const sender = playerMap[fr.from_user_id];
              return (
                <div key={fr.id} className="bg-panel rounded-xl border border-white/10 p-3 flex items-center justify-between mb-2">
                  <Link to={`/player/${fr.from_user_id}`} className="text-sm font-display hover:underline text-white">{sender?.username || 'Unknown'}</Link>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => respondFriendRequest(fr.id, 'accepted')} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Accept</Button>
                    <Button size="sm" variant="outline" onClick={() => respondFriendRequest(fr.id, 'rejected')} className="border-white/20 text-white">Decline</Button>
                  </div>
                </div>
              );
            })}
          </div>
          {sentRequests.length > 0 && (
            <div>
              <h3 className="font-display text-sm text-[#a7fcc9] mb-2">Sent ({sentRequests.length})</h3>
              {sentRequests.map(fr => {
                const recipient = playerMap[fr.to_user_id];
                return (
                  <div key={fr.id} className="bg-panel rounded-xl border border-white/10 p-3 flex items-center justify-between mb-2">
                    <Link to={`/player/${fr.to_user_id}`} className="text-sm font-display hover:underline text-white">{recipient?.username || 'Unknown'}</Link>
                    <span className="text-xs text-white/60">Pending</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'friends' && (
        <div className="space-y-2">
          {myFriends.length === 0 ? <p className="text-white/60 text-sm">No friends yet — find players to add!</p> : myFriends.map(fr => {
            const friendId = fr.from_user_id === profile.user_id ? fr.to_user_id : fr.from_user_id;
            const friend = playerMap[friendId];
            return (
              <div key={fr.id} className="bg-panel rounded-xl border border-white/10 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 avatar-rounded-square bg-white/10 overflow-hidden flex-shrink-0">
                    {friend?.avatar_url ? <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-white">{friend?.username?.[0]?.toUpperCase()}</div>}
                  </div>
                  <Link to={`/player/${friendId}`} className="text-sm font-display hover:underline text-white">{friend?.username || 'Unknown'}</Link>
                </div>
                <Button size="sm" onClick={() => startLiveTrade(friendId)} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Trade</Button>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'trades' && (
        <div className="space-y-4">
          <div>
            <h3 className="font-display text-sm text-[#a7fcc9] mb-2">Incoming Trade Requests ({pendingIncoming.length})</h3>
            {pendingIncoming.length === 0 ? <p className="text-white/60 text-sm">No pending trade requests</p> : pendingIncoming.map(r => (
              <div key={r.id} className="bg-panel rounded-xl border border-white/10 p-3 flex items-center justify-between mb-2">
                <span className="text-sm font-display text-white">{r.player_a_username}</span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => acceptRoom(r)} style={{ backgroundColor: '#2ecc71', color: '#fff' }}>Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => declineRoom(r)} className="border-white/20 text-white">Decline</Button>
                </div>
              </div>
            ))}
          </div>
          {activeRooms.length > 0 && (
            <div>
              <h3 className="font-display text-sm text-[#a7fcc9] mb-2">Active Trades</h3>
              {activeRooms.map(r => (
                <div key={r.id} className="bg-panel rounded-xl border border-white/10 p-3 flex items-center justify-between mb-2">
                  <span className="text-sm font-display text-white">{r.player_a_id === profile.user_id ? r.player_b_username : r.player_a_username}</span>
                  <Button size="sm" onClick={() => navigate(`/trade/room/${r.id}`)} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Resume</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}