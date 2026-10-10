import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { ROLE_HIERARCHY, RARITY_ORDER, SELL_PRICES, MEGA_CHARIZARD_BLOOK_ID, MEGA_DARKRAI_BLOOK_ID, PLACEHOLDER_BLOOK_IMG } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Users, Package, Grid3X3, Newspaper, Shield, Image, Palette, Calendar, Coins, ShieldAlert, PanelLeft, KeyRound, Flag, History, Lock, Ban, Mail, Sandwich, Bot, Link2 } from 'lucide-react';
import ImageUpload from '@/components/game/ImageUpload';
import GradientColorPicker from '@/components/game/GradientColorPicker';
import BanRequestsAdmin from '@/components/game/BanRequestsAdmin';
import BanAppealsAdmin from '@/components/game/BanAppealsAdmin';
import ReportsAdmin from '@/components/game/ReportsAdmin';
import RulesManager from '@/components/game/RulesManager';
import AdminCodes from '@/components/game/AdminCodes';
import UpdatesAdmin from '@/components/game/UpdatesAdmin';
import InvitesAdmin from '@/components/game/InvitesAdmin';
import BotAdmin from '@/components/game/BotAdmin';
import { SIDEBAR_PAGES, getHiddenPages, setHiddenPages } from '@/lib/sidebarPages';
import { adminUpdateProfile } from '@/lib/adminAction';
import { SPOOKY_PACK_ID } from '@/lib/spookyEvent';
import AbuseAdmin from '@/components/game/AbuseAdmin';
import AltLinksAdmin from '@/components/game/AltLinksAdmin';

const isProtectedUser = (player) => (player?.username || '').toLowerCase() === 'icecreamy';
// Spooky Month prizes and the two displayed PAC3 event blooks are owner-only deletes.
const isProtectedEventBlook = (blook) => !!blook && (blook.pack_id === SPOOKY_PACK_ID || blook.game === 'pokemon');
const canModerate = (viewer, target) => {
  if (!target || isProtectedUser(target)) return false;
  const v = ROLE_HIERARCHY[viewer?.role] || 0;
  if (v >= ROLE_HIERARCHY.owner) return true;
  return (ROLE_HIERARCHY[target.role] || 0) < v;
};
const canSelfMute = (viewer, target) => viewer?.user_id && viewer?.user_id === target?.user_id && ROLE_HIERARCHY[viewer?.role] >= ROLE_HIERARCHY['co-owner'];
const allowedRolesFor = (viewer) => {
  const v = ROLE_HIERARCHY[viewer?.role] || 0;
  if (v >= ROLE_HIERARCHY.owner) return ['player', 'helper', 'moderator', 'admin', 'co-owner', 'executive-manager', 'owner', 'biggie'];
  if (v >= ROLE_HIERARCHY['executive-manager']) return ['player', 'helper', 'moderator', 'admin', 'co-owner', 'biggie'];
  if (v >= ROLE_HIERARCHY['co-owner']) return ['player', 'helper', 'moderator', 'admin', 'biggie'];
  if (v >= ROLE_HIERARCHY.admin) return ['player', 'helper', 'moderator', 'biggie'];
  return [];
};

