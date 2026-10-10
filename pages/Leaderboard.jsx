import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllPlayers } from '@/lib/playersCache';
import { useGame } from '@/lib/gameContext';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { DiamondIcon, TokenIcon } from '@/components/game/CurrencyIcon';
import { getColorStyle } from '@/lib/colorStyle';
import { ROLE_HIERARCHY } from '@/lib/constants';
import { Crown } from 'lucide-react';

const ACCENT = { backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' };
const PODIUM = ['#fbbf24', '#94a3b8', '#cd7f32']; // gold, silver, bronze

export default function Leaderboard() {
  const { profile } = useGame();
  const [players, setPlayers] = useState([]);
  const [clanByUser, setClanByUser] = useState({});
  const [tab, setTab] = useState('tokens');

  useEffect(() => {
    getAllPlayers().then(setPlayers).catch(() => {});
    (async () => {
      const [members, clans] = await Promise.all([
        base44.entities.ClanMember.filter({}),
        base44.entities.Clan.filter({})
      ]);
      const clanMap = {};
      clans.forEach(c => { clanMap[c.id] = c; });
      const byUser = {};
      members.forEach(m => { byUser[m.user_id] = clanMap[m.clan_id]; });
      setClanByUser(byUser);
    })();
  }, []);

  const valueFor = (p) => tab === 'xp' ? (p.xp || 0) : tab === 'diamonds' ? (p.diamonds || 0) : (p.tokens || 0);
  const iconFor = tab === 'diamonds' ? <DiamondIcon size={16} /> : <TokenIcon size={16} />;
  const fullSorted = [...players].filter(p => !p.is_banned).sort((a, b) => valueFor(b) - valueFor(a));
  const top3 = fullSorted.slice(0, 3);
  const rest = fullSorted.slice(3, 10);

  const myRank = profile ? fullSorted.findIndex(p => p.user_id === profile.user_id) + 1 : 0;
  const me = profile ? fullSorted.find(p => p.user_id === profile.user_id) : null;
  const showMyRow = me && myRank > 10;

  const nameStyle = (p) => {
    const cs = getColorStyle(p.name_color, ROLE_HIERARCHY[p.role] >= ROLE_HIERARCHY.admin);
    const has = cs.className || Object.keys(cs.style || {}).length > 0;
    return has ? { className: cs.className, style: cs.style } : { className: '', style: { color: '#fff' } };
  };

  const PodiumSlot = ({ p, rank, height }) => {
    if (!p) return <div style={{ width: '96px' }} />;
    const clan = clanByUser[p.user_id];
    const isRainbow = (clan?.color || '').toLowerCase() === 'rainbow';
    const ns = nameStyle(p);
    return (
      <div className="flex flex-col items-center" style={{ minWidth: '80px' }}>
        {rank === 1 && <Crown className="text-yellow-400 mb-1" size={28} fill="#fbbf24" />}
        <div className="w-16 h-16 rounded-full bg-white/10 overflow-hidden border-2 mb-1" style={{ borderColor: PODIUM[rank - 1] }}>
          {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-lg text-white font-display">{p.username?.[0]?.toUpperCase()}</div>}
        </div>
        <Link to={`/player/${p.user_id}`} className={`text-sm font-display truncate max-w-[100px] ${ns.className}`} style={ns.style}>{p.username}</Link>
        {clan && <span className={`text-[10px] font-display px-1 rounded mt-0.5 ${isRainbow ? 'rainbow-name' : ''}`} style={isRainbow ? {} : { color: clan.color || '#a7fcc9' }}>[{clan.name}]</span>}
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-sm font-display text-white">{valueFor(p).toLocaleString()}</span>
          {iconFor}
        </div>
        <div
          className="w-20 sm:w-24 rounded-t-xl flex items-start justify-center pt-2 font-display text-3xl text-white/90"
          style={{
            height: `${height}px`,
            background: `linear-gradient(to top, ${PODIUM[rank - 1]}aa, ${PODIUM[rank - 1]}33)`,
            border: `2px solid ${PODIUM[rank - 1]}77`,
            borderBottom: 'none',
            boxShadow: `0 0 20px ${PODIUM[rank - 1]}33`
          }}
        >
          {rank}
        </div>
      </div>
    );
  };

  const Row = ({ p, rank }) => {
    const clan = clanByUser[p.user_id];
    const isRainbow = (clan?.color || '').toLowerCase() === 'rainbow';
    const ns = nameStyle(p);
    return (
      <div className="flex items-center gap-2 py-2">
        <span className="text-white font-display w-10 text-right">{rank}.</span>
        {clan && (
          <span className={`text-xs font-display px-1 rounded ${isRainbow ? 'rainbow-name' : ''}`} style={isRainbow ? { border: '1px solid #ffffff44' } : { color: clan.color || '#a7fcc9', border: `1px solid ${clan.color || '#a7fcc9'}66` }}>[{clan.name}]</span>
        )}
        <Link to={`/player/${p.user_id}`} className={`text-sm hover:text-[#a7fcc9] flex-1 truncate ${ns.className}`} style={ns.style}>{p.username}</Link>
        <span className="text-white/40 hidden sm:inline">-</span>
        <span className="font-display text-sm w-28 text-right text-white">{valueFor(p).toLocaleString()}</span>
        <span className="text-base">{iconFor}</span>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-display text-white">Leaderboard</h2>
        <div className="flex gap-2">
          <Button size="sm" variant={tab === 'tokens' ? 'default' : 'outline'} onClick={() => setTab('tokens')} style={tab === 'tokens' ? ACCENT : {}} className={tab !== 'tokens' ? 'border-white/20 text-white' : ''}>Tokens</Button>
          <Button size="sm" variant={tab === 'diamonds' ? 'default' : 'outline'} onClick={() => setTab('diamonds')} style={tab === 'diamonds' ? { backgroundColor: '#22d3ee', color: '#000' } : {}} className={tab !== 'diamonds' ? 'border-white/20 text-white' : ''}>Diamonds</Button>
          <Button size="sm" variant={tab === 'xp' ? 'default' : 'outline'} onClick={() => setTab('xp')} style={tab === 'xp' ? ACCENT : {}} className={tab !== 'xp' ? 'border-white/20 text-white' : ''}>XP</Button>
        </div>
      </div>

      {/* Podium — 2nd, 1st, 3rd */}
      {top3.length > 0 && (
        <div className="bg-panel rounded-2xl border border-white/10 p-6 mb-4">
          <div className="flex items-end justify-center gap-3 sm:gap-6">
            <PodiumSlot p={top3[1]} rank={2} height={80} />
            <PodiumSlot p={top3[0]} rank={1} height={120} />
            <PodiumSlot p={top3[2]} rank={3} height={56} />
          </div>
        </div>
      )}

      {/* Ranks 4-10 */}
      <div className="bg-panel rounded-2xl border border-white/10 p-4">
        <div className="divide-y divide-white/5">
          {rest.map((p, i) => <Row key={p.id} p={p} rank={i + 4} />)}
          {top3.length === 0 && <p className="text-white/60 text-sm text-center py-4">No players yet</p>}
        </div>
        {showMyRow && (
          <>
            <div className="h-3" />
            <div className="border-t border-white/10 pt-1">
              <Row p={me} rank={myRank} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}