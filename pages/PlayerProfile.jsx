import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ROLE_COLORS, ROLE_BADGES, ROLE_HIERARCHY, RARITY_ORDER } from '@/lib/constants';
import { getColorStyle } from '@/lib/colorStyle';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useGame } from '@/lib/gameContext';
import { ArrowLeft, Flag } from 'lucide-react';

export default function PlayerProfile() {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [playerBlooks, setPlayerBlooks] = useState([]);
  const [allBlooks, setAllBlooks] = useState([]);
  const [banner, setBanner] = useState(null);
  const [badges, setBadges] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportProof, setReportProof] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const navigate = useNavigate();
  const { profile: me } = useGame();

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const profiles = await base44.entities.PlayerProfile.filter({ user_id: userId });
      if (profiles.length === 0) { setLoading(false); return; }
      const p = profiles[0];
      setProfile(p);
      const [pb, ab, bg, asg] = await Promise.all([
        base44.entities.PlayerBlook.filter({ user_id: userId }),
        base44.entities.Blook.filter({}),
        base44.entities.Badge.filter({}, null, 200),
        base44.entities.PlayerBadge.filter({ user_id: userId })
      ]);
      setPlayerBlooks(pb);
      setAllBlooks(ab);
      setBadges(bg);
      setAssignments(asg);
      if (p.equipped_banner_id) {
        base44.entities.Banner.get(p.equipped_banner_id).then(setBanner).catch(() => {});
      }
      setLoading(false);
    })();
  }, [userId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-panel/30 border-t-panel rounded-full animate-spin" /></div>;
  if (!profile) return <div className="text-center py-12"><p className="text-white/60">Player not found</p><Button asChild variant="outline" className="mt-4 border-white/20 text-white"><Link to="/trade">Back</Link></Button></div>;

  const blookMap = {};
  allBlooks.forEach(b => { blookMap[b.id] = b; });
  const totalBlooks = playerBlooks.reduce((s, pb) => s + (pb.quantity || 1), 0);
  const uniqueBlooks = playerBlooks.length;
  const daysSinceJoin = profile.join_date ? Math.floor((Date.now() - new Date(profile.join_date).getTime()) / 86400000) : 0;
  const badgeMap = {};
  badges.forEach(b => { badgeMap[b.id] = b; });
  const customBadges = assignments.map(a => badgeMap[a.badge_id]).filter(Boolean);
  const playtimeBadges = badges.filter(b => b.type === 'playtime' && daysSinceJoin >= parseInt(b.criteria_value || '0'));
  const roleBadges = badges.filter(b => {
    if (b.type !== 'role') return false;
    if (b.criteria_value === profile.role) return true;
    // Staff badge shows for all staff roles (moderator and above)
    if (b.name === 'Staff' && ROLE_HIERARCHY[profile.role] >= ROLE_HIERARCHY.moderator) return true;
    return false;
  });

  const ownedBlooksByRarity = {};
  RARITY_ORDER.forEach(r => { ownedBlooksByRarity[r] = []; });
  playerBlooks.forEach(pb => {
    const b = blookMap[pb.blook_id];
    if (b) ownedBlooksByRarity[b.rarity]?.push({ ...b, quantity: pb.quantity });
  });

  const startTrade = async () => {
    if (!me || me.user_id === userId) return;
    const room = await base44.entities.TradeRoom.create({
      player_a_id: me.user_id, player_a_username: me.username, player_a_avatar: me.avatar_url,
      player_b_id: userId, player_b_username: profile.username, player_b_avatar: profile.avatar_url,
      status: 'pending', a_blooks: '[]', b_blooks: '[]', a_tokens: 0, b_tokens: 0, game: 'icecreamet'
    });
    await base44.entities.Notification.create({ user_id: userId, type: 'trade_received', title: 'Trade Request', message: `${me.username} wants to trade!`, link: `/trade/room/${room.id}` });
    navigate(`/trade/room/${room.id}`);
  };

  const submitReport = async () => {
    if (!me || !reportReason.trim()) return;
    setReportSubmitting(true);
    try {
      await base44.entities.Report.create({
        target_user_id: userId,
        target_username: profile.username,
        reporter_id: me.user_id,
        reporter_username: me.username,
        reason: reportReason.trim(),
        proof: reportProof.trim(),
        status: 'pending'
      });
      setReportOpen(false);
      setReportReason('');
      setReportProof('');
      alert('Report submitted. A moderator will review it.');
    } catch (e) {
      alert('Failed to submit report: ' + (e.message || 'unknown'));
    } finally {
      setReportSubmitting(false);
    }
  };

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 text-[#a7fcc9] hover:text-white">
        <Link to="/stats"><ArrowLeft size={14} className="mr-1" /> Back</Link>
      </Button>

      {banner && (
        <div className="w-full h-32 rounded-2xl overflow-hidden mb-4 border border-white/10">
          <img src={banner.image_url} alt={banner.name} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="bg-panel rounded-2xl border border-white/10 p-6 mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 avatar-rounded-square bg-white/10 overflow-hidden flex-shrink-0">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl text-white">{profile.username?.[0]?.toUpperCase()}</div>
              )}
            </div>
            <div>
              {(() => {
                const ns = getColorStyle(profile.name_color, ROLE_HIERARCHY[profile.role] >= ROLE_HIERARCHY.admin);
                const hasStyle = ns.className || Object.keys(ns.style || {}).length > 0;
                return (
                  <h3 className={`text-xl font-display ${ns.className}`} style={hasStyle ? ns.style : { color: ROLE_COLORS[profile.role] }}>
                    {ROLE_BADGES[profile.role]} {profile.username}
                  </h3>
                );
              })()}
              <p className="text-sm text-white/70 capitalize">{profile.role}</p>
              <div className="flex gap-1 mt-1">
                {[...roleBadges, ...playtimeBadges, ...customBadges].map(b => {
                  const tierClass = b.name === 'Void Collector' ? 'collector-badge-void'
                    : b.name === 'Rainbow Collector' ? 'collector-badge-rainbow'
                    : b.name === 'Diamond Collector' ? 'collector-badge-diamond'
                    : b.name === 'Golden Collector' ? 'collector-badge-golden'
                    : b.name === 'Collector' ? 'collector-badge-base' : '';
                  return (
                    <div key={b.id} className="w-6 h-6 rounded" title={b.name}>
                      {b.image_url ? <img src={b.image_url} alt={b.name} className={`w-full h-full object-contain ${tierClass}`} /> : <span className="text-xs">🏅</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {me && me.user_id !== userId && (
            <div className="flex gap-2">
              <Button onClick={startTrade} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Trade</Button>
              <Button onClick={() => setReportOpen(true)} variant="outline" className="border-red-500/40 text-red-400"><Flag size={14} className="mr-1" />Report</Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Tokens', value: profile.tokens?.toLocaleString() || '0', icon: '🪙' },
          { label: 'Packs Opened', value: profile.total_packs_opened || 0, icon: '📦' },
          { label: 'Total Blooks', value: totalBlooks, icon: '🧊' },
          { label: 'Unique Blooks', value: uniqueBlooks, icon: '⭐' },
        ].map(stat => (
          <div key={stat.label} className="bg-panel rounded-xl border border-white/10 p-4 text-center">
            <span className="text-2xl">{stat.icon}</span>
            <p className="text-xl font-display text-[#a7fcc9] mt-1">{stat.value}</p>
            <p className="text-xs text-white/60">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-panel rounded-2xl border border-white/10 p-6">
        <h3 className="font-display text-[#a7fcc9] mb-3">Collection</h3>
        {RARITY_ORDER.map(r => {
          if (!ownedBlooksByRarity[r] || ownedBlooksByRarity[r].length === 0) return null;
          return (
            <div key={r} className="mb-4">
              <h4 className={`font-display capitalize mb-2 text-sm rarity-${r}`}>{r}</h4>
              <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2">
                {ownedBlooksByRarity[r].map(blook => (
                  <div key={blook.id} className="bg-white/5 rounded-xl p-2 text-center">
                    <div className="w-12 h-12 mx-auto mb-1 flex items-center justify-center">
                      {blook.image_url ? <img src={blook.image_url} alt={blook.name} className="w-full h-full object-contain" /> : <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/0d5e6b887_image.png" alt="" className="w-8 h-8 object-contain" />}
                    </div>
                    <p className={`text-[10px] font-display truncate rarity-${blook.rarity}`}>{blook.name}</p>
                    {blook.quantity > 1 && <p className="text-[10px] text-white/60">x{blook.quantity}</p>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {playerBlooks.length === 0 && <p className="text-center text-white/60 text-sm">No blooks yet</p>}
      </div>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Report {profile.username}</DialogTitle></DialogHeader>
          <p className="text-xs text-white/60">Report this player for hacking, cheating, or breaking rules. A moderator will review your report.</p>
          <Textarea placeholder="Reason (required) — describe what they did" value={reportReason} onChange={e => setReportReason(e.target.value)} rows={3} className="bg-white/10 border-white/20 text-white" />
          <Textarea placeholder="Proof (optional) — links, screenshots, etc." value={reportProof} onChange={e => setReportProof(e.target.value)} rows={2} className="bg-white/10 border-white/20 text-white" />
          <Button onClick={submitReport} disabled={!reportReason.trim() || reportSubmitting} style={{ backgroundColor: '#ef4444', color: '#fff' }}>
            {reportSubmitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}