export default function AdminPanel() {
  const { profile } = useGame();
  const isAdmin = profile && ROLE_HIERARCHY[profile.role] >= ROLE_HIERARCHY.admin;
  const isOwner = profile && ROLE_HIERARCHY[profile.role] >= ROLE_HIERARCHY['co-owner'];
  const _biggieUser = profile?.username?.toLowerCase() || '';
  const canManageBiggie = _biggieUser === 'icecreamy' || _biggieUser === 'minti';
  const isStrictOwner = profile?.role === 'owner';
  // Minion is a specific co-owner trusted to create weekly codes.
  const isMinion = profile?.user_id === '6a99b529fd54567710eb02d5';
  const canManageCodes = isStrictOwner || isMinion;
  const [pendingBans, setPendingBans] = useState(0);
  useEffect(() => {
    if (!isStrictOwner) return;
    const loadCount = () => base44.entities.BanRequest.filter({ status: 'pending' }).then(rs => setPendingBans(rs.length)).catch(() => {});
    loadCount();
    const unsub = base44.entities.BanRequest.subscribe((e) => { if (e.type === 'create' || e.type === 'update' || e.type === 'delete') loadCount(); });
    return unsub;
  }, [isStrictOwner]);

  if (!isAdmin && !canManageBiggie) {
    return <div className="text-center py-12"><p className="text-muted-foreground">Access denied</p></div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-display text-[#a7fcc9] mb-4">⚡ Admin Panel</h2>
      <Tabs defaultValue={isAdmin ? "packs" : "biggie"}>
        <TabsList className="flex-wrap h-auto gap-1 mb-4">
          <TabsTrigger value="packs"><Package size={14} className="mr-1" />Packs</TabsTrigger>
          <TabsTrigger value="blooks"><Grid3X3 size={14} className="mr-1" />Blooks</TabsTrigger>
          <TabsTrigger value="users"><Users size={14} className="mr-1" />Users</TabsTrigger>
          <TabsTrigger value="news"><Newspaper size={14} className="mr-1" />News</TabsTrigger>
          <TabsTrigger value="banners"><Image size={14} className="mr-1" />Banners</TabsTrigger>
          <TabsTrigger value="badges"><Shield size={14} className="mr-1" />Badges</TabsTrigger>
          <TabsTrigger value="events"><Calendar size={14} className="mr-1" />Events</TabsTrigger>
          {isOwner && <TabsTrigger value="bazaar"><Palette size={14} className="mr-1" />Bazaar</TabsTrigger>}
          {isStrictOwner && <TabsTrigger value="sidebar"><PanelLeft size={14} className="mr-1" />Sidebar</TabsTrigger>}
          {isOwner && <TabsTrigger value="security"><Lock size={14} className="mr-1" />Security</TabsTrigger>}
          {isAdmin && <TabsTrigger value="usernames"><History size={14} className="mr-1" />Usernames</TabsTrigger>}
          {isStrictOwner && <TabsTrigger value="rules"><Shield size={14} className="mr-1" />Rules</TabsTrigger>}
          {canManageCodes && <TabsTrigger value="codes"><KeyRound size={14} className="mr-1" />Codes</TabsTrigger>}
          {isStrictOwner && <TabsTrigger value="bans"><ShieldAlert size={14} className="mr-1" />Ban Requests{pendingBans > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] rounded-full px-1.5">{pendingBans}</span>}</TabsTrigger>}
          {isAdmin && <TabsTrigger value="appeals"><ShieldAlert size={14} className="mr-1" />Ban Appeals</TabsTrigger>}
          {isAdmin && <TabsTrigger value="reports"><Flag size={14} className="mr-1" />Reports</TabsTrigger>}
          {isAdmin && <TabsTrigger value="blookapps"><Palette size={14} className="mr-1" />Blook Apps</TabsTrigger>}
          {canManageBiggie && <TabsTrigger value="biggie"><Sandwich size={14} className="mr-1" />Biggie</TabsTrigger>}
          {isAdmin && <TabsTrigger value="updates"><Newspaper size={14} className="mr-1" />Updates</TabsTrigger>}
          {isAdmin && <TabsTrigger value="invites"><Mail size={14} className="mr-1" />Invites</TabsTrigger>}
          {isAdmin && <TabsTrigger value="bot"><Bot size={14} className="mr-1" />Bot</TabsTrigger>}
          {isOwner && <TabsTrigger value="abuse"><Coins size={14} className="mr-1" />Abuse</TabsTrigger>}
          {isOwner && <TabsTrigger value="altlinks"><Link2 size={14} className="mr-1" />Alt Links</TabsTrigger>}
        </TabsList>
        <TabsContent value="packs"><PacksAdmin /></TabsContent>
        <TabsContent value="blooks"><BlooksAdmin adminProfile={profile} /></TabsContent>
        <TabsContent value="users"><UsersAdmin profile={profile} /></TabsContent>
        <TabsContent value="news"><NewsAdmin /></TabsContent>
        <TabsContent value="banners"><BannersAdmin /></TabsContent>
        <TabsContent value="badges"><BadgesAdmin /></TabsContent>
        <TabsContent value="events"><EventsAdmin /></TabsContent>
        {isOwner && <TabsContent value="bazaar"><BazaarAdmin adminProfile={profile} /></TabsContent>}
        {isStrictOwner && <TabsContent value="sidebar"><SidebarAdmin /></TabsContent>}
        {isOwner && <TabsContent value="security"><SecurityAdmin adminProfile={profile} /></TabsContent>}
        {isAdmin && <TabsContent value="usernames"><UsernameChangesAdmin /></TabsContent>}
        {isStrictOwner && <TabsContent value="rules"><RulesManager /></TabsContent>}
        {canManageCodes && <TabsContent value="codes"><AdminCodes /></TabsContent>}
        {isStrictOwner && <TabsContent value="bans"><BanRequestsAdmin adminProfile={profile} /></TabsContent>}
        {isAdmin && <TabsContent value="appeals"><BanAppealsAdmin adminProfile={profile} /></TabsContent>}
        {isAdmin && <TabsContent value="reports"><ReportsAdmin adminProfile={profile} /></TabsContent>}
        {isAdmin && <TabsContent value="blookapps"><BlookAppsAdmin /></TabsContent>}
        {canManageBiggie && <TabsContent value="biggie"><BiggiePanelManager /></TabsContent>}
        {isAdmin && <TabsContent value="updates"><UpdatesAdmin /></TabsContent>}
        {isAdmin && <TabsContent value="invites"><InvitesAdmin adminProfile={profile} /></TabsContent>}
        {isAdmin && <TabsContent value="bot"><BotAdmin /></TabsContent>}
        {isOwner && <TabsContent value="abuse"><AbuseAdmin adminProfile={profile} /></TabsContent>}
        {isOwner && <TabsContent value="altlinks"><AltLinksAdmin /></TabsContent>}
        </Tabs>
    </div>
  );
}

function PacksAdmin() {
  const [packs, setPacks] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', cost: 100, image_url: '', background_url: '', is_active: true, bazaar_only: false, release_date: '', order: 0 });

  useEffect(() => { loadPacks(); }, []);
  const loadPacks = () => base44.entities.Pack.list('order').then(ps => setPacks(ps.filter(p => p.game !== 'pokemon')));

  const save = async () => {
    if (editing) { await base44.entities.Pack.update(editing, form); } else { await base44.entities.Pack.create(form); }
    setForm({ name: '', description: '', cost: 100, image_url: '', background_url: '', is_active: true, bazaar_only: false, release_date: '', order: 0 });
    setEditing(null); loadPacks();
  };

  return (
    <div className="space-y-4">
      <div className="bg-panel rounded-xl border border-white/10 p-4">
        <h3 className="font-display text-[#a7fcc9] mb-3">{editing ? 'Edit Pack' : 'Add Pack'}</h3>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Pack name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input type="number" placeholder="Cost" value={form.cost} onChange={e => setForm({ ...form, cost: parseInt(e.target.value) || 0 })} />
          <ImageUpload label="Pack Image" value={form.image_url} onChange={v => setForm({ ...form, image_url: v })} />
          <ImageUpload label="Background" value={form.background_url} onChange={v => setForm({ ...form, background_url: v })} />
          <Input placeholder="Release date (optional)" type="datetime-local" value={form.release_date?.slice(0, 16) || ''} onChange={e => setForm({ ...form, release_date: e.target.value ? new Date(e.target.value).toISOString() : '' })} />
          <Input type="number" placeholder="Order" value={form.order} onChange={e => setForm({ ...form, order: parseInt(e.target.value) || 0 })} />
        </div>
        <Textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-2" rows={2} />
        <div className="flex items-center gap-2 mt-2">
          <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
          <span className="text-xs text-white">Active</span>
          <Switch checked={form.bazaar_only} onCheckedChange={v => setForm({ ...form, bazaar_only: v })} className="ml-4" />
          <span className="text-xs text-white">Bazaar-only</span>
        </div>
        <div className="flex gap-2 mt-3">
          <Button onClick={save} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>{editing ? 'Update' : 'Add Pack'}</Button>
          {editing && <Button variant="outline" onClick={() => { setEditing(null); setForm({ name: '', description: '', cost: 100, image_url: '', background_url: '', is_active: true, bazaar_only: false, release_date: '', order: 0 }); }}>Cancel</Button>}
        </div>
      </div>
      <div className="space-y-2">
        {packs.map(pack => (
          <div key={pack.id} className="bg-panel rounded-xl border border-white/10 p-3 flex items-center justify-between">
            <div>
              <span className="font-display text-sm text-[#a7fcc9]">{pack.name}</span>
              <span className="text-xs text-white/60 ml-2">🪙{pack.cost} {!pack.is_active && '(inactive)'} {pack.bazaar_only && '(bazaar-only)'}</span>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => { setEditing(pack.id); setForm(pack); }} className="border-white/20 text-white"><Edit size={12} /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BlooksAdmin({ adminProfile }) {
  const isStrictOwner = adminProfile?.role === 'owner';
  const [blooks, setBlooks] = useState([]);
  const [packs, setPacks] = useState([]);
  const [editing, setEditing] = useState(null);
  const [blookSearch, setBlookSearch] = useState('');
  const [form, setForm] = useState({ name: '', image_url: '', rarity: 'uncommon', pack_id: '', drop_chance: 10, is_active: true, is_deleted: false, bazaar_event: false, login_prize: false, release_date: '', shiny_allowed: true, craftable: true, crate_allowed: true });

  useEffect(() => {
    base44.entities.Blook.list('-created_date', 1000).then(bs => setBlooks(bs.filter(b => b.game !== 'pokemon' || b.id === MEGA_CHARIZARD_BLOOK_ID || b.id === MEGA_DARKRAI_BLOOK_ID)));
    base44.entities.Pack.list().then(ps => setPacks(ps.filter(p => p.game !== 'pokemon')));
  }, []);
  const loadBlooks = () => base44.entities.Blook.list('-created_date', 1000).then(bs => setBlooks(bs.filter(b => b.game !== 'pokemon' || b.id === MEGA_CHARIZARD_BLOOK_ID || b.id === MEGA_DARKRAI_BLOOK_ID)));

  const save = async () => {
    const data = { ...form, sell_price: SELL_PRICES[form.rarity] || 5 };
    if (editing) { await base44.entities.Blook.update(editing, data); } else { await base44.entities.Blook.create(data); }
    setForm({ name: '', image_url: '', rarity: 'uncommon', pack_id: '', drop_chance: 10, is_active: true, is_deleted: false, bazaar_event: false, login_prize: false, release_date: '', shiny_allowed: true, craftable: true, crate_allowed: true });
    setEditing(null); loadBlooks();
  };

  const deleteBlook = async (id) => {
    const blook = blooks.find(b => b.id === id);
    if (isProtectedEventBlook(blook) && !isStrictOwner) { alert('Only the owner can delete Spooky Month or PAC3 event blooks.'); return; }
    if (blook?.locked) { alert('This blook is locked and cannot be deleted.'); return; }
    await base44.entities.Blook.update(id, { is_deleted: true }); loadBlooks();
  };

  const [blookCounts, setBlookCounts] = useState({});
  useEffect(() => {
    base44.entities.PlayerBlook.list('-quantity', 500).then(pbs => {
      const counts = {};
      pbs.forEach(pb => { counts[pb.blook_id] = (counts[pb.blook_id] || 0) + (pb.quantity || 1); });
      setBlookCounts(counts);
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-panel rounded-xl border border-white/10 p-4">
        <h3 className="font-display text-[#a7fcc9] mb-3">{editing ? 'Edit Blook' : 'Add Blook'}</h3>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Blook name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <ImageUpload label="Blook Image" value={form.image_url} onChange={v => setForm({ ...form, image_url: v })} />
          <Select value={form.rarity} onValueChange={v => setForm({ ...form, rarity: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{RARITY_ORDER.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={form.pack_id || 'none'} onValueChange={v => setForm({ ...form, pack_id: v === 'none' ? '' : v })}>
            <SelectTrigger><SelectValue placeholder="Select pack" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No pack</SelectItem>
              {packs.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="number" placeholder="Drop chance" value={form.drop_chance} onChange={e => setForm({ ...form, drop_chance: parseFloat(e.target.value) || 1 })} />
          <Input placeholder="Release date" type="datetime-local" value={form.release_date?.slice(0, 16) || ''} onChange={e => setForm({ ...form, release_date: e.target.value ? new Date(e.target.value).toISOString() : '' })} />
        </div>
        <div className="flex flex-wrap gap-4 mt-2">
          <label className="flex items-center gap-1 text-xs text-white"><Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />Active</label>
          <label className="flex items-center gap-1 text-xs text-white"><Switch checked={form.bazaar_event} onCheckedChange={v => setForm({ ...form, bazaar_event: v })} />Bazaar Event</label>
          <label className="flex items-center gap-1 text-xs text-white"><Switch checked={!!form.login_prize} onCheckedChange={v => setForm({ ...form, login_prize: v })} />Login Prize</label>
          <label className="flex items-center gap-1 text-xs text-white"><Switch checked={form.shiny_allowed !== false} onCheckedChange={v => setForm({ ...form, shiny_allowed: v })} />Shiny Form</label>
          <label className="flex items-center gap-1 text-xs text-white"><Switch checked={form.craftable !== false} onCheckedChange={v => setForm({ ...form, craftable: v })} />Craftable</label>
          <label className="flex items-center gap-1 text-xs text-white"><Switch checked={form.crate_allowed !== false} onCheckedChange={v => setForm({ ...form, crate_allowed: v })} />Crate-able</label>
        </div>
        <div className="flex gap-2 mt-3">
          <Button onClick={save} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>{editing ? 'Update' : 'Add Blook'}</Button>
          {editing && <Button variant="outline" onClick={() => { setEditing(null); setForm({ name: '', image_url: '', rarity: 'uncommon', pack_id: '', drop_chance: 10, is_active: true, is_deleted: false, bazaar_event: false, login_prize: false, release_date: '', shiny_allowed: true, craftable: true, crate_allowed: true }); }}>Cancel</Button>}
        </div>
      </div>
      <Input value={blookSearch} onChange={e => setBlookSearch(e.target.value)} placeholder="Search blooks by name..." className="max-w-sm mb-2" />
      <div className="space-y-2">
        {blooks.filter(b => (b.name || '').toLowerCase().includes(blookSearch.toLowerCase())).map(blook => (
          <div key={blook.id} className={`bg-panel rounded-xl border border-white/10 p-3 flex items-center justify-between ${blook.is_deleted ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-2">
              {blook.image_url ? <img src={blook.image_url} className="w-8 h-8 object-contain" alt="" /> : <img src={PLACEHOLDER_BLOOK_IMG} alt="" className="w-6 h-6 object-contain rounded" />}
              <span className={`font-display text-sm rarity-${blook.rarity}`}>{blook.name}</span>
              <span className="text-[10px] text-white/60 capitalize">{blook.rarity} • {blook.drop_chance}% • {blookCounts[blook.id] || 0} owned</span>
              {blook.login_prize && <span className="text-[10px] text-amber-300 font-display">★ Login Prize</span>}
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => { setEditing(blook.id); setForm(blook); }} className="border-white/20 text-white"><Edit size={12} /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsersAdmin({ profile: adminProfile }) {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [giveCoins, setGiveCoins] = useState({});
  const [badges, setBadges] = useState([]);
  const [playerBadges, setPlayerBadges] = useState([]);
  const [badgeDialogPlayer, setBadgeDialogPlayer] = useState(null);
  const [selectedBadge, setSelectedBadge] = useState('');
  const [blookDialogPlayer, setBlookDialogPlayer] = useState(null);
  const [allBlooks, setAllBlooks] = useState([]);
  const [blookSearch, setBlookSearch] = useState('');
  const [selectedBlookIds, setSelectedBlookIds] = useState([]);
  const [blookQty, setBlookQty] = useState(1);
  const [givingBlook, setGivingBlook] = useState(false);
  const [removeBlookDialogPlayer, setRemoveBlookDialogPlayer] = useState(null);
  const [playerInventory, setPlayerInventory] = useState([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [removeBlookSelected, setRemoveBlookSelected] = useState([]);
  const [removingBlooks, setRemovingBlooks] = useState(false);
  const [removeBadgeDialogPlayer, setRemoveBadgeDialogPlayer] = useState(null);
  const [playerBadgeList, setPlayerBadgeList] = useState([]);
  const [banDialogPlayer, setBanDialogPlayer] = useState(null);
  const [banReason, setBanReason] = useState('');
  const [banProof, setBanProof] = useState('');
  const [avatarDialogPlayer, setAvatarDialogPlayer] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [colorDialogPlayer, setColorDialogPlayer] = useState(null);
  const [colorName, setColorName] = useState('');
  const [colorChat, setColorChat] = useState('');
  const [savingColors, setSavingColors] = useState(false);
  const [resetSecurityPlayer, setResetSecurityPlayer] = useState(null);
  const [resetLoginPwPlayer, setResetLoginPwPlayer] = useState(null);
  const [sendingLoginReset, setSendingLoginReset] = useState(false);
  const isOwner = ROLE_HIERARCHY[adminProfile.role] >= ROLE_HIERARCHY['co-owner'];
  const isAdminRank = ROLE_HIERARCHY[adminProfile.role] >= ROLE_HIERARCHY.admin;
  const isStrictOwner = adminProfile.role === 'owner';
  const isProtected = (player) => (player.username || '').toLowerCase() === 'icecreamy';

  const toggleProfileLock = async (player) => {
    if (!isOwner) { alert('Only co-owner+ can lock/unlock profiles.'); return; }
    try { await adminUpdateProfile(adminProfile, player, { profile_locked: !player.profile_locked }); } catch (e) { alert('Failed: ' + (e.message || 'admin service unavailable')); }
    loadPlayers();
  };

  const openRemoveBlookDialog = async (player) => {
    setRemoveBlookDialogPlayer(player);
    setRemoveBlookSelected([]);
    setLoadingInventory(true);
    try {
      const inv = await base44.entities.PlayerBlook.filter({ user_id: player.user_id });
      const enriched = inv.map(pb => ({ ...pb, blook: allBlooks.find(b => b.id === pb.blook_id) }));
      setPlayerInventory(enriched);
    } catch { setPlayerInventory([]); }
    setLoadingInventory(false);
  };

  const removeBlookFromInventory = async (pb) => {
    if (isProtectedEventBlook(pb.blook) && !isStrictOwner) { alert('Only the owner can delete Spooky Month or PAC3 event blooks.'); return; }
    if (!confirm(`Remove ${pb.blook?.name || 'blook'} from ${removeBlookDialogPlayer.username}?`)) return;
    if ((pb.quantity || 1) > 1) {
      await base44.entities.PlayerBlook.update(pb.id, { quantity: (pb.quantity || 1) - 1 });
    } else {
      await base44.entities.PlayerBlook.delete(pb.id);
    }
    setPlayerInventory(prev => {
      const updated = prev.map(x => x.id === pb.id ? { ...x, quantity: (x.quantity || 1) - 1 } : x).filter(x => (x.quantity || 0) > 0);
      return updated;
    });
  };

  const toggleRemoveBlookSelection = (pbId) => {
    setRemoveBlookSelected(prev => prev.includes(pbId) ? prev.filter(id => id !== pbId) : [...prev, pbId]);
  };

  const removeSelectedBlooks = async () => {
    if (!removeBlookDialogPlayer || removeBlookSelected.length === 0) return;
    if (!isStrictOwner && playerInventory.some(pb => removeBlookSelected.includes(pb.id) && isProtectedEventBlook(pb.blook))) {
      alert('Only the owner can delete Spooky Month or PAC3 event blooks.');
      return;
    }
    if (!confirm(`Permanently remove ${removeBlookSelected.length} blook(s) from ${removeBlookDialogPlayer.username}?`)) return;
    setRemovingBlooks(true);
    try {
      await base44.entities.PlayerBlook.deleteMany({ id: { $in: removeBlookSelected } });
      setRemoveBlookSelected([]);
      setRemoveBlookDialogPlayer(null);
      loadPlayers();
    } catch (e) {
      alert('Failed to remove blooks: ' + (e.message || 'unknown error'));
    }
    setRemovingBlooks(false);
  };

  const openRemoveBadgeDialog = async (player) => {
    setRemoveBadgeDialogPlayer(player);
    try {
      const [pbs, allBadges] = await Promise.all([
        base44.entities.PlayerBadge.filter({ user_id: player.user_id }),
        base44.entities.Badge.list()
      ]);
      const badgeMap = {};
      allBadges.forEach(b => { badgeMap[b.id] = b; });
      setPlayerBadgeList(pbs.map(a => ({ ...a, badge: badgeMap[a.badge_id] })).filter(a => a.badge));
    } catch { setPlayerBadgeList([]); }
  };

  const removeBadgeFromPlayer = async (a) => {
    if (!confirm(`Remove badge "${a.badge.name}" from ${removeBadgeDialogPlayer.username}?`)) return;
    await base44.entities.PlayerBadge.delete(a.id);
    setPlayerBadgeList(prev => prev.filter(x => x.id !== a.id));
    loadBadges();
  };

  useEffect(() => { loadPlayers(); loadBadges(); loadBlooks(); }, []);
  const loadPlayers = async () => {
    const [ps, roles] = await Promise.all([
      base44.entities.PlayerProfile.list('-last_seen', 1000),
      base44.entities.PlayerRole.filter({}, null, 2000)
    ]);
    const roleMap = {}; roles.forEach(r => { roleMap[r.user_id] = r.role; });
    setPlayers(ps.map(p => ({ ...p, role: roleMap[p.user_id] || 'player' })));
  };
  const loadBlooks = () => base44.entities.Blook.filter({ is_deleted: false }, null, 2000).then(bs => setAllBlooks(bs)).catch(() => {});
  const loadBadges = () => {
    base44.entities.Badge.list().then(setBadges);
    base44.entities.PlayerBadge.list().then(setPlayerBadges);
  };

  const giveBadge = async () => {
    if (!badgeDialogPlayer || !selectedBadge) return;
    // Coolkids badge can only be given by minti
    const selectedBadgeObj = badges.find(b => b.id === selectedBadge);
    if (selectedBadgeObj?.name === 'Coolkids' && (adminProfile?.username || '').toLowerCase().replace(/_/g, '') !== 'minti') {
      alert('Only minti can give the Coolkids badge.');
      return;
    }
    if (playerBadges.some(a => a.user_id === badgeDialogPlayer.user_id && a.badge_id === selectedBadge)) {
      alert('Player already has this badge');
      return;
    }
    await base44.entities.PlayerBadge.create({ user_id: badgeDialogPlayer.user_id, badge_id: selectedBadge });
    setSelectedBadge('');
    setBadgeDialogPlayer(null);
    loadBadges();
  };

  const changeRole = async (player, newRole) => {
    if (isProtected(player)) return;
    if (player.user_id === adminProfile.user_id) {
      alert('You cannot change your own role.');
      return;
    }
    if (!allowedRolesFor(adminProfile).includes(newRole)) {
      alert('You are not allowed to assign that role.');
      return;
    }
    const v = ROLE_HIERARCHY[adminProfile.role] || 0;
    if (v < ROLE_HIERARCHY.owner && (ROLE_HIERARCHY[player.role] || 0) >= v) {
      alert('You cannot modify a user at or above your rank.');
      return;
    }
    try {
      // Write the role directly so promotions (including the "biggie" role)
      // work reliably without depending on a backend function.
      const existing = await base44.entities.PlayerRole.filter({ user_id: player.user_id });
      if (existing.length) await base44.entities.PlayerRole.update(existing[0].id, { role: newRole });
      else await base44.entities.PlayerRole.create({ user_id: player.user_id, role: newRole });
      await base44.entities.PlayerProfile.update(player.id, { role: newRole });
    } catch (e) { alert('Failed: ' + (e.message || 'unknown error')); }
    loadPlayers();
  };

  const toggleMute = async (player) => {
    if (!canModerate(adminProfile, player) && !canSelfMute(adminProfile, player)) return;
    const muted = !player.is_muted;
    try { await adminUpdateProfile(adminProfile, player, { is_muted: muted, mute_until: muted ? new Date(Date.now() + 3600000).toISOString() : null, muted_by: muted ? adminProfile.username : '' }); } catch (e) { alert('Failed: ' + (e.message || 'admin service unavailable')); }
    loadPlayers();
  };

  const toggleBan = async (player) => {
    const canUnbanProtected = isProtected(player) && player.is_banned && ROLE_HIERARCHY[adminProfile.role] >= ROLE_HIERARCHY.admin;
    if (!canModerate(adminProfile, player) && !canUnbanProtected) return;
    if (player.is_banned) {
      try { await adminUpdateProfile(adminProfile, player, { is_banned: false, ban_reason: '', banned_by: '' }); } catch (e) { alert('Failed: ' + (e.message || 'admin service unavailable')); }
      loadPlayers();
      return;
    }
    if (isProtected(player)) return;
    setBanDialogPlayer(player);
    setBanReason('');
    setBanProof('');
  };

  const submitBanRequest = async () => {
    if (!banDialogPlayer || !banReason.trim()) return;
    const isAdminRank = ROLE_HIERARCHY[adminProfile.role] >= ROLE_HIERARCHY.admin;
    if (isAdminRank) {
      try {
        await adminUpdateProfile(adminProfile, banDialogPlayer, { is_banned: true, ban_reason: banReason.trim(), banned_by: adminProfile.username });
      } catch (e) { alert('Failed: ' + (e.message || 'admin service unavailable')); }
      loadPlayers();
    } else {
      await base44.entities.BanRequest.create({
        target_user_id: banDialogPlayer.user_id,
        target_username: banDialogPlayer.username,
        requester_id: adminProfile.user_id,
        requester_username: adminProfile.username,
        reason: banReason.trim(),
        proof: banProof.trim(),
        status: 'pending'
      });
      alert('Ban request submitted. The owner will review it.');
    }
    setBanDialogPlayer(null);
    setBanReason('');
    setBanProof('');
  };

  const setAvatar = async () => {
    if (!avatarDialogPlayer || !avatarUrl.trim()) return;
    try {
      await adminUpdateProfile(adminProfile, avatarDialogPlayer, { avatar_url: avatarUrl.trim() });
      setAvatarDialogPlayer(null);
      setAvatarUrl('');
      loadPlayers();
    } catch (e) {
      alert('Failed to update avatar: ' + (e.message || 'admin service unavailable'));
    }
  };

  const saveColors = async () => {
    if (!colorDialogPlayer) return;
    setSavingColors(true);
    try {
      const patch = {};
      if (colorName !== (colorDialogPlayer.name_color || '')) patch.name_color = colorName;
      if (colorChat !== (colorDialogPlayer.chat_color || '')) patch.chat_color = colorChat;
      if (Object.keys(patch).length > 0) {
        await adminUpdateProfile(adminProfile, colorDialogPlayer, patch);
      }
      setColorDialogPlayer(null);
      loadPlayers();
    } catch (e) {
      alert('Failed to update colors: ' + (e.message || 'admin service unavailable'));
    }
    setSavingColors(false);
  };

  const resetSecurity = async () => {
    if (!resetSecurityPlayer) return;
    try {
      await adminUpdateProfile(adminProfile, resetSecurityPlayer, { reset_security: true });
      setResetSecurityPlayer(null);
      alert('Security password reset. The user will set a new one on their next security check.');
    } catch (e) {
      alert('Failed: ' + (e.message || 'admin service unavailable'));
    }
  };

  const sendLoginPasswordReset = async () => {
    if (!resetLoginPwPlayer) return;
    setSendingLoginReset(true);
    try {
      const users = await base44.entities.User.filter({ id: resetLoginPwPlayer.user_id });
      if (!users[0]?.email) { alert('Could not find this user\'s email.'); return; }
      await base44.auth.resetPasswordRequest(users[0].email);
      alert(`Password reset email sent to ${resetLoginPwPlayer.username}!`);
      setResetLoginPwPlayer(null);
    } catch (e) {
      alert('Failed: ' + (e.message || 'unknown error'));
    }
    setSendingLoginReset(false);
  };

  const ipBanUser = async (player) => {
    if (isProtected(player)) { alert('Cannot IP ban this user.'); return; }
    try {
      const ipRecs = await base44.entities.IpRecord.filter({ user_id: player.user_id });
      if (ipRecs.length === 0) { alert('No IP records found for this user. They may have joined before IP tracking was enabled.'); return; }
      const alreadyBlocked = await base44.entities.BlockedIp.filter({ ip_hash: ipRecs[0].ip_hash });
      if (alreadyBlocked.length > 0) { alert('This user\'s IP is already blocked.'); return; }
      const reason = prompt(`IP Ban ${player.username}?\nThis will block ALL accounts from their IP.\nReason:`, 'Alt abuse / hacking');
      if (reason === null) return;
      await base44.entities.BlockedIp.create({ ip_hash: ipRecs[0].ip_hash, reason: reason.trim(), blocked_by_username: adminProfile.username });
      alert(`IP banned ${player.username}. All future logins from their IP will be blocked.`);
    } catch (e) { alert('IP ban failed: ' + (e.message || 'unknown error')); }
  };

  const handleGiveCoins = async (player) => {
    const amount = parseInt(giveCoins[player.id]) || 0;
    if (amount <= 0) return;
    try { await adminUpdateProfile(adminProfile, player, { tokens: (player.tokens || 0) + amount }); } catch (e) { alert('Failed: ' + (e.message || 'admin service unavailable')); }
    setGiveCoins(prev => ({ ...prev, [player.id]: '' }));
    loadPlayers();
  };

  const handleRemoveCoins = async (player) => {
    const amount = parseInt(giveCoins[player.id]) || 0;
    if (amount <= 0) return;
    const newTokens = Math.max(0, (player.tokens || 0) - amount);
    try { await adminUpdateProfile(adminProfile, player, { tokens: newTokens }); } catch (e) { alert('Failed: ' + (e.message || 'admin service unavailable')); }
    setGiveCoins(prev => ({ ...prev, [player.id]: '' }));
    loadPlayers();
  };

  const toggleBlookSelection = (blookId) => {
    setSelectedBlookIds(prev => prev.includes(blookId) ? prev.filter(id => id !== blookId) : [...prev, blookId]);
  };

  const giveBlook = async () => {
    if (!blookDialogPlayer || selectedBlookIds.length === 0 || blookQty < 1) return;
    setGivingBlook(true);
    try {
      for (const blookId of selectedBlookIds) {
        const blook = allBlooks.find(b => b.id === blookId);
        const game = blook?.game || 'icecreamet';
        const existing = await base44.entities.PlayerBlook.filter({ user_id: blookDialogPlayer.user_id, blook_id: blookId, game });
        if (existing.length) {
          await base44.entities.PlayerBlook.update(existing[0].id, { quantity: (existing[0].quantity || 0) + blookQty });
        } else {
          await base44.entities.PlayerBlook.create({ user_id: blookDialogPlayer.user_id, blook_id: blookId, quantity: blookQty, game });
        }
      }
      alert(`Gave ${blookQty}x ${selectedBlookIds.length} blook(s) to ${blookDialogPlayer.username}!`);
      setBlookDialogPlayer(null);
      setSelectedBlookIds([]);
      setBlookQty(1);
      setBlookSearch('');
    } catch (e) {
      alert('Failed to give blook: ' + e.message);
    }
    setGivingBlook(false);
  };

  const filteredBlooks = allBlooks.filter(b => b.name?.toLowerCase().includes(blookSearch.toLowerCase())).slice(0, 50);

  const filtered = players.filter(p => p.username?.toLowerCase().includes(search.toLowerCase()) && (roleFilter === 'all' || p.role === roleFilter));
  const onlineCount = players.filter(p => p.last_seen && Date.now() - p.last_seen < 120000).length;

  const resetAllTokens = async () => {
    if (!confirm('Reset ALL players tokens to 500?')) return;
    await base44.entities.PlayerProfile.updateMany({}, { $set: { tokens: 500 } });
    loadPlayers();
  };
  const capAllTokens = async () => {
    if (!confirm('Cap all players at 50M tokens?')) return;
    await base44.entities.PlayerProfile.updateMany({ tokens: { $gt: 50000000 } }, { $set: { tokens: 50000000 } });
    loadPlayers();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="bg-panel rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white">👥 Players: {players.length}{players.length >= 1000 ? '+' : ''}</span>
        <span className="bg-panel rounded-lg border border-green-500/30 px-3 py-1.5 text-sm text-green-400">🟢 Online now: {onlineCount}</span>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={resetAllTokens} className="border-red-500/40 text-red-400">Reset All Tokens (500)</Button>
        <Button size="sm" variant="outline" onClick={capAllTokens} className="border-white/20 text-white">Cap All at 50M</Button>
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="max-w-sm" />
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40 text-sm"><SelectValue placeholder="All roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All roles</SelectItem>
            <SelectItem value="player" className="text-xs capitalize">Player</SelectItem>
            <SelectItem value="moderator" className="text-xs capitalize">Moderator</SelectItem>
            <SelectItem value="admin" className="text-xs capitalize">Admin</SelectItem>
            <SelectItem value="co-owner" className="text-xs capitalize">Co-owner</SelectItem>
            <SelectItem value="owner" className="text-xs capitalize">Owner</SelectItem>
            <SelectItem value="biggie" className="text-xs capitalize">Biggie</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        {filtered.map(player => (
          <div key={player.id} className="bg-panel rounded-xl border border-white/10 p-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 avatar-rounded-square bg-white/10 overflow-hidden">
                {player.avatar_url ? <img src={player.avatar_url} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-xs text-white">{player.username?.[0]?.toUpperCase()}</div>}
              </div>
              <div>
                <span className="font-display text-sm text-white">{player.username}</span>
                <span className="text-[10px] text-white/60 ml-2 capitalize">{player.role}</span>
                <span className="text-[10px] text-[#a7fcc9] ml-1">🪙 {(player.tokens || 0).toLocaleString()}</span>
                {player.is_muted && <span className="text-[10px] text-red-400 ml-1">MUTED{player.muted_by ? ` BY ${player.muted_by}` : ''}</span>}
                {player.is_banned && <span className="text-[10px] text-red-400 ml-1">BANNED{player.banned_by ? ` BY ${player.banned_by}` : ''}</span>}
              </div>
            </div>
            <div className="flex gap-1 items-center flex-wrap">
              <div className="flex items-center gap-1">
                <Input type="number" value={giveCoins[player.id] || ''} onChange={e => setGiveCoins(prev => ({ ...prev, [player.id]: e.target.value }))} placeholder="Coins" className="h-7 w-20 text-xs" />
                <Button size="sm" variant="outline" onClick={() => handleGiveCoins(player)} className="text-xs border-white/20 text-[#a7fcc9]"><Coins size={12} className="mr-1" />Give</Button>
                <Button size="sm" variant="outline" onClick={() => handleRemoveCoins(player)} className="text-xs border-red-500/40 text-red-400"><Coins size={12} className="mr-1" />Take</Button>
              </div>
              {canModerate(adminProfile, player) && (
                <Select value={player.role} onValueChange={v => changeRole(player, v)}>
                  <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allowedRolesFor(adminProfile).map(r => (
                      <SelectItem key={r} value={r} className="capitalize text-xs">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {(canModerate(adminProfile, player) || canSelfMute(adminProfile, player)) && (
                <Button size="sm" variant="outline" onClick={() => toggleMute(player)} className="text-xs border-white/20 text-white">
                  {player.is_muted ? 'Unmute' : 'Mute'}
                </Button>
              )}
              {(canModerate(adminProfile, player) || (isProtected(player) && player.is_banned && isOwner)) && (
                <Button size="sm" variant="outline" onClick={() => toggleBan(player)} className="text-xs border-white/20 text-red-400">
                  {player.is_banned ? 'Unban' : 'Ban'}
                </Button>
              )}
              {isOwner && (
                <Button size="sm" variant="outline" onClick={() => ipBanUser(player)} className="text-xs border-red-500/40 text-red-400">
                  <Ban size={12} className="mr-1" />IP Ban
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => { setBadgeDialogPlayer(player); setSelectedBadge(''); }} className="text-xs border-yellow-500/40 text-yellow-400">
                <Shield size={12} className="mr-1" />Give Badge
              </Button>
              <Button size="sm" variant="outline" onClick={() => openRemoveBadgeDialog(player)} className="text-xs border-yellow-500/40 text-yellow-400">
                <Trash2 size={12} className="mr-1" />Remove Badge
              </Button>
              {isAdminRank && (
                <Button size="sm" variant="outline" onClick={() => { setBlookDialogPlayer(player); setSelectedBlookIds([]); setBlookSearch(''); setBlookQty(1); }} className="text-xs border-purple-500/40 text-purple-400">
                  <Grid3X3 size={12} className="mr-1" />Give Blook
                </Button>
              )}
              {isOwner && (
                <Button size="sm" variant="outline" onClick={() => openRemoveBlookDialog(player)} className="text-xs border-red-500/40 text-red-400">
                  <Trash2 size={12} className="mr-1" />Remove Blook
                </Button>
              )}
              {isOwner && (
                <Button size="sm" variant="outline" onClick={() => { setAvatarDialogPlayer(player); setAvatarUrl(player.avatar_url || ''); }} className="text-xs border-blue-500/40 text-blue-400">
                  <Image size={12} className="mr-1" />Set Pic
                </Button>
              )}
              {isOwner && (
                <Button size="sm" variant="outline" onClick={() => { setColorDialogPlayer(player); setColorName(player.name_color || ''); setColorChat(player.chat_color || ''); }} className="text-xs border-pink-500/40 text-pink-400">
                  <Palette size={12} className="mr-1" />Colors
                </Button>
              )}
              {isOwner && canModerate(adminProfile, player) && (
                <Button size="sm" variant="outline" onClick={() => setResetSecurityPlayer(player)} className="text-xs border-orange-500/40 text-orange-400">
                  <KeyRound size={12} className="mr-1" />Reset PW
                </Button>
              )}
              {isOwner && canModerate(adminProfile, player) && (
                <Button size="sm" variant="outline" onClick={() => setResetLoginPwPlayer(player)} className="text-xs border-blue-500/40 text-blue-400">
                  <Mail size={12} className="mr-1" />Reset Login
                </Button>
              )}
              {isOwner && (
                <Button size="sm" variant="outline" onClick={() => toggleProfileLock(player)} className="text-xs border-purple-500/40 text-purple-400">
                  <Lock size={12} className="mr-1" />{player.profile_locked ? 'Unlock' : 'Lock'}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <Dialog open={!!badgeDialogPlayer} onOpenChange={v => !v && setBadgeDialogPlayer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Give Badge to {badgeDialogPlayer?.username}</DialogTitle>
          </DialogHeader>
          <Select value={selectedBadge} onValueChange={setSelectedBadge}>
            <SelectTrigger><SelectValue placeholder="Select an existing badge" /></SelectTrigger>
            <SelectContent>
              {badges.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={giveBadge} disabled={!selectedBadge} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Give Badge</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={!!blookDialogPlayer} onOpenChange={v => !v && setBlookDialogPlayer(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Give Blook to {blookDialogPlayer?.username}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 mb-2">
            <Input value={blookSearch} onChange={e => setBlookSearch(e.target.value)} placeholder="Search blooks..." className="flex-1" />
            <Button size="sm" variant="outline" onClick={() => setSelectedBlookIds(filteredBlooks.map(b => b.id))} className="text-xs border-white/20 text-white">All</Button>
            <Button size="sm" variant="outline" onClick={() => setSelectedBlookIds([])} className="text-xs border-white/20 text-white">Clear</Button>
          </div>
          <div className="max-h-48 overflow-y-auto border border-white/10 rounded-lg p-1 space-y-1">
            {filteredBlooks.map(b => {
              const isSelected = selectedBlookIds.includes(b.id);
              return (
                <div key={b.id} onClick={() => toggleBlookSelection(b.id)} className={`flex items-center gap-2 p-1.5 rounded cursor-pointer ${isSelected ? 'bg-[#a7fcc9]/30' : 'hover:bg-white/5'}`}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-[#a7fcc9] border-[#a7fcc9]' : 'border-white/30'}`}>
                    {isSelected && <span className="text-[10px] text-panel font-bold">✓</span>}
                  </div>
                  {b.image_url ? <img src={b.image_url} className="w-6 h-6 object-contain" alt="" /> : <img src={PLACEHOLDER_BLOOK_IMG} alt="" className="w-6 h-6 object-contain rounded" />}
                  <span className={`text-sm rarity-${b.rarity} flex-1`}>{b.name}</span>
                  <span className="text-[10px] text-white/60 capitalize">{b.rarity} • {b.game}</span>
                </div>
              );
            })}
            {filteredBlooks.length === 0 && <p className="text-white/60 text-xs p-2">No blooks found</p>}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-white">Quantity:</span>
            <Input type="number" min="1" value={blookQty} onChange={e => setBlookQty(Math.max(1, parseInt(e.target.value) || 1))} className="w-24" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-white">{selectedBlookIds.length} selected</span>
            <Button onClick={giveBlook} disabled={selectedBlookIds.length === 0 || givingBlook} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
              {givingBlook ? 'Giving...' : `Give ${selectedBlookIds.length} Blook(s)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!removeBlookDialogPlayer} onOpenChange={v => !v && setRemoveBlookDialogPlayer(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Remove Blooks from {removeBlookDialogPlayer?.username}</DialogTitle>
          </DialogHeader>
          {loadingInventory ? <p className="text-white/60 text-xs">Loading...</p> : (
            <>
              <div className="flex gap-2 mb-2 items-center">
                <Button size="sm" variant="outline" onClick={() => setRemoveBlookSelected(playerInventory.map(p => p.id))} className="text-xs border-white/20 text-white">Select All</Button>
                <Button size="sm" variant="outline" onClick={() => setRemoveBlookSelected([])} className="text-xs border-white/20 text-white">Clear</Button>
                <Button size="sm" onClick={removeSelectedBlooks} disabled={removingBlooks || removeBlookSelected.length === 0} className="text-xs ml-auto" style={{ backgroundColor: '#ef4444', color: '#fff' }}>
                  {removingBlooks ? 'Removing...' : `Remove Selected (${removeBlookSelected.length})`}
                </Button>
              </div>
              <div className="max-h-64 overflow-y-auto border border-white/10 rounded-lg p-1 space-y-1">
                {playerInventory.map(pb => {
                  const isSelected = removeBlookSelected.includes(pb.id);
                  return (
                    <div key={pb.id} onClick={() => toggleRemoveBlookSelection(pb.id)} className={`flex items-center gap-2 p-1.5 rounded cursor-pointer ${isSelected ? 'bg-red-500/20' : 'hover:bg-white/5'}`}>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-red-500 border-red-500' : 'border-white/30'}`}>
                        {isSelected && <span className="text-[10px] text-white font-bold">✓</span>}
                      </div>
                      {pb.blook?.image_url ? <img src={pb.blook.image_url} className="w-6 h-6 object-contain" alt="" /> : <img src={PLACEHOLDER_BLOOK_IMG} alt="" className="w-6 h-6 object-contain rounded" />}
                      <span className={`text-sm rarity-${pb.blook?.rarity || ''} flex-1`}>{pb.blook?.name || 'Unknown'}</span>
                      <span className="text-[10px] text-white/60">x{pb.quantity || 1}</span>
                    </div>
                  );
                })}
                {playerInventory.length === 0 && <p className="text-white/60 text-xs p-2">No blooks in inventory</p>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!removeBadgeDialogPlayer} onOpenChange={v => !v && setRemoveBadgeDialogPlayer(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Remove Badges from {removeBadgeDialogPlayer?.username}</DialogTitle>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto border border-white/10 rounded-lg p-1 space-y-1">
            {playerBadgeList.map(a => (
              <div key={a.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-white/5">
                {a.badge.image_url ? <img src={a.badge.image_url} className="w-6 h-6 object-contain" alt="" /> : <span>🏅</span>}
                <span className="text-sm text-white flex-1">{a.badge.name}</span>
                <Button size="sm" variant="outline" onClick={() => removeBadgeFromPlayer(a)} className="text-xs border-red-500/40 text-red-400 h-7 px-2">
                  <Trash2 size={12} />
                </Button>
              </div>
            ))}
            {playerBadgeList.length === 0 && <p className="text-white/60 text-xs p-2">No badges assigned</p>}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!banDialogPlayer} onOpenChange={v => !v && setBanDialogPlayer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ROLE_HIERARCHY[adminProfile.role] >= ROLE_HIERARCHY.admin ? `Ban ${banDialogPlayer?.username}` : `Request ban for ${banDialogPlayer?.username}`}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-white/60">{ROLE_HIERARCHY[adminProfile.role] >= ROLE_HIERARCHY.admin ? 'Provide a reason for this ban. The user will see this reason on their banned screen.' : 'Provide a reason and proof. The owner will review and approve or reject this ban. The user will not be banned until the owner accepts.'}</p>
          <Textarea placeholder="Reason (required)" value={banReason} onChange={e => setBanReason(e.target.value)} rows={2} className="bg-white/10 border-white/20 text-white" />
          {ROLE_HIERARCHY[adminProfile.role] < ROLE_HIERARCHY.admin && (
            <Textarea placeholder="Proof (optional — links or details)" value={banProof} onChange={e => setBanProof(e.target.value)} rows={2} className="bg-white/10 border-white/20 text-white" />
          )}
          <Button onClick={submitBanRequest} disabled={!banReason.trim()} style={{ backgroundColor: '#ef4444', color: '#fff' }}>{ROLE_HIERARCHY[adminProfile.role] >= ROLE_HIERARCHY.admin ? 'Ban User' : 'Submit Ban Request'}</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={!!avatarDialogPlayer} onOpenChange={v => !v && setAvatarDialogPlayer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Avatar for {avatarDialogPlayer?.username}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-white/60">Paste an image URL. The avatar updates instantly across the game.</p>
          <Input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." className="bg-white/10 border-white/20 text-white" />
          {avatarUrl && <img src={avatarUrl} className="w-16 h-16 rounded-lg object-cover mx-auto" alt="" onError={(e) => { e.target.style.display = 'none'; }} />}
          <Button onClick={setAvatar} disabled={!avatarUrl.trim()} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Update Avatar</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={!!colorDialogPlayer} onOpenChange={v => !v && setColorDialogPlayer(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Colors for {colorDialogPlayer?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-white/50 mb-2">Username Color/Gradient</p>
              <GradientColorPicker value={colorName} onChange={setColorName} />
            </div>
            <div>
              <p className="text-xs text-white/50 mb-2">Chat Message Color/Gradient</p>
              <GradientColorPicker value={colorChat} onChange={setColorChat} />
            </div>
          </div>
          <Button onClick={saveColors} disabled={savingColors} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
            {savingColors ? 'Saving...' : 'Save Colors'}
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={!!resetSecurityPlayer} onOpenChange={v => !v && setResetSecurityPlayer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Security Password for {resetSecurityPlayer?.username}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-white/60">This clears their current security password. They'll be asked to set a new one the next time they're due for a security check.</p>
          <Button onClick={resetSecurity} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Reset Password</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={!!resetLoginPwPlayer} onOpenChange={v => !v && setResetLoginPwPlayer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Login Password for {resetLoginPwPlayer?.username}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-white/60">This sends a password reset email to {resetLoginPwPlayer?.username}. They'll follow the link in the email to set a new login password.</p>
          <Button onClick={sendLoginPasswordReset} disabled={sendingLoginReset} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
            {sendingLoginReset ? 'Sending...' : 'Send Reset Email'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewsAdmin() {
  const [news, setNews] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', content: '', image_url: '', is_active: true, priority: 0 });

  useEffect(() => { loadNews(); }, []);
  const loadNews = () => base44.entities.NewsItem.list('-priority').then(setNews);

  const save = async () => {
    if (editing) { await base44.entities.NewsItem.update(editing, form); } else { await base44.entities.NewsItem.create(form); }
    setForm({ title: '', content: '', image_url: '', is_active: true, priority: 0 });
    setEditing(null); loadNews();
  };

  const deleteNews = async (id) => { await base44.entities.NewsItem.delete(id); loadNews(); };

  return (
    <div className="space-y-4">
      <div className="bg-panel rounded-xl border border-white/10 p-4">
        <h3 className="font-display text-[#a7fcc9] mb-3">{editing ? 'Edit News' : 'Add News'}</h3>
        <Input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mb-2" />
        <Textarea placeholder="Content" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="mb-2" rows={4} />
        <div className="mb-2"><ImageUpload label="News Image" value={form.image_url} onChange={v => setForm({ ...form, image_url: v })} /></div>
        <Input type="number" placeholder="Priority" value={form.priority} onChange={e => setForm({ ...form, priority: parseInt(e.target.value) || 0 })} className="mb-2" />
        <div className="flex items-center gap-2 mb-3">
          <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
          <span className="text-xs text-white">Active</span>
        </div>
        <div className="flex gap-2">
          <Button onClick={save} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>{editing ? 'Update' : 'Add News'}</Button>
          {editing && <Button variant="outline" onClick={() => { setEditing(null); setForm({ title: '', content: '', image_url: '', is_active: true, priority: 0 }); }}>Cancel</Button>}
        </div>
      </div>
      <div className="space-y-2">
        {news.map(item => (
          <div key={item.id} className="bg-panel rounded-xl border border-white/10 p-3 flex items-center justify-between">
            <div>
              <span className="font-display text-sm text-[#a7fcc9]">{item.title}</span>
              {!item.is_active && <span className="text-[10px] text-red-400 ml-2">(hidden)</span>}
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => { setEditing(item.id); setForm(item); }} className="border-white/20 text-white"><Edit size={12} /></Button>
              <Button size="sm" variant="outline" onClick={() => deleteNews(item.id)} className="border-white/20 text-red-400"><Trash2 size={12} /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BannersAdmin() {
  const [banners, setBanners] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', image_url: '', cost: 500, is_active: true, category: 'shop' });

  useEffect(() => { loadBanners(); }, []);
  const loadBanners = () => base44.entities.Banner.list().then(setBanners);

  const save = async () => {
    if (editing) { await base44.entities.Banner.update(editing, form); } else { await base44.entities.Banner.create(form); }
    setForm({ name: '', image_url: '', cost: 500, is_active: true, category: 'shop' });
    setEditing(null); loadBanners();
  };

  return (
    <div className="space-y-4">
      <div className="bg-panel rounded-xl border border-white/10 p-4">
        <h3 className="font-display text-[#a7fcc9] mb-3">{editing ? 'Edit Banner' : 'Add Banner'}</h3>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <ImageUpload label="Banner Image" value={form.image_url} onChange={v => setForm({ ...form, image_url: v })} />
          <Input type="number" placeholder="Cost" value={form.cost} onChange={e => setForm({ ...form, cost: parseInt(e.target.value) || 0 })} />
          <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="shop">Shop</SelectItem>
              <SelectItem value="event">Event</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
          <span className="text-xs text-white">Active</span>
        </div>
        <Button onClick={save} className="mt-3" style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>{editing ? 'Update' : 'Add'}</Button>
        {editing && <Button variant="outline" onClick={() => { setEditing(null); setForm({ name: '', image_url: '', cost: 500, is_active: true, category: 'shop' }); }} className="ml-2 mt-3">Cancel</Button>}
      </div>
      <div className="space-y-2">
        {banners.map(b => (
          <div key={b.id} className="bg-panel rounded-xl border border-white/10 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {b.image_url && <img src={b.image_url} className="w-16 h-8 rounded object-cover" alt="" />}
              <span className="font-display text-sm text-white">{b.name}</span>
              <span className="text-[10px] text-white/60">🪙{b.cost}</span>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => { setEditing(b.id); setForm(b); }} className="border-white/20 text-white"><Edit size={12} /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BadgesAdmin() {
  const [badges, setBadges] = useState([]);
  const [form, setForm] = useState({ name: '', image_url: '', type: 'custom', criteria_value: '' });
  const [editing, setEditing] = useState(null);
  const [assignBadgeId, setAssignBadgeId] = useState('');
  const [assignUsername, setAssignUsername] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [players, setPlayers] = useState([]);

  const loadAll = async () => {
    const [bg, as, pl] = await Promise.all([
      base44.entities.Badge.list(),
      base44.entities.PlayerBadge.list(),
      base44.entities.PlayerProfile.list()
    ]);
    setBadges(bg);
    setAssignments(as);
    setPlayers(pl);
  };
  useEffect(() => { loadAll(); }, []);

  const save = async () => {
    if (editing) { await base44.entities.Badge.update(editing, form); } else { await base44.entities.Badge.create(form); }
    setForm({ name: '', image_url: '', type: 'custom', criteria_value: '' });
    setEditing(null); loadAll();
  };

  const assignBadge = async () => {
    if (!assignBadgeId || !assignUsername.trim()) return;
    const target = players.find(p => (p.username || '').toLowerCase() === assignUsername.trim().toLowerCase());
    if (!target) { alert('Player not found'); return; }
    if (assignments.some(a => a.user_id === target.user_id && a.badge_id === assignBadgeId)) { alert('Already assigned'); return; }
    await base44.entities.PlayerBadge.create({ user_id: target.user_id, badge_id: assignBadgeId });
    setAssignUsername('');
    loadAll();
  };

  const removeAssignment = async (id) => {
    await base44.entities.PlayerBadge.delete(id);
    loadAll();
  };

  const badgeMap = {};
  badges.forEach(b => { badgeMap[b.id] = b; });
  const playerMap = {};
  players.forEach(p => { playerMap[p.user_id] = p; });

  return (
    <div className="space-y-4">
      <div className="bg-panel rounded-xl border border-white/10 p-4">
        <h3 className="font-display text-[#a7fcc9] mb-3">{editing ? 'Edit Badge' : 'Add Badge'}</h3>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Badge name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <ImageUpload label="Badge Image" value={form.image_url} onChange={v => setForm({ ...form, image_url: v })} />
          <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="role">Role</SelectItem>
              <SelectItem value="playtime">Playtime (days)</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Criteria (role name or days)" value={form.criteria_value} onChange={e => setForm({ ...form, criteria_value: e.target.value })} />
        </div>
        <Button onClick={save} className="mt-3" style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>{editing ? 'Update' : 'Add Badge'}</Button>
        {editing && <Button variant="outline" onClick={() => { setEditing(null); setForm({ name: '', image_url: '', type: 'custom', criteria_value: '' }); }} className="ml-2 mt-3">Cancel</Button>}
      </div>
      <div className="bg-panel rounded-xl border border-white/10 p-4">
        <h3 className="font-display text-[#a7fcc9] mb-3">Assign Custom Badge</h3>
        <div className="grid grid-cols-2 gap-2">
          <Select value={assignBadgeId} onValueChange={setAssignBadgeId}>
            <SelectTrigger><SelectValue placeholder="Select badge" /></SelectTrigger>
            <SelectContent>
              {badges.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Username" value={assignUsername} onChange={e => setAssignUsername(e.target.value)} />
        </div>
        <Button onClick={assignBadge} className="mt-3" style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Assign</Button>
        <div className="space-y-1 mt-3">
          {assignments.map(a => {
            const b = badgeMap[a.badge_id];
            const p = playerMap[a.user_id];
            if (!b || !p) return null;
            return (
              <div key={a.id} className="flex items-center justify-between bg-white/5 rounded-lg p-2">
                <div className="flex items-center gap-2">
                  {b.image_url ? <img src={b.image_url} className="w-5 h-5 object-contain" alt="" /> : <span>🏅</span>}
                  <span className="text-xs text-white">{b.name}</span>
                  <span className="text-[10px] text-white/60">→ {p.username}</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => removeAssignment(a.id)} className="border-white/20 text-red-400"><Trash2 size={12} /></Button>
              </div>
            );
          })}
          {assignments.length === 0 && <p className="text-white/60 text-xs">No assignments</p>}
        </div>
      </div>
      <div className="space-y-2">
        {badges.map(b => (
          <div key={b.id} className="bg-panel rounded-xl border border-white/10 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {b.image_url ? <img src={b.image_url} className="w-6 h-6 object-contain" alt="" /> : <span>🏅</span>}
              <span className="font-display text-sm text-white">{b.name}</span>
              <span className="text-[10px] text-white/60">{b.type} {b.criteria_value && `• ${b.criteria_value}`}</span>
            </div>
            <Button size="sm" variant="outline" onClick={() => { setEditing(b.id); setForm(b); }} className="border-white/20 text-white"><Edit size={12} /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventsAdmin() {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({ name: '', description: '', start_date: '', end_date: '', is_active: true, banner_url: '', theme_colors: '' });
  const [editing, setEditing] = useState(null);

  useEffect(() => { loadEvents(); }, []);
  const loadEvents = () => base44.entities.GameEvent.list('-created_date').then(setEvents);

  const save = async () => {
    const data = { ...form };
    if (data.start_date) data.start_date = new Date(data.start_date).toISOString();
    if (data.end_date) data.end_date = new Date(data.end_date).toISOString();
    if (editing) { await base44.entities.GameEvent.update(editing, data); } else { await base44.entities.GameEvent.create(data); }
    setForm({ name: '', description: '', start_date: '', end_date: '', is_active: true, banner_url: '', theme_colors: '' });
    setEditing(null); loadEvents();
  };

  return (
    <div className="space-y-4">
      <div className="bg-panel rounded-xl border border-white/10 p-4">
        <h3 className="font-display text-[#a7fcc9] mb-3">{editing ? 'Edit Event' : 'Add Event'}</h3>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Event name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <ImageUpload label="Banner Image" value={form.banner_url} onChange={v => setForm({ ...form, banner_url: v })} />
          <Input type="datetime-local" placeholder="Start" value={form.start_date?.slice(0, 16) || ''} onChange={e => setForm({ ...form, start_date: e.target.value })} />
          <Input type="datetime-local" placeholder="End" value={form.end_date?.slice(0, 16) || ''} onChange={e => setForm({ ...form, end_date: e.target.value })} />
          <Input placeholder="Theme colors (e.g. #ff0000,#00ff00)" value={form.theme_colors} onChange={e => setForm({ ...form, theme_colors: e.target.value })} />
        </div>
        <Textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-2" rows={2} />
        <div className="flex items-center gap-2 mt-2"><Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} /><span className="text-xs text-white">Active</span></div>
        <Button onClick={save} className="mt-3" style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>{editing ? 'Update' : 'Add'}</Button>
        {editing && <Button variant="outline" onClick={() => { setEditing(null); setForm({ name: '', description: '', start_date: '', end_date: '', is_active: true, banner_url: '', theme_colors: '' }); }} className="ml-2 mt-3">Cancel</Button>}
      </div>
      <div className="space-y-2">
        {events.map(ev => (
          <div key={ev.id} className="bg-panel rounded-xl border border-white/10 p-3 flex items-center justify-between">
            <span className="font-display text-sm text-white">{ev.name} {!ev.is_active && <span className="text-red-400 text-[10px]">(inactive)</span>}</span>
            <Button size="sm" variant="outline" onClick={() => { setEditing(ev.id); setForm({ ...ev, start_date: ev.start_date?.slice(0, 16) || '', end_date: ev.end_date?.slice(0, 16) || '' }); }} className="border-white/20 text-white"><Edit size={12} /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function BazaarAdmin({ adminProfile }) {
  const [blooks, setBlooks] = useState([]);
  const [packs, setPacks] = useState([]);
  const [form, setForm] = useState({ name: '', image_url: '', rarity: 'uncommon', bazaar_event: true, is_active: true, drop_chance: 0, is_deleted: false });

  useEffect(() => { loadBlooks(); loadPacks(); }, []);
  const loadBlooks = () => base44.entities.Blook.filter({ bazaar_event: true }).then(bs => setBlooks(bs.filter(b => b.game !== 'pokemon')));
  const loadPacks = () => base44.entities.Pack.list('order').then(ps => setPacks(ps.filter(p => p.game !== 'pokemon')));

  const save = async () => {
    await base44.entities.Blook.create({ ...form, sell_price: SELL_PRICES[form.rarity] || 5 });
    setForm({ name: '', image_url: '', rarity: 'uncommon', bazaar_event: true, is_active: true, drop_chance: 0, is_deleted: false });
    loadBlooks();
  };

  const removeFromBazaar = async (b) => {
    if (isProtectedEventBlook(b) && adminProfile?.role !== 'owner') { alert('Only the owner can delete Spooky Month or PAC3 event blooks.'); return; }
    if (!confirm(`Remove ${b.name} from the bazaar?`)) return;
    await base44.entities.Blook.update(b.id, { bazaar_event: false });
    loadBlooks();
  };

  return (
    <div className="space-y-4">
      <div className="bg-panel rounded-xl border border-white/10 p-4">
        <h3 className="font-display text-[#a7fcc9] mb-3">Add Event Blook to Bazaar</h3>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <ImageUpload label="Blook Image" value={form.image_url} onChange={v => setForm({ ...form, image_url: v })} />
          <Select value={form.rarity} onValueChange={v => setForm({ ...form, rarity: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{RARITY_ORDER.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button onClick={save} className="mt-3" style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Add to Bazaar</Button>
      </div>
      <div>
        <h3 className="font-display text-[#a7fcc9] mb-2">Bazaar Blooks</h3>
        <div className="space-y-2">
          {blooks.map(b => (
            <div key={b.id} className="bg-panel rounded-xl border border-white/10 p-3 flex items-center gap-2">
              {b.image_url ? <img src={b.image_url} className="w-8 h-8 object-contain" alt="" /> : <img src={PLACEHOLDER_BLOOK_IMG} alt="" className="w-6 h-6 object-contain rounded" />}
              <span className={`font-display text-sm rarity-${b.rarity} flex-1`}>{b.name}</span>
              <Button size="sm" variant="outline" onClick={() => removeFromBazaar(b)} className="border-white/20 text-red-400"><Trash2 size={12} /></Button>
            </div>
          ))}
          {blooks.length === 0 && <p className="text-white/60 text-xs">No bazaar blooks</p>}
        </div>
      </div>
      <div>
        <h3 className="font-display text-[#a7fcc9] mb-2">Packs</h3>
        <div className="space-y-2">
          {packs.map(p => (
            <div key={p.id} className="bg-panel rounded-xl border border-white/10 p-3 flex items-center gap-2">
              {p.image_url ? <img src={p.image_url} className="w-8 h-8 object-contain" alt="" /> : <span>📦</span>}
              <span className="font-display text-sm text-white flex-1">{p.name}</span>
              {!p.is_active && <span className="text-[10px] text-amber-400">inactive</span>}
              {p.bazaar_only && <span className="text-[10px] text-[#a7fcc9]">bazaar-only</span>}
            </div>
          ))}
          {packs.length === 0 && <p className="text-white/60 text-xs">No packs</p>}
        </div>
      </div>
    </div>
  );
}

function SecurityAdmin({ adminProfile }) {
  const [regDisabled, setRegDisabled] = useState(false);
  const [bulkEnabled, setBulkEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.GameSettings.filter({ key: 'registration_disabled' }),
      base44.entities.GameSettings.filter({ key: 'bulk_open_enabled' })
    ]).then(([reg, bulk]) => {
      setRegDisabled(reg.length > 0 && reg[0].value === 'true');
      setBulkEnabled(bulk.length === 0 || bulk[0].value !== 'false');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const toggleSetting = async (key, current, setter) => {
    const next = !current;
    setSavingKey(key);
    try {
      const existing = await base44.entities.GameSettings.filter({ key });
      if (existing.length > 0) {
        await base44.entities.GameSettings.update(existing[0].id, { value: String(next) });
      } else {
        await base44.entities.GameSettings.create({ key, value: String(next), category: 'general' });
      }
      setter(next);
    } catch (e) { alert('Failed: ' + e.message); }
    setSavingKey(null);
  };

  if (loading) return <p className="text-white/60 text-xs">Loading...</p>;

  return (
    <div className="space-y-4">
      <div className="bg-panel rounded-xl border border-white/10 p-4">
        <h3 className="font-display text-[#a7fcc9] mb-1">🔒 Registration Control</h3>
        <p className="text-xs text-white/60 mb-3">When disabled, no new accounts can be created — blocks both email/password and Google OAuth signups. Existing users are unaffected.</p>
        <div className="flex items-center gap-3">
          <Switch checked={regDisabled} onCheckedChange={() => toggleSetting('registration_disabled', regDisabled, setRegDisabled)} disabled={savingKey === 'registration_disabled'} />
          <span className={`text-sm font-display ${regDisabled ? 'text-red-400' : 'text-green-400'}`}>
            {savingKey === 'registration_disabled' ? 'Saving...' : regDisabled ? 'Registration DISABLED' : 'Registration Open'}
          </span>
        </div>
      </div>
      <div className="bg-panel rounded-xl border border-white/10 p-4">
        <h3 className="font-display text-[#a7fcc9] mb-1">📦 Bulk Pack Opening</h3>
        <p className="text-xs text-white/60 mb-3">When disabled, players can only open packs one at a time — the bulk open button and quantity controls are hidden on the Market.</p>
        <div className="flex items-center gap-3">
          <Switch checked={bulkEnabled} onCheckedChange={() => toggleSetting('bulk_open_enabled', bulkEnabled, setBulkEnabled)} disabled={savingKey === 'bulk_open_enabled'} />
          <span className={`text-sm font-display ${bulkEnabled ? 'text-green-400' : 'text-red-400'}`}>
            {savingKey === 'bulk_open_enabled' ? 'Saving...' : bulkEnabled ? 'Bulk Opening Enabled' : 'Bulk Opening DISABLED'}
          </span>
        </div>
      </div>
    </div>
  );
}

function SidebarAdmin() {
  const [hidden, setHidden] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => { getHiddenPages().then(h => { setHidden(h); setLoading(false); }).catch(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const toggle = async (path) => {
    setSaving(true);
    const next = hidden.includes(path) ? hidden.filter(p => p !== path) : [...hidden, path];
    setHidden(next);
    try { await setHiddenPages(next); } catch (e) { alert('Failed to update: ' + e.message); load(); }
    setSaving(false);
  };

  if (loading) return <p className="text-white/60 text-xs">Loading...</p>;

  return (
    <div className="space-y-4">
      <div className="bg-panel rounded-xl border border-white/10 p-4">
        <h3 className="font-display text-[#a7fcc9] mb-1">Sidebar Pages</h3>
        <p className="text-xs text-white/60 mb-3">Toggle which pages appear in the sidebar for all users. Hidden pages are still accessible via direct URL but won't show in the nav.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SIDEBAR_PAGES.map(page => {
            const isHidden = hidden.includes(page.path);
            return (
              <button
                key={page.path}
                onClick={() => toggle(page.path)}
                disabled={saving}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                  isHidden ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-[#a7fcc9]/10 border-[#a7fcc9]/40 text-white'
                }`}
              >
                <span className="font-display">{page.label}</span>
                <span className="text-[10px]">{isHidden ? 'Hidden' : 'Visible'}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BlookAppsAdmin() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.BlookApplication.filter({ status: 'pending' }, '-created_date', 200).then(a => { setApps(a); setLoading(false); }).catch(() => setLoading(false));
    const unsub = base44.entities.BlookApplication.subscribe(() => {
      base44.entities.BlookApplication.filter({ status: 'pending' }, '-created_date', 200).then(setApps).catch(() => {});
    });
    return unsub;
  }, []);

  const review = async (app, status) => {
    await base44.entities.BlookApplication.update(app.id, { status });
    setApps(prev => prev.filter(a => a.id !== app.id));
  };

  if (loading) return <p className="text-white/60 text-xs">Loading...</p>;

  return (
    <div className="space-y-2">
      <p className="text-xs text-white/60 mb-2">Community-submitted blook designs. Approve designs you want to turn into real blooks (add them manually in the Blooks tab), or reject ones that don't fit.</p>
      {apps.length === 0 && <p className="text-white/60 text-xs">No pending applications.</p>}
      {apps.map(app => (
        <div key={app.id} className="bg-panel rounded-xl border border-white/10 p-3 flex items-start gap-3">
          <img src={app.image_data} alt={app.blook_name} className="w-24 h-24 rounded-lg object-cover border border-white/10 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-display text-sm text-[#a7fcc9]">{app.blook_name}</p>
            <p className="text-[10px] text-white/50">by {app.username}</p>
            <p className="text-xs text-white/70 mt-1">{app.description}</p>
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={() => review(app, 'approved')} className="text-xs border-green-500/40 text-green-400">Approve</Button>
              <Button size="sm" variant="outline" onClick={() => review(app, 'rejected')} className="text-xs border-red-500/40 text-red-400">Reject</Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function UsernameChangesAdmin() {
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.UsernameChange.list('-created_date', 200).then(cs => setChanges(cs)).catch(() => {});
    setLoading(false);
  }, []);

  if (loading) return <p className="text-white/60 text-xs">Loading...</p>;

  return (
    <div className="space-y-2">
      <p className="text-xs text-white/60 mb-2">Username change history (newest first). Shows old → new for each change.</p>
      {changes.length === 0 && <p className="text-white/60 text-xs">No username changes recorded yet.</p>}
      {changes.map(c => (
        <div key={c.id} className="bg-panel rounded-xl border border-white/10 p-3 flex items-center gap-2">
          <span className="text-sm text-white">{c.old_username}</span>
          <span className="text-[#a7fcc9] font-display">→</span>
          <span className="text-sm text-[#a7fcc9] font-display">{c.new_username}</span>
          <span className="text-[10px] text-white/40 ml-auto">{c.created_date ? new Date(c.created_date).toLocaleString() : ''}</span>
        </div>
      ))}
      </div>
      );
      }

      function BiggiePanelManager() {
      const [biggieUsers, setBiggieUsers] = useState([]);
      const [loading, setLoading] = useState(true);

      useEffect(() => {
      base44.entities.PlayerProfile.filter({ role: 'biggie' }).then(users => {
      setBiggieUsers(users);
      setLoading(false);
      }).catch(() => setLoading(false));
      }, []);

      return (
      <div className="bg-panel rounded-xl border border-white/10 p-4">
      <h3 className="font-display text-[#a7fcc9] mb-1">🍔 Biggie Role Manager</h3>
      <p className="text-xs text-white/60 mb-3">Users with the Biggie role have access to the Biggie Panel. Promote or demote users from the Users tab using the role dropdown. phantom_grip always has access.</p>
      {loading ? (
      <p className="text-white/60 text-xs">Loading...</p>
      ) : biggieUsers.length > 0 ? (
      <div className="flex flex-wrap gap-2">
        {biggieUsers.map(u => (
          <div key={u.id} className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40">
            <span className="text-sm text-white">{u.username}</span>
          </div>
        ))}
      </div>
      ) : (
      <p className="text-white/60 text-xs">No users have the Biggie role yet. Promote someone from the Users tab.</p>
      )}
      </div>
      );
      }