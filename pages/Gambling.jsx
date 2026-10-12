import React from 'react';
import { Link } from 'react-router-dom';
import { useGame } from '@/lib/gameContext';
import { TokenIcon } from '@/components/game/CurrencyIcon';
import { Dices, Spade, BookOpen, ArrowRight } from 'lucide-react';

export default function Gambling() {
  const { profile } = useGame();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl text-white flex items-center gap-2">
            <Dices size={28} className="text-[#a7fcc9]" /> Gambling
          </h1>
          <p className="text-white/50 text-sm mt-1">Play card games with tokens. Good luck!</p>
        </div>
        {profile && (
          <div className="flex items-center gap-1.5 text-[#a7fcc9] font-display text-lg">
            <TokenIcon size={18} />
            {(profile.tokens || 0).toLocaleString()}
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          to="/blackjack"
          className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d3d2a] to-[#0a1f16] p-5 hover:border-[#a7fcc9]/40 transition-all"
        >
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,#a7fcc9,transparent_50%)]" />
          <div className="relative space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                <Spade size={24} className="text-[#a7fcc9]" />
              </div>
              <div>
                <h2 className="font-display text-xl text-white group-hover:text-[#a7fcc9] transition-colors">Blackjack</h2>
                <p className="text-white/50 text-xs">vs Bot · 2–3 players</p>
              </div>
            </div>
            <p className="text-white/70 text-sm">
              Get as close to 21 as you can without going over. Bet any amount. Play vs a bot or online IceCreamet players.
            </p>
            <div className="flex items-center gap-1 text-[#a7fcc9] text-sm font-display">
              Play now <ArrowRight size={14} />
            </div>
          </div>
        </Link>

        <Link
          to="/blackjack/values"
          className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a2a3a] to-[#0d1520] p-5 hover:border-white/30 transition-all"
        >
          <div className="relative space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                <BookOpen size={24} className="text-sky-300" />
              </div>
              <div>
                <h2 className="font-display text-xl text-white group-hover:text-sky-300 transition-colors">Card Values</h2>
                <p className="text-white/50 text-xs">Learn the rules</p>
              </div>
            </div>
            <p className="text-white/70 text-sm">
              Face cards = 10 · Ace = 1 or 11 · Number cards = face value. Bust over 21.
            </p>
            <div className="flex items-center gap-1 text-sky-300 text-sm font-display">
              View chart <ArrowRight size={14} />
            </div>
          </div>
        </Link>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/60 text-xs space-y-1">
        <p className="font-display text-white/80 text-sm">House rules</p>
        <p>• Bet any amount of tokens you have</p>
        <p>• Hit 21 = best · Over 21 = bust (lose) · Highest under 21 wins</p>
        <p>• Solo vs bot, or 2–3 seats (bots fill empty seats)</p>
      </div>
    </div>
  );
}
