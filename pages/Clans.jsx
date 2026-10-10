import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { uploadFile } from '@/lib/uploadFile';
import { useGame } from '@/lib/gameContext';
import { getAllPlayers } from '@/lib/playersCache';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ClanChat from '@/components/game/ClanChat';
import ClanCard from '@/components/game/ClanCard';
import ColorPicker from '@/components/game/ColorPicker';
import { Bomb, Shield, Trash2, ArrowLeft, Package, EyeOff, Search, X } from 'lucide-react';
import { ROLE_HIERARCHY } from '@/lib/constants';

const CLAN_ICONS = ['🛡️', '⚔️', '🏰', '👑', '🔥', '❄️', '⭐', '💎', '🐉', '🦅'];
const CLAN_MEMBER_LIMIT = 22;

const isOnline = (players, userId) => {
  const p = players.find(pp => pp.user_id === userId);
  return !!(p?.last_seen && Date.now() - p.last_seen < 120000);
};

const clanTotalXp = (c) => {
  let sum = 0;
  for (let i = 1; i < (c.level || 1); i++) sum += i * 500;
  return (c.xp || 0) + sum;
};

const recomputeLevel = (totalXp) => {
  let level = 1, xp = Math.max(0, totalXp);
  while (xp >= level * 500) { xp -= level * 500; level++; }
  return { level, xp };
};

