import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { ROLE_HIERARCHY, VERIFIED_BADGE_ID } from '@/lib/constants';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Shield, Search, VolumeX, Volume2, ShieldAlert, BadgeCheck } from 'lucide-react';
import { adminUpdateProfile } from '@/lib/adminAction';
import ReportsAdmin from '@/components/game/ReportsAdmin';

const isProtected = (p) => (p?.username || '').toLowerCase() === 'icecreamy';
const canModerate = (viewer, target) => {
  if (!target || isProtected(target)) return false;
  const v = ROLE_HIERARCHY[viewer?.role] || 0;
  if (v >= ROLE_HIERARCHY.owner) return true;
  return (ROLE_HIERARCHY[target.role] || 0) < v;
};

export default function ModPanel() {
  const { profile } = useGame();
  const { toast } = useToast();
  const viewerRank = ROLE_HIERARCHY[profile?.role] || 0;
  // Helpers and everyone above them access the panel.
  const isStaff = viewerRank >= ROLE_HIERARCHY.helper;
  const isMod = viewerRank >= ROLE_HIERARCHY.moderator;
  const [players, setPlayers] = useState([]);
  const [playerBadges, setPlayerBadges] = useState([]);
  const [search, setSearch] = useState('');
  const [banDialogPlayer, setBanDialogPlayer] = useState(null);
  const [banReason, setBanReason] = useState('');
  const [banProof, setBanProof] = useState('');

  const loadAll = async () => {
    try {
      const [ps, roles, pbs] = await Promise.all([
        base44.entities.PlayerProfile.list({ sort: '-last_seen', limit: 1000 }),
        base44.entities.PlayerRole.list({ limit: 2000 }),
        base44.entities.PlayerBadge.list({ limit: 2000 })
      ]);
      const roleMap = {};
      (roles.items || roles).forEach(r => { roleMap[r.user_id] = r.role; });
      const badges = pbs.items || pbs;
      setPlayers((ps.items || ps).map(p => ({ ...p, role: roleMap[p.user_id] || p.role || 'player' })));
      setPlayerBadges(badges);
    } catch (e) {
      toast({ title: 'Failed to load players', description: e.message || 'service unavailable', variant: 'destructive' });
    }
  };
  useEffect(() => { if (isStaff) loadAll(); }, [isStaff]);

  const hasVerified = (userId) => playerBadges.some(pb => pb.user_id === userId && pb.badge_id === VERIFIED_BADGE_ID);

  const toggleMute = async (player) => {
    if (!canModerate(profile, player)) return;
    const muted = !player.is_muted;
    try {
      await adminUpdateProfile(profile, player, { is_muted: muted, mute_until: muted ? new Date(Date.now() + 3600000).toISOString() : null });
      toast({ title: `${player.username} ${muted ? 'muted' : 'unmuted'}` });
    } catch (e) { toast({ title: 'Failed', description: e.message || 'service unavailable', variant: 'destructive' }); }
    loadAll();
  };

  const giveVerified = async (player) => {
    if (!canModerate(profile, player)) return;
    if (hasVerified(player.user_id)) { toast({ title: `${player.username} is already verified.` }); return; }
    try {
      await base44.entities.PlayerBadge.create({ user_id: player.user_id, badge_id: VERIFIED_BADGE_ID });
      toast({ title: `${player.username} is now verified!` });
    } catch (e) { toast({ title: 'Failed', description: e.message || 'unknown', variant: 'destructive' }); }
    loadAll();
  };

  const submitBanRequest = async () => {
    if (!banDialogPlayer || !banReason.trim()) return;
    try {
      if (isMod) {
        // Moderators+ ban directly
        await adminUpdateProfile(profile, banDialogPlayer, { is_banned: true, ban_reason: banReason.trim(), banned_by: profile.username });
        setBanDialogPlayer(null); setBanReason(''); setBanProof('');
        toast({ title: `${banDialogPlayer.username} has been banned` });
      } else {
        // Helpers submit ban requests for owner review
        await base44.entities.BanRequest.create({
          target_user_id: banDialogPlayer.user_id,
          target_username: banDialogPlayer.username,
          requester_id: profile.user_id,
          requester_username: profile.username,
          reason: banReason.trim(),
          proof: banProof.trim(),
          status: 'pending'
        });
        setBanDialogPlayer(null); setBanReason(''); setBanProof('');
        toast({ title: 'Ban request submitted', description: 'The owner will review it.' });
      }
    } catch (e) {
      toast({ title: 'Failed', description: e.message || 'service unavailable', variant: 'destructive' });
    }
    loadAll();
  };

  if (!isStaff) return <div className="text-center py-12"><p className="text-muted-foreground">Access denied</p></div>;

  const filtered = players.filter(p => p.username?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <h2 className="text-2xl font-display text-[#a7fcc9] mb-4 flex items-center gap-2"><Shield size={20} /> Moderator Panel</h2>
      <div className="mb-6">
        <ReportsAdmin adminProfile={profile} />
      </div>
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className="bg-panel rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white">👥 {players.length} players</span>
      </div>
      <div className="flex items-center gap-2 mb-3 max-w-sm">
        <Search size={16} className="text-white/40" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="bg-white/10 border-white/20 text-white placeholder:text-white/40" />
      </div>
      <div className="space-y-2">
        {filtered.map(player => {
          const moderatable = canModerate(profile, player);
          return (
            <div key={player.id} className="bg-panel rounded-xl border border-white/10 p-3 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 avatar-rounded-square bg-white/10 overflow-hidden">
                  {player.avatar_url ? <img src={player.avatar_url} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-xs text-white">{player.username?.[0]?.toUpperCase()}</div>}
                </div>
                <div>
                  <span className="font-display text-sm text-white flex items-center gap-1">{player.username}{hasVerified(player.user_id) && <BadgeCheck size={14} className="text-blue-400" />}</span>
                  <span className="text-[10px] text-white/60 ml-1 capitalize">{player.role}</span>
                  {player.is_muted && <span className="text-[10px] text-red-400 ml-1">MUTED</span>}
                  {player.is_banned && <span className="text-[10px] text-red-400 ml-1">BANNED</span>}
                </div>
              </div>
              <div className="flex gap-1 items-center flex-wrap">
                {moderatable && (
                  <Button size="sm" variant="outline" onClick={() => toggleMute(player)} className="text-xs border-white/20 text-white">
                    {player.is_muted ? <><Volume2 size={12} className="mr-1" />Unmute</> : <><VolumeX size={12} className="mr-1" />Mute</>}
                  </Button>
                )}
                {moderatable && isMod && (
                  <Button size="sm" variant="outline" onClick={() => giveVerified(player)} disabled={hasVerified(player.user_id)} className="text-xs border-blue-500/40 text-blue-400">
                    <BadgeCheck size={12} className="mr-1" />{hasVerified(player.user_id) ? 'Verified' : 'Verify'}
                  </Button>
                )}
                {moderatable && (
                  <Button size="sm" variant="outline" onClick={() => { setBanDialogPlayer(player); setBanReason(''); setBanProof(''); }} className="text-xs border-red-500/40 text-red-400">
                    <ShieldAlert size={12} className="mr-1" />{isMod ? 'Ban' : 'Ban Request'}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <Dialog open={!!banDialogPlayer} onOpenChange={v => !v && setBanDialogPlayer(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{isMod ? 'Ban' : 'Request ban for'} {banDialogPlayer?.username}</DialogTitle></DialogHeader>
          <p className="text-xs text-white/60">{isMod ? 'Provide a reason for this ban. The user will be banned immediately.' : 'Provide a reason and proof. The owner will review and approve or reject. The user will not be banned until the owner accepts.'}</p>
          <Textarea placeholder="Reason (required)" value={banReason} onChange={e => setBanReason(e.target.value)} rows={2} className="bg-white/10 border-white/20 text-white" />
          <Textarea placeholder="Proof (optional)" value={banProof} onChange={e => setBanProof(e.target.value)} rows={2} className="bg-white/10 border-white/20 text-white" />
          <Button onClick={submitBanRequest} disabled={!banReason.trim()} style={{ backgroundColor: '#ef4444', color: '#fff' }}>{isMod ? 'Ban User' : 'Submit Ban Request'}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}