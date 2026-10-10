import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { Button } from '@/components/ui/button';
import { Flame, Check, Loader2 } from 'lucide-react';

// Day 1-7 rewards, then the cycle repeats.
const REWARDS = [100, 200, 300, 400, 500, 750, 1500];
const DAY_MS = 86400000;

const dayStart = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

export default function DailyStreak() {
  const { profile, updateProfile, addTokens } = useGame();
  const [claiming, setClaiming] = useState(false);
  const [won, setWon] = useState('');

  if (!profile) return null;

  const today = dayStart(new Date());
  const last = profile.last_streak_claim ? dayStart(profile.last_streak_claim) : null;
  const claimedToday = last === today;
  const keptStreak = last !== null && today - last === DAY_MS;
  const streak = profile.login_streak || 0;
  const nextStreak = claimedToday ? streak : (keptStreak ? streak + 1 : 1);
  const cyclePos = ((claimedToday ? streak : nextStreak) - 1) % 7;
  const nextReward = REWARDS[(nextStreak - 1) % 7];

  const grantPrizeBlook = async () => {
    const pool = await base44.entities.Blook.filter({ login_prize: true, is_deleted: false }, null, 200);
    if (pool.length === 0) {
      await addTokens(500);
      return 'a 500-token bonus';
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const existing = await base44.entities.PlayerBlook.filter({ user_id: profile.user_id, blook_id: pick.id });
    if (existing[0]) {
      await base44.entities.PlayerBlook.update(existing[0].id, { quantity: (existing[0].quantity || 0) + 1 });
    } else {
      await base44.entities.PlayerBlook.create({ user_id: profile.user_id, blook_id: pick.id, quantity: 1, game: pick.game || 'icecreamet' });
    }
    return pick.name;
  };

  const claim = async () => {
    if (claimedToday || claiming) return;
    setClaiming(true);
    setWon('');
    try {
      await addTokens(nextReward);
      let prize = '';
      if (nextStreak % 7 === 0) prize = await grantPrizeBlook();
      await updateProfile({ login_streak: nextStreak, last_streak_claim: new Date().toISOString() });
      setWon(prize ? `+${nextReward.toLocaleString()} tokens and ${prize}!` : `+${nextReward.toLocaleString()} tokens!`);
    } catch (e) {
      setWon('');
    }
    setClaiming(false);
  };

  return (
    <div className="bg-panel rounded-2xl border border-white/10 p-4">
      <div className="flex items-center gap-3 mb-3">
        <Flame size={26} className="text-orange-400" />
        <div className="flex-1">
          <h3 className="font-display text-[#a7fcc9] text-lg">Daily Streak</h3>
          <p className="text-xs text-white/60">
            {streak > 0 ? `${streak} day${streak !== 1 ? 's' : ''} in a row` : 'Log in every day to keep your streak alive'}
          </p>
        </div>
        <Button
          onClick={claim}
          disabled={claimedToday || claiming}
          style={{ backgroundColor: claimedToday ? 'rgba(255,255,255,0.15)' : '#f97316', color: '#fff' }}
          className="font-display"
        >
          {claiming ? <Loader2 size={16} className="animate-spin" /> : claimedToday ? 'Claimed today' : `Claim +${nextReward.toLocaleString()}`}
        </Button>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {REWARDS.map((reward, i) => {
          const done = i < cyclePos || (claimedToday && i === cyclePos);
          const isNext = !claimedToday && i === cyclePos;
          return (
            <div
              key={i}
              className={`rounded-xl border p-2 text-center ${
                isNext ? 'border-orange-400 bg-orange-400/20' : done ? 'border-[#a7fcc9]/50 bg-[#a7fcc9]/10' : 'border-white/10 bg-white/5'
              }`}
            >
              <p className="text-[10px] text-white/60 mb-0.5">Day {i + 1}</p>
              {done ? (
                <Check size={16} className="mx-auto text-[#a7fcc9]" />
              ) : (
                <p className="text-xs font-display text-white">{reward}🪙</p>
              )}
              {i === 6 && <p className="text-[9px] text-amber-300 mt-0.5">+ Blook</p>}
            </div>
          );
        })}
      </div>

      {won && <p className="text-sm text-[#a7fcc9] font-display mt-3">{won}</p>}
    </div>
  );
}