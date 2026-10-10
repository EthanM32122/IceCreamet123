import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { getAllPlayers } from '@/lib/playersCache';
import { getAllBlooks, getBadges, getPacks } from '@/lib/gameDataCache';
import { useGame } from '@/lib/gameContext';
import { ROLE_COLORS, MEGA_CHARIZARD_BLOOK_ID, MEGA_DARKRAI_BLOOK_ID, PLACEHOLDER_BLOOK_IMG } from '@/lib/constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SpinWheel from '@/components/game/SpinWheel';
import DiamondPanel from '@/components/game/DiamondPanel';
import AdminCodes from '@/components/game/AdminCodes';
import { TokenIcon, DiamondIcon } from '@/components/game/CurrencyIcon';
import LockerLeftPane from '@/components/stats/LockerLeftPane';
import LockerRightPane from '@/components/stats/LockerRightPane';
import DailyStreak from '@/components/game/DailyStreak';
import UpdateCatalog from '@/components/game/UpdateCatalog';

const ICECREAMET_LOGO = 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/2724130c5_file_00000000f0cc81f689edd7e643506d5b-removebg-preview.png';
import { totalXpToLevel } from '@/lib/leveling';
import { getColorStyle } from '@/lib/colorStyle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Stats() {
  const { profile, updateProfile } = useGame();
  const [playerBlooks, setPlayerBlooks] = useState([]);
  const [allBlooks, setAllBlooks] = useState([]);
  const [obtainableBlookIds, setObtainableBlookIds] = useState(new Set());
  const [banner, setBanner] = useState(null);
  const [badges, setBadges] = useState([]);
  const [friends, setFriends] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [playerSearch, setPlayerSearch] = useState('');
  const [showBrowse, setShowBrowse] = useState(false);
  const [showWheel, setShowWheel] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showShinyAvatarPicker, setShowShinyAvatarPicker] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [clan, setClan] = useState(null);
  const [blookSeed] = useState(() => Math.random());
  const [shinyRoll] = useState(() => Math.random() < 0.0005);
  const [claimedShiny, setClaimedShiny] = useState(false);
  const [showCodes, setShowCodes] = useState(false);
  const [customBlooks, setCustomBlooks] = useState([]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [pb, ab, abPokemon] = await Promise.all([
        base44.entities.PlayerBlook.filter({ user_id: profile.user_id }).catch(() => []),
        getAllBlooks('icecreamet').catch(() => []),
        getAllBlooks('pokemon').catch(() => [])
      ]);
      const [bg, allFr, packs] = await Promise.all([
        getBadges().catch(() => []),
        base44.entities.FriendRequest.filter({ $or: [{ from_user_id: profile.user_id }, { to_user_id: profile.user_id }] }).catch(() => []),
        getPacks('icecreamet').catch(() => [])
      ]);
      const frs = allFr.filter(fr => fr.status === 'accepted');
      const pending = allFr.filter(fr => fr.status === 'pending' && fr.to_user_id === profile.user_id);
      // Merge pokemon blooks (PAC3 event prizes) so owned ones can be used as avatars.
      let allBlooksList = [...ab, ...(abPokemon || [])];
      for (const rewardId of [MEGA_CHARIZARD_BLOOK_ID, MEGA_DARKRAI_BLOOK_ID]) {
        if (pb.some(p => p.blook_id === rewardId) && !allBlooksList.find(b => b.id === rewardId)) {
          try {
            const rb = await base44.entities.Blook.get(rewardId);
            if (rb) allBlooksList = [...allBlooksList, rb];
          } catch {}
        }
      }
      setPlayerBlooks(pb);
      setAllBlooks(allBlooksList);
      const activePackIds = new Set(packs.filter(p => p.is_active && !p.bazaar_only).map(p => p.id));
      const obt = new Set(allBlooksList.filter(b => b.is_active !== false && (b.bazaar_event || (b.pack_id && activePackIds.has(b.pack_id)))).map(b => b.id));
      if (pb.some(p => p.blook_id === MEGA_CHARIZARD_BLOOK_ID)) obt.add(MEGA_CHARIZARD_BLOOK_ID);
      if (pb.some(p => p.blook_id === MEGA_DARKRAI_BLOOK_ID)) obt.add(MEGA_DARKRAI_BLOOK_ID);
      setObtainableBlookIds(obt);
      setBadges(bg);
      setPendingRequests(pending.length);
      const friendIds = frs
        .filter(fr => fr.from_user_id === profile.user_id || fr.to_user_id === profile.user_id)
        .map(fr => fr.from_user_id === profile.user_id ? fr.to_user_id : fr.from_user_id);
      if (friendIds.length > 0) {
        try {
          const friendProfiles = await base44.entities.PlayerProfile.filter({ user_id: { $in: friendIds } });
          setFriends(friendProfiles);
        } catch {}
      }
      base44.entities.ClanMember.filter({ user_id: profile.user_id }).then(async (mem) => {
        if (!mem[0]) { setClan(null); return; }
        try {
          const c = await base44.entities.Clan.get(mem[0].clan_id);
          const members = await base44.entities.ClanMember.filter({ clan_id: c.id });
          setClan({ ...c, memberCount: members.length, online: 0, offline: members.length });
        } catch {}
      }).catch(() => {});
    })();
    if (profile.equipped_banner_id) {
      base44.entities.Banner.get(profile.equipped_banner_id).then(setBanner).catch(() => {});
    }
    base44.entities.BlookApplication.filter({ user_id: profile.user_id }, '-created_date', 6).then(setCustomBlooks).catch(() => {});
  }, [profile?.user_id, profile?.equipped_banner_id]);

  useEffect(() => {
    if (!profile?.user_id) return;
    return base44.entities.PlayerBlook.subscribe(event => {
      if (event.type === 'delete') {
        setPlayerBlooks(prev => prev.some(row => row.id === event.id) ? prev.filter(row => row.id !== event.id) : prev);
      } else if (event.data?.user_id === profile.user_id) {
        setPlayerBlooks(prev => {
          const existing = prev.find(row => row.id === event.id);
          const row = { ...existing, ...event.data, id: event.id };
          return existing ? prev.map(item => item.id === event.id ? row : item) : [...prev, row];
        });
      }
    });
  }, [profile?.user_id]);

  useEffect(() => {
    if (showBrowse && allPlayers.length === 0) {
      getAllPlayers().then(setAllPlayers).catch(() => {});
    }
  }, [showBrowse]);

  const handleSpin = async (reward) => {
    if (!profile) return;
    await updateProfile({ tokens: (profile.tokens || 0) + reward, last_spin_time: new Date().toISOString() });
  };

  const isProfileLocked = !!profile?.profile_locked;

  const pickBlookAvatar = async (blook) => {
    if (!profile || isProfileLocked) return;
    await updateProfile({ avatar_url: blook.image_url, shiny_avatar: false });
    setShowAvatarPicker(false);
  };

  const pickShinyAvatar = async (blook) => {
    if (!profile || isProfileLocked) return;
    await updateProfile({ avatar_url: blook.image_url, shiny_avatar: true });
    setShowShinyAvatarPicker(false);
  };

  if (!profile) return null;

  const blookMap = {};
  allBlooks.forEach(b => { blookMap[b.id] = b; });
  const ownedBlooks = playerBlooks.map(pb => blookMap[pb.blook_id]).filter(b => b && b.image_url && obtainableBlookIds.has(b.id));
  const ownedForAvatar = playerBlooks.map(pb => blookMap[pb.blook_id]).filter(b => b && b.image_url);
  const shinyForAvatar = playerBlooks.filter(pb => (pb.shiny_quantity || 0) > 0).map(pb => blookMap[pb.blook_id]).filter(b => b && b.image_url);
  const uniqueBlooks = ownedBlooks.length;
  const totalBlooksAvailable = obtainableBlookIds.size;
  const shinyUnlocked = playerBlooks.filter(pb => (pb.shiny_quantity || 0) > 0).length;
  const randomBlookPool = ownedBlooks.length > 0 ? ownedBlooks : ownedForAvatar;
  const randomBlook = randomBlookPool.length > 0 ? randomBlookPool[Math.floor(blookSeed * randomBlookPool.length)] : null;
  const randomBlookIsShiny = shinyRoll && !!randomBlook && !claimedShiny;
  const claimShinyBlook = async () => {
    if (!randomBlook || claimedShiny) return;
    setClaimedShiny(true);
    try {
      const existing = playerBlooks.find(pb => pb.blook_id === randomBlook.id);
      if (existing) {
        await base44.entities.PlayerBlook.update(existing.id, { shiny_quantity: (existing.shiny_quantity || 0) + 1 });
      } else {
        const created = await base44.entities.PlayerBlook.create({ user_id: profile.user_id, blook_id: randomBlook.id, quantity: 0, shiny_quantity: 1, game: 'icecreamet' });
        setPlayerBlooks(prev => prev.some(row => row.id === created.id) ? prev : [...prev, created]);
      }
    } catch {}
  };
  const randomBlookIcon = randomBlook?.image_url
    ? <img src={randomBlook.image_url} alt={randomBlook.name || 'Blook'} className={`inline-block object-contain align-middle ${randomBlookIsShiny ? 'shiny-blook' : ''}`} style={{ width: 24, height: 24 }} />
    : <img src={PLACEHOLDER_BLOOK_IMG} alt="" className="inline-block object-contain align-middle rounded" style={{ width: 24, height: 24 }} />;
  const stats = [
    { label: 'Tokens', value: profile.tokens?.toLocaleString() || '0', icon: <TokenIcon size={24} />, color: '#f1c40f' },
    { label: 'Diamonds', value: (profile.diamonds || 0).toLocaleString(), icon: <DiamondIcon size={24} />, color: '#22d3ee' },
    { label: randomBlookIsShiny ? '✨ Shiny! Click to claim' : 'Blooks Unlocked', value: `${uniqueBlooks} / ${totalBlooksAvailable}`, icon: randomBlookIcon, color: '#60a5fa', onClick: randomBlookIsShiny ? claimShinyBlook : null, shiny: randomBlookIsShiny },
    { label: 'Packs Opened', value: (profile.total_packs_opened || 0).toLocaleString(), icon: <img src={ICECREAMET_LOGO} alt="ICECREAMET" className="inline-block object-contain align-middle" style={{ width: 24, height: 24 }} />, color: '#f59e0b' },
    { label: 'Messages Sent', value: (profile.messages_sent || 0).toLocaleString(), icon: '💬', color: '#a855f7' },
    { label: 'Shinies Unlocked', value: shinyUnlocked.toLocaleString(), icon: '✨', color: '#f1c40f' },
  ];

  const filteredPlayers = allPlayers.filter(p =>
    p.user_id !== profile.user_id && p.username?.toLowerCase().includes(playerSearch.toLowerCase())
  );

  return (
    <div className="relative">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-3xl font-display text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">Locker</h2>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => setShowWheel(true)} style={{ backgroundColor: '#f1c40f', color: '#3f68a5' }} className="font-display flex items-center gap-1"><TokenIcon size={16} /> Wheel</Button>
          <Button size="sm" onClick={() => setShowBrowse(!showBrowse)} style={{ backgroundColor: '#f44336', color: '#fff' }}>Browse</Button>
          <Button size="sm" asChild style={{ backgroundColor: '#4caf50', color: '#fff' }}><Link to="/trade">Trade</Link></Button>
          <Button size="sm" asChild style={{ backgroundColor: '#9c27b0', color: '#fff' }}><Link to="/giveaways">Giveaways</Link></Button>
          <Button size="sm" onClick={() => setShowCodes(!showCodes)} style={{ backgroundColor: '#e67e22', color: '#fff' }}>Codes</Button>
          <Button size="sm" asChild className="font-display flex items-center gap-1" style={{ backgroundColor: '#f97316', color: '#fff' }}>
            <Link to="/spooky-event"><span className="text-sm">🎃</span> Spooky Event</Link>
          </Button>
          <Button size="sm" asChild className="font-display flex items-center gap-1" style={{ backgroundColor: '#f97316', color: '#fff' }}>
            <Link to="/spooky-event"><span className="text-sm">🎃</span> Spooky Event</Link>
          </Button>
        </div>
      </div>

      {/* Two-pane locker layout */}
      <div className="flex flex-col lg:flex-row gap-4">
        <LockerLeftPane
          profile={profile}
          banner={banner}
          ownedBlooks={ownedBlooks}
          badges={badges}
          customBlooks={customBlooks}
          isProfileLocked={isProfileLocked}
          onAvatarClick={() => !isProfileLocked && setShowAvatarPicker(true)}
          onShinyAvatarClick={() => !isProfileLocked && setShowShinyAvatarPicker(true)}
        />
        <LockerRightPane
          stats={stats}
          ownedBlooks={ownedForAvatar}
          friends={friends}
          pendingRequests={pendingRequests}
        />
      </div>

      <div className="mt-4">
        <DailyStreak />
      </div>

      {/* Diamond panel */}
      <div className="mt-4">
        <DiamondPanel />
      </div>

      <div className="mt-4">
        <UpdateCatalog />
      </div>

      {showCodes && (
        <div className="mt-4">
          <AdminCodes />
        </div>
      )}

      {showBrowse && (
        <div className="mt-4 bg-panel rounded-2xl border border-white/10 p-4">
          <h3 className="font-display text-[#a7fcc9] mb-2">Browse Players</h3>
          <Input value={playerSearch} onChange={e => setPlayerSearch(e.target.value)} placeholder="Search players..." className="mb-3 bg-white/10 border-white/20 text-white placeholder:text-white/40" />
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 max-h-64 overflow-y-auto">
            {filteredPlayers.slice(0, 30).map(p => (
              <Link key={p.id} to={`/player/${p.user_id}`} className="bg-white/10 rounded-lg p-2 text-center hover:bg-white/20 transition-colors">
                <div className="w-10 h-10 avatar-rounded-square bg-white/10 overflow-hidden mx-auto mb-1">
                  {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-contain" /> : <div className="w-full h-full flex items-center justify-center text-xs text-white">{p.username?.[0]?.toUpperCase()}</div>}
                </div>
                <p className="text-xs text-white truncate">{p.username}</p>
                <p className="text-[10px] capitalize" style={{ color: ROLE_COLORS[p.role] }}>{p.role}</p>
              </Link>
            ))}
            {filteredPlayers.length === 0 && <p className="col-span-full text-white/60 text-sm text-center py-4">No players found</p>}
          </div>
        </div>
      )}

      {/* Floating clan widget */}
      {clan && (
        <div className="fixed bottom-4 right-4 z-30 w-64 bg-black/70 backdrop-blur-md border border-white/15 rounded-xl p-3 shadow-2xl hidden sm:block">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{clan.icon || '🛡️'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-display text-white truncate">{clan.name}</p>
              <p className="text-[10px] text-white/60">Level {clan.level || 1}</p>
            </div>
          </div>
          {clan.description && <p className="text-[11px] text-white/70 mb-2 line-clamp-2">{clan.description}</p>}
          <div className="flex items-center justify-between text-[10px] text-white/60">
            <span>{clan.memberCount} Member{clan.memberCount !== 1 ? 's' : ''}</span>
            <span className="flex items-center gap-2">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />{clan.online}</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-400" />{clan.offline}</span>
            </span>
          </div>
          <Link to="/clans" className="block text-center text-[10px] text-[#a7fcc9] hover:underline mt-2">View Clan</Link>
        </div>
      )}

      <Dialog open={showWheel} onOpenChange={setShowWheel}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Daily Token Wheel</DialogTitle></DialogHeader>
          <SpinWheel profile={profile} onSpin={handleSpin} />
        </DialogContent>
      </Dialog>

      <Dialog open={showAvatarPicker} onOpenChange={setShowAvatarPicker}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Choose your profile picture</DialogTitle></DialogHeader>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {ownedForAvatar.map(b => (
              <button key={b.id} onClick={() => pickBlookAvatar(b)} className={`rounded-lg border-2 p-1 hover:scale-105 transition-transform ${profile.avatar_url === b.image_url ? 'border-[#a7fcc9] bg-[#a7fcc9]/20' : 'border-white/10'}`}>
                <img src={b.image_url} alt={b.name} className="w-full aspect-square object-contain" />
              </button>
            ))}
            {ownedForAvatar.length === 0 && <p className="col-span-full text-white/60 text-sm text-center py-4">Open packs to collect blooks!</p>}
          </div>
          {profile.avatar_url && <Button variant="outline" size="sm" className="mt-3 w-full border-white/20 text-white" onClick={async () => { await updateProfile({ avatar_url: '', shiny_avatar: false }); setShowAvatarPicker(false); }}>Reset to default</Button>}
        </DialogContent>
      </Dialog>

      <Dialog open={showShinyAvatarPicker} onOpenChange={setShowShinyAvatarPicker}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>✨ Choose your shiny profile picture</DialogTitle></DialogHeader>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {shinyForAvatar.map(b => (
              <button key={b.id} onClick={() => pickShinyAvatar(b)} className={`rounded-lg border-2 p-1 hover:scale-105 transition-transform ${profile.avatar_url === b.image_url && profile.shiny_avatar ? 'border-yellow-400 bg-yellow-400/20' : 'border-yellow-400/30'}`}>
                <img src={b.image_url} alt={b.name} className="w-full aspect-square object-contain shiny-blook" />
              </button>
            ))}
            {shinyForAvatar.length === 0 && <p className="col-span-full text-white/60 text-sm text-center py-4">No shiny blooks yet! Open packs to find ✨ shinies.</p>}
          </div>
          {profile.shiny_avatar && <Button variant="outline" size="sm" className="mt-3 w-full border-yellow-400/40 text-yellow-300" onClick={async () => { await updateProfile({ shiny_avatar: false }); setShowShinyAvatarPicker(false); }}>Remove shiny effect</Button>}
        </DialogContent>
      </Dialog>
    </div>
  );
}