export default function Clans() {
  const { profile, updateProfile } = useGame();
  const [clans, setClans] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [myMembership, setMyMembership] = useState(null);
  const [invites, setInvites] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [requestedClanIds, setRequestedClanIds] = useState([]);
  const [players, setPlayers] = useState([]);
  const [selectedClanId, setSelectedClanId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [icon, setIcon] = useState('🛡️');
  const [clanImage, setClanImage] = useState('');
  const [clanColor, setClanColor] = useState('#a7fcc9');
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [inviteSearch, setInviteSearch] = useState('');
  const [bombTarget, setBombTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [bulkBombMode, setBulkBombMode] = useState(false);
  const [bulkBombTargets, setBulkBombTargets] = useState(new Set());
  const [bombCount, setBombCount] = useState(1);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editIcon, setEditIcon] = useState('🛡️');
  const [editImage, setEditImage] = useState('');
  const [editColor, setEditColor] = useState('#a7fcc9');
  const [savingEdit, setSavingEdit] = useState(false);
  const [depositAmt, setDepositAmt] = useState(0);
  const [shopBusy, setShopBusy] = useState(false);
  const [shopQty, setShopQty] = useState(1);
  const fileRef = useRef(null);
  const editFileRef = useRef(null);

  useEffect(() => { if (profile) loadData(); }, [profile?.user_id]);

  const loadData = async () => {
    const [allClans, myMemberships, allPending, myRequests, allPlayers, allMems] = await Promise.all([
      base44.entities.Clan.filter({}),
      base44.entities.ClanMember.filter({ user_id: profile.user_id }),
      base44.entities.ClanInvite.filter({ to_user_id: profile.user_id, status: 'pending' }),
      base44.entities.ClanInvite.filter({ from_user_id: profile.user_id, status: 'pending', type: 'request' }),
      getAllPlayers().catch(() => []),
      base44.entities.ClanMember.filter({})
    ]);
    setClans(allClans.sort((a, b) => clanTotalXp(b) - clanTotalXp(a)));
    setAllMembers(allMems);
    setMyMembership(myMemberships[0] || null);
    setInvites(allPending.filter(i => i.type !== 'request'));
    setJoinRequests(allPending.filter(i => i.type === 'request'));
    setRequestedClanIds(myRequests.map(r => r.clan_id));
    setPlayers(allPlayers);
  };

  const myClan = clans.find(c => c.id === myMembership?.clan_id);
  const selectedClan = clans.find(c => c.id === selectedClanId);
  const isLeader = myMembership?.role === 'leader';
  const isAdmin = profile && ROLE_HIERARCHY[profile.role] >= ROLE_HIERARCHY.admin;
  const isShielded = (clan) => clan?.shield_until && new Date(clan.shield_until) > new Date();
  const membersOf = (clanId) => allMembers.filter(m => m.clan_id === clanId);

  const deleteClan = async (clan) => {
    if (!confirm(`Delete clan "${clan.name}"? This removes all members and invites.`)) return;
    await base44.entities.ClanMember.deleteMany({ clan_id: clan.id });
    await base44.entities.ClanInvite.deleteMany({ clan_id: clan.id });
    await base44.entities.Clan.delete(clan.id);
    if (selectedClanId === clan.id) setSelectedClanId(null);
    loadData();
  };

  const handleImageUpload = async (e, setImg) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await uploadFile(file);
    setImg(file_url);
    setUploading(false);
  };

  const openEdit = () => {
    setEditName(myClan?.name || '');
    setEditDesc(myClan?.description || '');
    setEditIcon(myClan?.icon || '🛡️');
    setEditImage(myClan?.image_url || '');
    setEditColor(myClan?.color || '#a7fcc9');
    setShowEdit(true);
  };

  const saveEdit = async () => {
    if (!editName.trim() || !myClan) return;
    setSavingEdit(true);
    await base44.entities.Clan.update(myClan.id, { name: editName.trim(), description: editDesc.trim(), icon: editIcon, image_url: editImage, color: editColor });
    if (editName.trim() !== myClan.name) {
      await base44.entities.ClanMember.updateMany({ clan_id: myClan.id }, { $set: { clan_name: editName.trim() } });
    }
    setSavingEdit(false);
    setShowEdit(false);
    if (editFileRef.current) editFileRef.current.value = '';
    loadData();
  };

  const createClan = async () => {
    if (!name.trim()) return;
    const clan = await base44.entities.Clan.create({ name: name.trim(), description: desc.trim(), leader_id: profile.user_id, leader_username: profile.username, icon, image_url: clanImage, color: clanColor });
    await base44.entities.ClanMember.create({ clan_id: clan.id, clan_name: clan.name, user_id: profile.user_id, username: profile.username, avatar_url: profile.avatar_url || '', role: 'leader' });
    setName(''); setDesc(''); setIcon('🛡️'); setClanImage(''); setClanColor('#a7fcc9');
    if (fileRef.current) fileRef.current.value = '';
    setShowCreate(false);
    loadData();
  };

  const invitePlayer = async (player) => {
    const clanMembers = membersOf(myMembership.clan_id);
    if (clanMembers.length >= CLAN_MEMBER_LIMIT) { alert(`Clan is full (${CLAN_MEMBER_LIMIT} members max)`); return; }
    await base44.entities.ClanInvite.create({ clan_id: myMembership.clan_id, clan_name: myMembership.clan_name, from_user_id: profile.user_id, from_username: profile.username, to_user_id: player.user_id, type: 'invite', status: 'pending' });
    await base44.entities.Notification.create({ user_id: player.user_id, type: 'custom', title: 'Clan Invite!', message: `${profile.username} invited you to join ${myMembership.clan_name}!`, link: '/clans' });
    setShowInvite(false);
  };

  const requestJoin = async (clan) => {
    const clanMembers = membersOf(clan.id);
    if (clanMembers.length >= CLAN_MEMBER_LIMIT) { alert(`Clan is full (${CLAN_MEMBER_LIMIT} members max)`); return; }
    await base44.entities.ClanInvite.create({ clan_id: clan.id, clan_name: clan.name, from_user_id: profile.user_id, from_username: profile.username, to_user_id: clan.leader_id, type: 'request', status: 'pending' });
    await base44.entities.Notification.create({ user_id: clan.leader_id, type: 'custom', title: 'Clan Join Request', message: `${profile.username} requested to join ${clan.name}!`, link: '/clans' });
    loadData();
  };

  const respondInvite = async (invite, status) => {
    if (status === 'accepted') {
      const clanMembers = membersOf(invite.clan_id);
      if (clanMembers.length >= CLAN_MEMBER_LIMIT) { alert(`Clan is full (${CLAN_MEMBER_LIMIT} members max)`); return; }
      await base44.entities.ClanMember.create({ clan_id: invite.clan_id, clan_name: invite.clan_name, user_id: profile.user_id, username: profile.username, avatar_url: profile.avatar_url || '', role: 'member' });
    }
    await base44.entities.ClanInvite.update(invite.id, { status });
    loadData();
  };

  const respondJoinRequest = async (req, status) => {
    if (status === 'accepted') {
      const clanMembers = membersOf(req.clan_id);
      if (clanMembers.length >= CLAN_MEMBER_LIMIT) { alert(`Clan is full (${CLAN_MEMBER_LIMIT} members max)`); return; }
      await base44.entities.ClanMember.create({ clan_id: req.clan_id, clan_name: req.clan_name, user_id: req.from_user_id, username: req.from_username, avatar_url: '', role: 'member' });
      await base44.entities.Notification.create({ user_id: req.from_user_id, type: 'custom', title: 'Clan Request Accepted!', message: `${profile.username} accepted your request to join ${req.clan_name}!`, link: '/clans' });
    } else {
      await base44.entities.Notification.create({ user_id: req.from_user_id, type: 'custom', title: 'Clan Request Rejected', message: `${profile.username} declined your request to join ${req.clan_name}.`, link: '/clans' });
    }
    await base44.entities.ClanInvite.update(req.id, { status });
    loadData();
  };

  const leaveClan = async () => {
    if (!myMembership) return;
    if (myMembership.role === 'leader') {
      await base44.entities.ClanMember.deleteMany({ clan_id: myMembership.clan_id });
      await base44.entities.ClanInvite.deleteMany({ clan_id: myMembership.clan_id });
      await base44.entities.Clan.delete(myMembership.clan_id);
      setSelectedClanId(null);
    } else {
      await base44.entities.ClanMember.delete(myMembership.id);
    }
    loadData();
  };

  const kickMember = async (memberId) => {
    await base44.entities.ClanMember.delete(memberId);
    loadData();
  };

  const activateShield = async () => {
    if (!myClan || (profile.shields || 0) <= 0) return;
    setBusy(true);
    await updateProfile({ shields: (profile.shields || 0) - 1 });
    await base44.entities.Clan.update(myClan.id, { shield_until: new Date(Date.now() + 86400000).toISOString() });
    setBusy(false);
    loadData();
  };

  const bombClan = async (clan, count = 1) => {
    if (!clan || (profile.grenades || 0) <= 0) return;
    const n = Math.min(count, profile.grenades || 0);
    if (n <= 0) return;
    setBusy(true);
    // Single fetch, simulate all bombs locally, single update — avoids 2N sequential API calls.
    const fresh = await base44.entities.Clan.get(clan.id);
    let level = fresh.level || 1;
    let xp = fresh.xp || 0;
    let total = clanTotalXp(fresh);
    let hasShield = fresh.shield_until && new Date(fresh.shield_until) > new Date();
    let shieldBroken = false;
    let totalXpLoss = 0;
    for (let i = 0; i < n; i++) {
      if (hasShield) {
        hasShield = false;
        shieldBroken = true;
      } else {
        const damage = Math.floor(xp * 0.5) + 100;
        const actual = Math.min(damage, total);
        total -= actual;
        totalXpLoss += actual;
        const r = recomputeLevel(total);
        level = r.level;
        xp = r.xp;
      }
    }
    const updateData = { level, xp };
    if (shieldBroken) updateData.shield_until = null;
    await base44.entities.Clan.update(fresh.id, updateData);
    await updateProfile({ grenades: (profile.grenades || 0) - n });
    const msg = n === 1
      ? (shieldBroken && totalXpLoss === 0
          ? `🛡️💥 ${profile.username} bombed ${clan.name}! Their shield broke — no XP lost!`
          : `💣 ${profile.username} bombed ${clan.name}! They lost ${totalXpLoss} XP!`)
      : `💣 ${profile.username} dropped ${n} bombs on ${clan.name}!${shieldBroken ? ' 🛡️ Shield broken!' : ''}${totalXpLoss > 0 ? ` ${totalXpLoss.toLocaleString()} XP lost!` : ''}`;
    base44.entities.ChatMessage.create({ content: msg, username: 'ICECREAMET Bot', is_system: true, user_role: 'admin' }).catch(() => {});
    setBusy(false); setBombTarget(null); setBombCount(1); loadData();
  };

  const bulkBomb = async () => {
    const targets = clans.filter(c => bulkBombTargets.has(c.id) && c.id !== myMembership?.clan_id);
    if (targets.length === 0) return;
    const grenades = profile.grenades || 0;
    const maxBombs = Math.min(targets.length, grenades);
    if (maxBombs === 0) { alert('No grenades!'); return; }
    setBusy(true);
    const toBomb = targets.slice(0, maxBombs);
    // Fetch all target clans in parallel, compute damage locally, update all in parallel.
    const freshClans = await Promise.all(toBomb.map(c => base44.entities.Clan.get(c.id)));
    await Promise.all(freshClans.map(fresh => {
      if (fresh.shield_until && new Date(fresh.shield_until) > new Date()) {
        return base44.entities.Clan.update(fresh.id, { shield_until: null });
      } else {
        const total = clanTotalXp(fresh);
        const damage = Math.floor((fresh.xp || 0) * 0.5) + 100;
        const actual = Math.min(damage, total);
        const { level, xp } = recomputeLevel(total - actual);
        return base44.entities.Clan.update(fresh.id, { level, xp });
      }
    }));
    await updateProfile({ grenades: grenades - maxBombs });
    base44.entities.ChatMessage.create({ content: `💣 ${profile.username} went on a bombing spree, hitting ${maxBombs} clan${maxBombs === 1 ? '' : 's'}!`, username: 'ICECREAMET Bot', is_system: true, user_role: 'admin' }).catch(() => {});
    setBusy(false);
    setBulkBombTargets(new Set());
    setBulkBombMode(false);
    loadData();
  };

  const absorbClan = async (clan) => {
    if (!clan || !myClan || clan.id === myClan.id) return;
    if ((profile.tokens || 0) < 3000000) { alert('You need 3,000,000 tokens to absorb!'); return; }
    setBusy(true);
    const fresh = await base44.entities.Clan.get(clan.id);
    const total = clanTotalXp(fresh);
    const absorbed = Math.floor(total * 0.10);
    if (absorbed <= 0) { alert('That clan has no XP to absorb!'); setBusy(false); return; }
    const { level: tLevel, xp: tXp } = recomputeLevel(total - absorbed);
    await base44.entities.Clan.update(fresh.id, { level: tLevel, xp: tXp });
    const myFresh = await base44.entities.Clan.get(myClan.id);
    const { level: mLevel, xp: mXp } = recomputeLevel(clanTotalXp(myFresh) + absorbed);
    await base44.entities.Clan.update(myClan.id, { level: mLevel, xp: mXp });
    await updateProfile({ tokens: (profile.tokens || 0) - 3000000 });
    await base44.entities.ChatMessage.create({ content: `🧲 ${profile.username} absorbed 10% of ${clan.name}'s XP (${absorbed.toLocaleString()} XP) into ${myClan.name}!`, username: 'ICECREAMET Bot', is_system: true, user_role: 'admin' });
    setBusy(false); loadData();
  };

  const depositTokens = async () => {
    if (!myClan || depositAmt <= 0 || (profile.tokens || 0) < depositAmt) return;
    setShopBusy(true);
    await updateProfile({ tokens: (profile.tokens || 0) - depositAmt });
    await base44.entities.Clan.update(myClan.id, { tokens: (myClan.tokens || 0) + depositAmt });
    setDepositAmt(0); setShopBusy(false); loadData();
  };

  const buyShopItem = async (item, qty = 1) => {
    if (!myClan) return;
    const costs = { grenade: 5000, shield: 8000, paint: 3000 };
    const cost = costs[item] * qty;
    if ((myClan.tokens || 0) < cost) return;
    setShopBusy(true);
    if (item === 'grenade') {
      await base44.entities.Clan.update(myClan.id, { tokens: (myClan.tokens || 0) - cost });
      await updateProfile({ grenades: (profile.grenades || 0) + qty });
    } else if (item === 'shield') {
      await base44.entities.Clan.update(myClan.id, { tokens: (myClan.tokens || 0) - cost });
      await updateProfile({ shields: (profile.shields || 0) + qty });
    } else if (item === 'paint') {
      await base44.entities.Clan.update(myClan.id, { tokens: (myClan.tokens || 0) - cost, paint_buckets: (myClan.paint_buckets || 0) + qty });
    }
    setShopBusy(false); loadData();
  };

  const usePaintBucket = async () => {
    if (!myClan || (myClan.paint_buckets || 0) <= 0) return;
    setShopBusy(true);
    await base44.entities.Clan.update(myClan.id, { color: editColor, paint_buckets: (myClan.paint_buckets || 0) - 1 });
    setShopBusy(false); loadData();
  };

  const filteredPlayers = players.filter(p =>
    p.user_id !== profile.user_id &&
    p.username?.toLowerCase().includes(inviteSearch.toLowerCase()) &&
    !membersOf(myMembership?.clan_id).some(m => m.user_id === p.user_id)
  );

  const filteredClans = clans.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  // ===== DETAIL VIEW =====
  if (selectedClan) {
    const clan = selectedClan;
    const clanMembers = membersOf(clan.id);
    const isMine = myMembership?.clan_id === clan.id;
    const rainbow = (clan.color || '').toLowerCase() === 'rainbow';
    const onlineCount = clanMembers.filter(m => isOnline(players, m.user_id)).length;
    const owner = clanMembers.find(m => m.role === 'leader') || { username: clan.leader_username, user_id: clan.leader_id };

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setSelectedClanId(null)} className="flex items-center gap-2 text-white/70 hover:text-white text-sm">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex items-center gap-3">
            {(profile.grenades || 0) > 0 && <span className="text-sm text-white">💣 {profile.grenades}</span>}
            {(profile.shields || 0) > 0 && <span className="text-sm text-white">🛡️ {profile.shields}</span>}
            {isAdmin && <Button size="sm" variant="outline" className="border-red-500/40 text-red-400 hover:bg-red-500/20" onClick={() => deleteClan(clan)} title={`Delete ${clan.name}`}><Trash2 size={14} /></Button>}
          </div>
        </div>

        <h1 className={`text-center font-display text-3xl mb-4 ${rainbow ? 'rainbow-name' : ''}`} style={rainbow ? {} : { color: clan.color || '#a7fcc9' }}>{clan.name}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column */}
          <div className="space-y-4">
            {isMine && (
              <>
                {/* Shield status */}
                <div className="bg-panel rounded-xl border border-white/10 p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isShielded(clan) ? 'bg-blue-500/20' : 'bg-white/5'}`}>
                    <Shield size={20} className={isShielded(clan) ? 'text-blue-400' : 'text-white/40'} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-display text-white">{isShielded(clan) ? 'Shielded' : 'Not Shielded'}</p>
                    <p className="text-[10px] text-white/50">{isShielded(clan) ? 'Protected from bombs' : 'Vulnerable to attacks'}</p>
                  </div>
                  {isLeader && (profile.shields || 0) > 0 && !isShielded(clan) && (
                    <Button size="sm" onClick={activateShield} disabled={busy} className="bg-blue-600 text-white hover:bg-blue-700">Shield</Button>
                  )}
                </div>
                {/* Disguise status (cosmetic) */}
                <div className="bg-panel rounded-xl border border-white/10 p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                    <EyeOff size={20} className="text-white/40" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-display text-white">Not Disguised</p>
                    <p className="text-[10px] text-white/50">Your clan is visible to all</p>
                  </div>
                </div>
                {/* Inventory / Treasury */}
                <div className="bg-panel rounded-xl border border-white/10 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Package size={18} className="text-[#a7fcc9]" />
                    <p className="text-sm font-display text-white">Clan Inventory</p>
                  </div>
                  <p className="text-xs text-white/60 mb-2">🪙 {myClan?.tokens || 0} · 🎨 {myClan?.paint_buckets || 0} paint</p>
                  {isLeader && (
                    <>
                      <div className="flex gap-2 mb-2">
                        <Input type="number" value={depositAmt || ''} onChange={e => setDepositAmt(Math.max(0, parseInt(e.target.value) || 0))} placeholder="Deposit" className="h-8 text-xs flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40" />
                        <Button size="sm" onClick={depositTokens} disabled={shopBusy || depositAmt <= 0} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Deposit</Button>
                      </div>
                      <div className="flex items-center gap-1 mb-2 flex-wrap">
                        <span className="text-[10px] text-white/50">Qty:</span>
                        {[1, 10, 100].map(q => (
                          <button key={q} onClick={() => setShopQty(q)} className={`text-[10px] px-1.5 py-0.5 rounded ${shopQty === q ? 'bg-[#a7fcc9] text-panel font-bold' : 'bg-white/10 text-white'}`}>×{q}</button>
                        ))}
                        <Input type="number" min="1" value={shopQty} onChange={e => setShopQty(Math.max(1, parseInt(e.target.value) || 1))} className="h-7 w-16 text-[10px] bg-white/10 border-white/20 text-white" />
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => buyShopItem('grenade', shopQty)} disabled={shopBusy || (myClan?.tokens || 0) < 5000 * shopQty} className="border-white/20 text-white text-[10px] px-1">💣 {(5000 * shopQty).toLocaleString()}</Button>
                        <Button size="sm" variant="outline" onClick={() => buyShopItem('shield', shopQty)} disabled={shopBusy || (myClan?.tokens || 0) < 8000 * shopQty} className="border-white/20 text-white text-[10px] px-1">🛡️ {(8000 * shopQty).toLocaleString()}</Button>
                        <Button size="sm" variant="outline" onClick={() => buyShopItem('paint', shopQty)} disabled={shopBusy || (myClan?.tokens || 0) < 3000 * shopQty} className="border-white/20 text-white text-[10px] px-1">🎨 {(3000 * shopQty).toLocaleString()}</Button>
                      </div>
                      {(myClan?.paint_buckets || 0) > 0 && (
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <ColorPicker value={editColor} onChange={setEditColor} />
                          <Button size="sm" onClick={usePaintBucket} disabled={shopBusy} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Paint</Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}

            {/* Clan info card */}
            <div className="bg-panel rounded-xl border border-white/10 overflow-hidden">
              <div className="h-28 bg-gradient-to-br from-black/40 to-panel flex items-center justify-center">
                {clan.image_url ? (
                  <img src={clan.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl opacity-80">{clan.icon || '🛡️'}</span>
                )}
              </div>
              <div className="p-4">
                <p className="text-sm text-white/80 mb-2 min-h-[40px]">{clan.description || 'No description'}</p>
                <div className="flex items-center justify-between text-xs text-white/60 mb-1">
                  <span>Level {clan.level || 1}</span>
                  <span>EXP {clanTotalXp(clan).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-white/50 mb-3">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />{onlineCount} Online</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-500" />{clanMembers.length - onlineCount} Offline</span>
                </div>

                {/* Action button */}
                {!isMine ? (
                  myMembership ? (
                    <div className="space-y-2">
                      <Button className="w-full bg-red-600 text-white hover:bg-red-700" onClick={() => setBombTarget(clan)} disabled={busy || (profile.grenades || 0) <= 0}>
                        <Bomb size={16} className="mr-2" /> {(profile.grenades || 0) <= 0 ? 'No Grenades' : 'Attack'}
                      </Button>
                      <Button className="w-full bg-purple-700 text-white hover:bg-purple-800 border border-purple-400/40" onClick={() => absorbClan(clan)} disabled={busy || (profile.tokens || 0) < 3000000}>
                        🧲 Absorb 10% XP (3M tokens)
                      </Button>
                    </div>
                  ) : (
                    <Button className="w-full" onClick={() => requestJoin(clan)} disabled={requestedClanIds.includes(clan.id)} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
                      {requestedClanIds.includes(clan.id) ? 'Requested' : 'Request to Join'}
                    </Button>
                  )
                ) : (
                  <div className="flex gap-2">
                    {isLeader && <Button size="sm" className="flex-1" onClick={() => setShowInvite(true)} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Invite</Button>}
                    {isLeader && <Button size="sm" variant="outline" className="flex-1 border-white/20 text-white" onClick={openEdit}>Edit</Button>}
                    <Button size="sm" variant="outline" className="border-white/20 text-white" onClick={leaveClan}>{isLeader ? 'Disband' : 'Leave'}</Button>
                  </div>
                )}
              </div>
            </div>

            {/* Owner box */}
            <div className="bg-panel rounded-xl border border-white/10 p-3 flex items-center gap-3">
              <div className="w-10 h-10 avatar-rounded-square bg-white/10 overflow-hidden">
                {owner.avatar_url ? <img src={owner.avatar_url} className="w-full h-full object-cover" alt="" /> :
                  <div className="w-full h-full flex items-center justify-center text-sm text-white">{owner.username?.[0]?.toUpperCase()}</div>}
              </div>
              <div>
                <Link to={`/player/${owner.user_id}`} className="text-sm font-display text-white hover:text-[#a7fcc9]">{owner.username}</Link>
                <p className="text-[10px] text-white/50">Clan Owner</p>
              </div>
            </div>

            {isMine && isLeader && joinRequests.length > 0 && (
              <div className="bg-panel rounded-xl border border-white/10 p-3">
                <h4 className="font-display text-sm text-[#a7fcc9] mb-2">Join Requests</h4>
                <div className="space-y-1">
                  {joinRequests.map(req => (
                    <div key={req.id} className="flex items-center justify-between py-1">
                      <Link to={`/player/${req.from_user_id}`} className="text-sm text-white hover:text-[#a7fcc9]">{req.from_username}</Link>
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => respondJoinRequest(req, 'accepted')} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Accept</Button>
                        <Button size="sm" variant="outline" onClick={() => respondJoinRequest(req, 'rejected')} className="border-white/20 text-white">Reject</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Center column: chat (only for your clan) */}
          {isMine && (
            <div className="bg-panel rounded-2xl border border-white/10 p-4 flex flex-col min-h-[400px] lg:h-auto">
              <h3 className="font-display text-sm text-[#a7fcc9] mb-3">Clan Chat</h3>
              <ClanChat clanId={clan.id} profile={profile} />
            </div>
          )}

          {/* Right column: members */}
          <div>
            <h3 className="font-display text-sm text-white mb-3">Clan Members</h3>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {clanMembers.map(m => {
                const online = isOnline(players, m.user_id);
                return (
                  <div key={m.id} className="bg-panel rounded-xl border border-white/10 p-3 flex items-center gap-3">
                    <div className="relative">
                      <div className="w-9 h-9 avatar-rounded-square bg-white/10 overflow-hidden">
                        {m.avatar_url ? <img src={m.avatar_url} className="w-full h-full object-cover" alt="" /> :
                          <div className="w-full h-full flex items-center justify-center text-xs text-white">{m.username?.[0]?.toUpperCase()}</div>}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-panel ${online ? 'bg-green-400' : 'bg-gray-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link to={`/player/${m.user_id}`} className="text-sm font-display text-white hover:text-[#a7fcc9] truncate block">{m.username}</Link>
                      <p className="text-[10px] text-white/50">{m.role === 'leader' ? 'Clan Owner' : 'Clan Member'}</p>
                    </div>
                    {isMine && isLeader && m.role !== 'leader' && (
                      <button onClick={() => kickMember(m.id)} className="text-xs text-red-400 hover:underline">Kick</button>
                    )}
                  </div>
                );
              })}
              {clanMembers.length === 0 && <p className="text-white/40 text-sm text-center py-4">No members</p>}
            </div>
          </div>
        </div>

        <Dialog open={!!bombTarget} onOpenChange={(open) => { if (!open) { setBombTarget(null); setBombCount(1); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Bomb {bombTarget?.name}?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Each bomb reduces their clan XP by 50% + 100. You have {profile.grenades || 0} grenade(s).</p>
            {bombTarget && isShielded(bombTarget) && <p className="text-sm text-blue-500 mt-2">🛡️ This clan is shielded! Your first bomb breaks the shield (no XP damage), the rest deal damage.</p>}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-sm text-muted-foreground">Bombs (max 1000):</span>
              <Input type="number" min="1" max={Math.min(1000, profile.grenades || 1)} value={bombCount} onChange={e => setBombCount(Math.max(1, Math.min(parseInt(e.target.value) || 1, Math.min(1000, profile.grenades || 1))))} className="w-24" />
              <div className="flex gap-1 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => setBombCount(1)} className="border-white/20 text-white">1</Button>
                <Button size="sm" variant="outline" onClick={() => setBombCount(Math.min(10, profile.grenades || 1))} className="border-white/20 text-white">10</Button>
                <Button size="sm" variant="outline" onClick={() => setBombCount(Math.min(100, profile.grenades || 1))} className="border-white/20 text-white">100</Button>
                <Button size="sm" variant="outline" onClick={() => setBombCount(Math.min(1000, profile.grenades || 1))} className="border-white/20 text-white">1000</Button>
                <Button size="sm" variant="outline" onClick={() => setBombCount(Math.min(1000, profile.grenades || 1))} className="border-white/20 text-white">Max</Button>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button onClick={() => bombClan(bombTarget, bombCount)} disabled={busy || (profile.grenades || 0) <= 0} className="bg-red-600 text-white hover:bg-red-700 flex-1">{busy ? 'Bombing...' : `💣 Drop ${bombCount} Bomb${bombCount === 1 ? '' : 's'}`}</Button>
              <Button variant="outline" onClick={() => { setBombTarget(null); setBombCount(1); }}>Cancel</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showInvite} onOpenChange={setShowInvite}>
          <DialogContent>
            <DialogHeader><DialogTitle>Invite to {myMembership?.clan_name}</DialogTitle></DialogHeader>
            <Input value={inviteSearch} onChange={e => setInviteSearch(e.target.value)} placeholder="Search players..." className="mb-2" />
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredPlayers.slice(0, 20).map(p => (
                <div key={p.id} className="flex items-center justify-between py-1.5">
                  <Link to={`/player/${p.user_id}`} className="text-sm hover:underline">{p.username}</Link>
                  <Button size="sm" onClick={() => invitePlayer(p)} style={{ backgroundColor: 'rgb(var(--user-sidebar))' }}>Invite</Button>
                </div>
              ))}
              {filteredPlayers.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">No players found</p>}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showEdit} onOpenChange={(open) => { if (!open) { setShowEdit(false); if (editFileRef.current) editFileRef.current.value = ''; } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Clan</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Clan Image</label>
                <div className="flex items-center gap-2 mt-1">
                  {editImage && <img src={editImage} className="w-10 h-10 object-cover rounded-lg" alt="" />}
                  <input ref={editFileRef} type="file" accept="image/*" onChange={(e) => handleImageUpload(e, setEditImage)} className="text-xs" disabled={uploading} />
                </div>
                {uploading && <p className="text-xs text-muted-foreground mt-1">Uploading...</p>}
                <Input value={editImage} onChange={e => setEditImage(e.target.value)} placeholder="...or paste an image URL" className="mt-2" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Icon</label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {CLAN_ICONS.map(em => (
                    <button key={em} onClick={() => setEditIcon(em)} className={`text-2xl p-2 rounded ${editIcon === em ? 'bg-[#a7fcc9] ring-1 ring-panel' : 'hover:bg-muted'}`}>{em}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Clan Color</label>
                <div className="mt-1"><ColorPicker value={editColor} onChange={setEditColor} /></div>
              </div>
              <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Clan name..." />
              <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description..." rows={2} />
              <Button onClick={saveEdit} disabled={!editName.trim() || savingEdit || uploading} style={{ backgroundColor: 'rgb(var(--user-sidebar))' }} className="w-full">{savingEdit ? 'Saving...' : 'Save Changes'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ===== DISCOVER VIEW =====
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-display text-[#a7fcc9]">Discover Clans</h2>
        <div className="flex items-center gap-3">
          {(profile.grenades || 0) > 0 && <span className="text-sm text-white">💣 {profile.grenades}</span>}
          {(profile.shields || 0) > 0 && <span className="text-sm text-white">🛡️ {profile.shields}</span>}
          {myClan && <Button size="sm" onClick={() => setSelectedClanId(myClan.id)} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>My Clan</Button>}
          {myMembership && <Button size="sm" variant="outline" disabled={(profile.grenades || 0) <= 0} onClick={() => { setBulkBombMode(m => !m); setBulkBombTargets(new Set()); }} className={`border-white/20 ${bulkBombMode ? 'bg-red-600 text-white border-red-600' : 'text-white'}`}>Bulk Bomb</Button>}
          {!myMembership && <Button size="sm" onClick={() => setShowCreate(true)} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Create Clan</Button>}
        </div>
      </div>

      {/* Pending invites */}
      {!myMembership && invites.length > 0 && (
        <div className="mb-4">
          <h3 className="font-display text-sm text-[#a7fcc9] mb-2">Pending Invites</h3>
          <div className="space-y-2">
            {invites.map(inv => (
              <div key={inv.id} className="bg-panel rounded-xl border border-white/10 p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-display text-[#a7fcc9]">{inv.clan_name}</p>
                  <p className="text-xs text-white/60">Invited by {inv.from_username}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => respondInvite(inv, 'accepted')} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => respondInvite(inv, 'rejected')} className="border-white/20 text-white">Decline</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="bg-panel rounded-xl border border-white/10 p-2 mb-4 flex items-center gap-2">
        <Search size={16} className="text-white/40 ml-2" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clans..." className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 outline-none" />
        {search && <button onClick={() => setSearch('')} className="text-white/40 hover:text-white p-1"><X size={14} /></button>}
      </div>

      {/* Clan grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredClans.map(clan => {
          const isMine = clan.id === myMembership?.clan_id;
          const selected = bulkBombTargets.has(clan.id);
          return (
            <div key={clan.id} className="relative">
              <ClanCard clan={clan} members={membersOf(clan.id)} players={players} isShielded={isShielded(clan)} onClick={() => {
                if (bulkBombMode) {
                  if (isMine) return;
                  setBulkBombTargets(prev => { const n = new Set(prev); if (n.has(clan.id)) n.delete(clan.id); else n.add(clan.id); return n; });
                } else {
                  setSelectedClanId(clan.id);
                }
              }} />
              {bulkBombMode && !isMine && (
                <div className={`absolute top-2 right-2 w-7 h-7 rounded-full border-2 flex items-center justify-center z-10 pointer-events-none ${selected ? 'bg-red-500 border-red-500' : 'bg-black/60 border-white/40'}`}>
                  {selected && <span className="text-white text-xs font-bold">✓</span>}
                </div>
              )}
              {bulkBombMode && isMine && (
                <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center z-10 pointer-events-none">
                  <span className="text-white/70 text-xs font-display">Your Clan</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {filteredClans.length === 0 && <p className="text-white/60 text-sm text-center py-8">No clans found. {clans.length === 0 && 'Create the first one!'}</p>}

      {bulkBombMode && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-panel border border-white/20 rounded-full px-4 py-2 flex items-center gap-3 shadow-lg z-50">
          <span className="text-sm text-white">{bulkBombTargets.size} selected · 💣 {profile.grenades || 0}</span>
          <Button size="sm" onClick={bulkBomb} disabled={busy || bulkBombTargets.size === 0} className="bg-red-600 text-white hover:bg-red-700">Bomb Selected</Button>
          <Button size="sm" variant="outline" onClick={() => { setBulkBombMode(false); setBulkBombTargets(new Set()); }} className="border-white/20 text-white">Cancel</Button>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) { setShowCreate(false); setClanImage(''); if (fileRef.current) fileRef.current.value = ''; } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create a Clan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Clan Image (optional)</label>
              <div className="flex items-center gap-2 mt-1">
                {clanImage && <img src={clanImage} className="w-10 h-10 object-cover rounded-lg" alt="" />}
                <input ref={fileRef} type="file" accept="image/*" onChange={(e) => handleImageUpload(e, setClanImage)} className="text-xs" disabled={uploading} />
              </div>
              {uploading && <p className="text-xs text-muted-foreground mt-1">Uploading...</p>}
              <Input value={clanImage} onChange={e => setClanImage(e.target.value)} placeholder="...or paste an image URL" className="mt-2" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Or pick an icon</label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {CLAN_ICONS.map(em => (
                  <button key={em} onClick={() => setIcon(em)} className={`text-2xl p-2 rounded ${icon === em ? 'bg-[#a7fcc9] ring-1 ring-panel' : 'hover:bg-muted'}`}>{em}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Clan Color</label>
              <div className="mt-1"><ColorPicker value={clanColor} onChange={setClanColor} /></div>
            </div>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Clan name..." />
            <Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description..." rows={2} />
            <Button onClick={createClan} disabled={!name.trim() || uploading} style={{ backgroundColor: 'rgb(var(--user-sidebar))' }} className="w-full">Create Clan</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}