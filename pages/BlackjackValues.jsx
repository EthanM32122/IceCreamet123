import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Spade } from 'lucide-react';

const FACES = ['J', 'Q', 'K', '10'];
const NUMS = [2, 3, 4, 5, 6, 7, 8, 9];

function MiniCard({ rank, suit = '♠', red = false }) {
  return (
    <div className={`w-14 h-20 sm:w-16 sm:h-24 rounded-lg bg-white shadow-md flex flex-col items-center justify-between py-1.5 px-1 border border-black/10 ${red ? 'text-red-600' : 'text-gray-900'}`}>
      <span className="text-xs font-bold self-start pl-1">{rank}</span>
      <span className="text-lg">{suit}</span>
      <span className="text-xs font-bold self-end pr-1 rotate-180">{rank}</span>
    </div>
  );
}

export default function BlackjackValues() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/gambling" className="text-white/60 hover:text-white">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display text-2xl text-white">Blackjack Card Values</h1>
      </div>

      <div className="rounded-2xl bg-[#7cb87c] border border-white/10 p-6 sm:p-8 space-y-8 shadow-xl">
        <h2 className="text-center font-display text-2xl sm:text-3xl text-white tracking-wide drop-shadow">
          BLACKJACK<br />
          <span className="text-lg sm:text-xl font-normal">CARD VALUES</span>
        </h2>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {FACES.map((f, i) => (
            <MiniCard key={f} rank={f} suit={i % 2 ? '♥' : '♠'} red={i % 2 === 1} />
          ))}
          <span className="font-display text-2xl text-white mx-2">= 10</span>
          <MiniCard rank="A" suit="♥" red />
          <span className="font-display text-xl text-white ml-1">= 1 or 11</span>
        </div>

        <div className="flex flex-wrap items-end justify-center gap-2 sm:gap-3">
          {NUMS.map((n, i) => (
            <div key={n} className="flex flex-col items-center gap-1">
              <MiniCard rank={String(n)} suit={['♦','♠','♥','♣','♦','♠','♥','♣'][i]} red={i % 2 === 0} />
              <span className="font-display text-white text-sm">{n}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/70 text-sm space-y-2">
        <p><strong className="text-white">Goal:</strong> Get as close to <span className="text-[#a7fcc9]">21</span> as possible without going over.</p>
        <p><strong className="text-white">Bust:</strong> Over 21 = you lose that hand.</p>
        <p><strong className="text-white">Blackjack:</strong> Exactly 21 (especially Ace + 10) is the best hand.</p>
        <p><strong className="text-white">Ace:</strong> Counts as 11 unless that would bust you, then it counts as 1.</p>
      </div>

      <Link
        to="/blackjack"
        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#a7fcc9] text-[#0c4a30] font-display hover:brightness-110"
      >
        <Spade size={18} /> Play Blackjack
      </Link>
    </div>
  );
}
