import React from 'react';
import { Link } from 'react-router-dom';
import { getColorStyle } from '@/lib/colorStyle';
import { ROLE_COLORS, ROLE_HIERARCHY, PLACEHOLDER_BLOOK_IMG } from '@/lib/constants';
import { totalXpToLevel } from '@/lib/leveling';
import { TokenIcon, DiamondIcon } from '@/components/game/CurrencyIcon';

export default function LockerLeftPane({ profile, banner, ownedBlooks, badges, customBlooks, isProfileLocked, onAvatarClick, onShinyAvatarClick }) {
  if (!profile) return null;
  const { progress: xpProgress, needed: xpNeeded } = totalXpToLevel(profile.xp || 0);
  const playerBadges = (badges || []).slice(0, 3);
  const isPlus = profile.plus_permanent || (profile.plus_until && new Date(profile.plus_until) > new Date());
  const topCustomBlooks = (customBlooks || []).slice(0, 6);

  return (
    <div className="w-full lg:w-72 flex-shrink-0 rounded-2xl p-4 space-y-4 bg-panel">
      {/* Locker vents */}
      <div className="flex flex-col gap-1 items-center pb-2 border-b border-white/20">
        {[0, 1, 2].map(i => <div key={i} className="w-20 h-1 rounded-full bg-black/25" />)}
      </div>

      {/* Blook section — banner as background */}
      <div>
        <h3 className="text-white font-display text-sm mb-2">Blook</h3>
        <div className="rounded-xl p-3 flex items-center justify-center relative overflow-hidden bg-black/25" style={banner ? { backgroundImage: `url(${banner.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
          {banner && <div className="absolute inset-0 bg-black/40" />}
          <button onClick={onAvatarClick} disabled={isProfileLocked} className="relative z-10 group disabled:cursor-not-allowed">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className={`w-20 h-20 avatar-rounded-square object-contain ${profile.shiny_avatar ? 'shiny-blook' : ''}`} />
            ) : (
              <div className="w-20 h-20 avatar-rounded-square bg-white/10 flex items-center justify-center text-3xl text-white">{profile.username?.[0]?.toUpperCase()}</div>
            )}
            {!isProfileLocked && <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs text-white rounded-2xl">Change</span>}
            {isProfileLocked && <span className="absolute top-1 right-1 text-xs">🔒</span>}
          </button>
        </div>
        {!isProfileLocked && (
          <button onClick={onShinyAvatarClick} className="mt-1.5 text-xs text-yellow-300 hover:underline flex items-center gap-1">✨ Set shiny avatar</button>
        )}
      </div>

      {/* Title section */}
      <div>
        <h3 className="text-white font-display text-sm mb-2">Title</h3>
        <div className="bg-black/25 rounded-xl p-3">
          {(() => {
            const ns = getColorStyle(profile.name_color, ROLE_HIERARCHY[profile.role] >= ROLE_HIERARCHY.admin);
            const hasStyle = ns.className || Object.keys(ns.style || {}).length > 0;
            return <p className={`text-lg font-display leading-tight ${ns.className}`} style={hasStyle ? ns.style : { color: '#fff' }}>{profile.username}</p>;
          })()}
          {isPlus && <span className="inline-block mt-1 text-[10px] font-display px-2 py-0.5 rounded plus-rainbow">PLUS</span>}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-2 bg-black/30 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (xpProgress / xpNeeded) * 100)}%`, backgroundColor: '#60a5fa' }} />
            </div>
            <span className="text-xs font-display text-white">Lv {profile.level || 1}</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-white flex items-center gap-1"><TokenIcon size={14} /> {(profile.tokens || 0).toLocaleString()}</span>
            <span className="text-xs text-cyan-300 flex items-center gap-1"><DiamondIcon size={14} /> {(profile.diamonds || 0).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-[10px] capitalize px-2 py-0.5 rounded font-display" style={{ color: ROLE_COLORS[profile.role], border: `1px solid ${ROLE_COLORS[profile.role] || '#999'}66` }}>{profile.role}</span>
            {playerBadges.map(b => <img key={b.id} src={b.image_url} alt={b.name} className="w-5 h-5 object-contain" />)}
          </div>
        </div>
      </div>

      {/* Banner section */}
      <div>
        <h3 className="text-white font-display text-sm mb-2">Banner</h3>
        <div className="bg-black/25 rounded-xl p-2 h-24 flex items-center justify-center overflow-hidden">
          {banner ? (
            <img src={banner.image_url} alt={banner.name} className="w-full h-full object-cover rounded-lg" />
          ) : (
            <span className="text-white/50 text-xs">No banner equipped</span>
          )}
        </div>
      </div>

      {/* Custom Blooks section — from Blook Design, click to go to blook-design page */}
      <div>
        <h3 className="text-white font-display text-sm mb-2">Custom Blooks</h3>
        <div className="grid grid-cols-3 gap-2">
          {topCustomBlooks.map(app => (
            <Link key={app.id} to="/blook-design" className="bg-black/25 rounded-lg p-1 aspect-square flex items-center justify-center hover:bg-black/40 transition-colors" title={app.blook_name}>
              <img src={app.image_data} alt={app.blook_name} className="w-full h-full object-contain" />
            </Link>
          ))}
          {Array.from({ length: Math.max(0, 6 - topCustomBlooks.length) }).map((_, i) => (
            <Link key={`empty-${i}`} to="/blook-design" className="bg-black/10 rounded-lg aspect-square flex items-center justify-center hover:bg-black/20 transition-colors">
              <span className="text-white/30 text-lg">+</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}