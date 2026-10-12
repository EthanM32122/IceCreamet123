import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useGame } from '@/lib/gameContext';
import { TokenIcon } from '@/components/game/CurrencyIcon';
import { ArrowLeft, BookOpen, Bot, Users, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function freshDeck() {
  const d = [];
  for (const s of SUITS) for (const r of RANKS) d.push({ rank: r, suit: s, id: `${r}${s}-${Math.random().toString(36).slice(2, 7)}` });
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 'A') { aces++; total += 11; }
    else if (['K', 'Q', 'J'].includes(c.rank)) total += 10;
    else total += parseInt(c.rank, 10);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function CardFace({ card, small }) {
  if (!card) return null;
  const red = card.suit === '♥' || card.suit === '♦';
  const w = small ? 'w-11 h-16' : 'w-14 h-20 sm:w-16 sm:h-24';
  return (
    <div className={`${w} rounded-lg bg-white shadow-lg flex flex-col items-center justify-between py-1 px-0.5 border border-black/15 ${red ? 'text-red-600' : 'text-gray-900'}`}>
      <span className={`font-bold self-start pl-1 ${small ? 'text-[10px]' : 'text-xs'}`}>{card.rank}</span>
      <span className={small ? 'text-base' : 'text-xl'}>{card.suit}</span>
      <span className={`font-bold self-end pr-1 rotate-180 ${small ? 'text-[10px]' : 'text-xs'}`}>{card.rank}</span>
    </div>
  );
}

function CardBack({ small }) {
  const w = small ? 'w-11 h-16' : 'w-14 h-20 sm:w-16 sm:h-24';
  return (
    <div className={`${w} rounded-lg shadow-lg border border-white/20 bg-gradient-to-br from-red-800 to-red-950 flex items-center justify-center`}
      <div className="w-[70%] h-[70%] rounded border border-yellow-600/40 bg-red-900/50" />
    </div>
  );
}

export default function Blackjack() {
  const { profile, updateProfile } = useGame();
  const [phase, setPhase] = useState('lobby');
  const [mode, setMode] = useState('bot');
  const [seats, setSeats] = useState(2);
  const [betInput, setBetInput] = useState('100');
  const [bet, setBet] = useState(0);
  const [deck, setDeck] = useState([]);
  const [players, setPlayers] = useState([]);
  const [dealer, setDealer] = useState({ cards: [], stood: false, busted: false });
  const [turnIdx, setTurnIdx] = useState(0);
  const [resultMsg, setResultMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [balanceAfterBet, setBalanceAfterBet] = useState(0);

  const tokens = profile?.tokens || 0;
  const betNum = Math.max(0, Math.floor(Number(betInput) || 0));

  const dealOne = useCallback((d) => {
    const next = [...d];
    const card = next.pop();
    return [card, next];
  }, []);

  const startGame = async () => {
    if (!profile || betNum < 1 || betNum > tokens || busy) return;
    setBusy(true);
    try {
      await updateProfile({ tokens: tokens - betNum });
      setBet(betNum);
      setBalanceAfterBet(tokens - betNum);

      let d = freshDeck();
      const list = [];
      list.push({
        id: profile.user_id,
        name: profile.username || 'You',
        avatar: profile.avatar_url || '',
        isYou: true,
        isBot: false,
        cards: [],
        stood: false,
        busted: false,
      });
      const botNames = ['Bot Rex', 'Bot Nova', 'Bot Chill'];
      for (let i = 1; i < seats; i++) {
        list.push({
          id: `bot-${i}`,
          name: botNames[i - 1] || `Bot ${i}`,
          avatar: '',
          isYou: false,
          isBot: true,
          cards: [],
          stood: false,
          busted: false,
        });
      }

      const dealerCards = [];
      for (let r = 0; r < 2; r++) {
        for (const p of list) {
          const [c, nd] = dealOne(d); d = nd;
          p.cards.push(c);
        }
        const [c, nd] = dealOne(d); d = nd;
        dealerCards.push(c);
      }

      setDeck(d);
      setPlayers(list);
      setDealer({ cards: dealerCards, stood: false, busted: false });
      setTurnIdx(0);
      setResultMsg('');
      setPhase('playing');
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const current = players[turnIdx];

  const finishRound = async (plist, dealerState, d, afterBal) => {
    let dcards = [...dealerState.cards];
    let dd = [...d];
    let dVal = handValue(dcards);
    while (dVal < 17) {
      const [c, nd] = dealOne(dd); dd = nd;
      if (!c) break;
      dcards.push(c);
      dVal = handValue(dcards);
    }
    const dealerBust = dVal > 21;
    const finalDealer = { cards: dcards, stood: true, busted: dealerBust };

    let net = 0;
    const you = plist.find(p => p.isYou);
    const youVal = handValue(you.cards);
    const youBust = youVal > 21;

    if (youBust) {
      net = 0;
      setResultMsg(`Bust (${youVal}) — lost ${bet.toLocaleString()} tokens`);
    } else if (dealerBust) {
      net = bet * 2;
      setResultMsg(`Dealer bust! You win +${bet.toLocaleString()} tokens`);
    } else if (youVal > dVal) {
      net = bet * 2;
      setResultMsg(`You win ${youVal} vs ${dVal}! +${bet.toLocaleString()} tokens`);
    } else if (youVal === dVal) {
      net = bet;
      setResultMsg(`Push (${youVal}) — bet returned`);
    } else {
      net = 0;
      setResultMsg(`Dealer wins ${dVal} vs ${youVal} — lost ${bet.toLocaleString()} tokens`);
    }

    if (net > 0 && profile) {
      try {
        await updateProfile({ tokens: (afterBal ?? balanceAfterBet) + net });
      } catch (e) {}
    }

    setDealer(finalDealer);
    setPlayers(plist.map(p => ({ ...p, stood: true })));
    setDeck(dd);
    setPhase('result');
  };

  const playBotTurn = async (idx, plist, d, dealerState, afterBal) => {
    let list = plist.map(p => ({ ...p, cards: [...p.cards] }));
    let dd = [...d];
    let i = idx;
    while (i < list.length && list[i].isBot) {
      let p = list[i];
      let val = handValue(p.cards);
      while (val < 16) {
        const [c, nd] = dealOne(dd); dd = nd;
        if (!c) break;
        p.cards.push(c);
        val = handValue(p.cards);
        if (val > 21) { p.busted = true; break; }
      }
      p.stood = true;
      list[i] = p;
      i++;
    }
    setPlayers(list);
    setDeck(dd);
    if (i >= list.length) {
      await finishRound(list, dealerState, dd, afterBal);
    } else {
      setTurnIdx(i);
    }
  };

  const hit = async () => {
    if (phase !== 'playing' || !current?.isYou || current.stood || current.busted) return;
    let d = [...deck];
    const [c, nd] = dealOne(d);
    if (!c) return;
    const list = players.map(p => {
      if (!p.isYou) return p;
      const cards = [...p.cards, c];
      const val = handValue(cards);
      return { ...p, cards, busted: val > 21, stood: val > 21 };
    });
    setDeck(nd);
    setPlayers(list);
    const you = list.find(p => p.isYou);
    if (you.busted) {
      await playBotTurn(turnIdx + 1, list, nd, dealer, balanceAfterBet);
    }
  };

  const stand = async () => {
    if (phase !== 'playing' || !current?.isYou) return;
    const list = players.map(p => p.isYou ? { ...p, stood: true } : p);
    setPlayers(list);
    await playBotTurn(turnIdx + 1, list, deck, dealer, balanceAfterBet);
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    const p = players[turnIdx];
    if (p?.isBot && !p.stood) {
      const t = setTimeout(() => playBotTurn(turnIdx, players, deck, dealer, balanceAfterBet), 600);
      return () => clearTimeout(t);
    }
  }, [phase, turnIdx]);

  const otherPlayers = players.filter(p => !p.isYou);

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-8">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/gambling" className="text-white/60 hover:text-white"><ArrowLeft size={20} /></Link>
          <h1 className="font-display text-2xl text-white">Blackjack</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/blackjack/values" className="text-xs text-sky-300 hover:underline flex items-center gap-1">
            <BookOpen size={14} /> Card values
          </Link>
          {profile && (
            <span className="flex items-center gap-1 text-[#a7fcc9] font-display">
              <TokenIcon size={14} /> {(profile.tokens || 0).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {phase === 'lobby' && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-5">
          <div>
            <p className="text-white/70 text-sm mb-2">Mode</p>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => setMode('bot')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-display ${mode === 'bot' ? 'bg-[#a7fcc9] text-[#0c4a30]' : 'bg-white/10 text-white/80'}`}>
                <Bot size={16} /> vs Bot
              </button>
              <button type="button" onClick={() => setMode('multi')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-display ${mode === 'multi' ? 'bg-[#a7fcc9] text-[#0c4a30]' : 'bg-white/10 text-white/80'}`}>
                <Users size={16} /> 2–3 seats (bots fill empty)
              </button>
            </div>
          </div>

          <div>
            <p className="text-white/70 text-sm mb-2">Seats at table</p>
            <div className="flex gap-2">
              {[2, 3].map(n => (
                <button key={n} type="button" onClick={() => setSeats(n)} className={`px-4 py-2 rounded-xl text-sm font-display ${seats === n ? 'bg-white/25 text-white' : 'bg-white/10 text-white/60'}`}>
                  {n} players
                </button>
              ))}
            </div>
            <p className="text-white/40 text-xs mt-1">You + {seats - 1} bot{seats > 2 ? 's' : ''}. Empty seats are filled by bots.</p>
          </div>

          <div>
            <p className="text-white/70 text-sm mb-2">Bet amount</p>
            <div className="flex items-center gap-2 max-w-xs">
              <button type="button" className="w-9 h-9 rounded-lg bg-white/10 text-white flex items-center justify-center" onClick={() => setBetInput(String(Math.max(1, betNum - 50)))}>
                <Minus size={14} />
              </button>
              <Input type="number" min={1} max={tokens} value={betInput} onChange={e => setBetInput(e.target.value)} className="text-center font-display" />
              <button type="button" className="w-9 h-9 rounded-lg bg-white/10 text-white flex items-center justify-center" onClick={() => setBetInput(String(Math.min(tokens, betNum + 50)))}>
                <Plus size={14} />
              </button>
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {[100, 500, 1000, 5000].map(v => (
                <button key={v} type="button" onClick={() => setBetInput(String(Math.min(tokens, v)))} className="px-2 py-1 rounded-lg bg-white/10 text-white/70 text-xs hover:bg-white/20">{v.toLocaleString()}</button>
              ))}
              <button type="button" onClick={() => setBetInput(String(tokens))} className="px-2 py-1 rounded-lg bg-white/10 text-[#a7fcc9] text-xs hover:bg-white/20">Max</button>
            </div>
          </div>

          <Button onClick={startGame} disabled={!profile || betNum < 1 || betNum > tokens || busy} className="w-full sm:w-auto font-display" style={{ backgroundColor: '#a7fcc9', color: '#0c4a30' }}>
            {busy ? 'Dealing…' : `Deal · Bet ${betNum.toLocaleString()} tokens`}
          </Button>
        </div>
      )}

      {(phase === 'playing' || phase === 'result') && (
        <div className="relative rounded-2xl overflow-hidden border border-[#2a5a3a] shadow-2xl" style={{ background: 'radial-gradient(ellipse at center, #1a6b3a 0%, #0d3d24 55%, #082818 100%)' }}>
          <div className="absolute inset-x-0 top-6 text-center pointer-events-none select-none">
            <p className="font-display text-white/80 text-lg tracking-widest">BLACK JACK</p>
            <p className="text-[#c9a227]/80 text-xs font-display">PAYS 3 TO 2 · DEALER MUST DRAW TO 16</p>
          </div>

          <div className="pt-16 pb-4 flex flex-col items-center gap-2">
            <p className="text-white/50 text-xs font-display">DEALER</p>
            <div className="flex gap-1.5">
              {dealer.cards.map((c, i) => (
                phase === 'playing' && i === 1 ? <CardBack key={c.id || i} /> : <CardFace key={c.id || i} card={c} />
              ))}
            </div>
            {phase === 'result' && (
              <p className="text-white/80 text-sm font-display">{handValue(dealer.cards)}{dealer.busted ? ' · BUST' : ''}</p>
            )}
          </div>

          <div className="flex justify-center py-2">
            <div className="relative">
              <CardBack />
              <div className="absolute -right-1 -top-1"><CardBack small /></div>
            </div>
          </div>

          <div className="px-4 flex justify-center gap-6 flex-wrap min-h-[72px]">
            {otherPlayers.map(p => (
              <div key={p.id} className="flex flex-col items-center gap-1 max-w-[100px]">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-white/15 border border-white/20 flex-shrink-0">
                  {p.avatar ? (
                    <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-white/70">{p.isBot ? '🤖' : (p.name?.[0] || '?')}</div>
                  )}
                </div>
                <span className="text-[10px] text-white/60 truncate w-full text-center">{p.name}</span>
                <div className="flex gap-0.5 scale-90 origin-top">
                  {p.cards.map((c, i) => (
                    phase === 'playing' ? <CardBack key={c.id || i} small /> : <CardFace key={c.id || i} card={c} small />
                  ))}
                </div>
                {phase === 'result' && (
                  <span className="text-[10px] text-white/50">{handValue(p.cards)}{p.busted ? ' bust' : ''}</span>
                )}
              </div>
            ))}
          </div>

          <div className="pb-6 pt-3 flex flex-col items-center gap-2">
            <p className="text-[#a7fcc9]/80 text-xs font-display">YOU · bet {bet.toLocaleString()}</p>
            <div className="flex gap-1.5">
              {players.find(p => p.isYou)?.cards.map((c, i) => (
                <CardFace key={c.id || i} card={c} />
              ))}
            </div>
            <p className="text-white font-display text-lg">
              {handValue(players.find(p => p.isYou)?.cards || [])}
              {players.find(p => p.isYou)?.busted ? ' · BUST' : ''}
            </p>

            {phase === 'playing' && current?.isYou && !current.stood && !current.busted && (
              <div className="flex gap-3 mt-1">
                <Button type="button" onClick={hit} className="font-display px-6" style={{ backgroundColor: '#a7fcc9', color: '#0c4a30' }}>Hit</Button>
                <Button type="button" onClick={stand} variant="outline" className="font-display px-6 border-white/30 text-white">Stand</Button>
              </div>
            )}

            {phase === 'result' && (
              <div className="mt-2 text-center space-y-2">
                <p className="font-display text-white text-base">{resultMsg}</p>
                <Button type="button" onClick={() => { setPhase('lobby'); setPlayers([]); setDealer({ cards: [], stood: false, busted: false }); }} className="font-display" style={{ backgroundColor: '#a7fcc9', color: '#0c4a30' }}>
                  Play again
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
