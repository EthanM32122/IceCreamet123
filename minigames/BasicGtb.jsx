import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getActiveBlooks } from '@/lib/gameDataCache';
import { Bot, User, Send, Trophy, X } from 'lucide-react';

const ROUND_SECONDS = 30;
const WIN_SCORE = 10;

export default function BasicGtb({ onGameOver, onClose }) {
  const [blooks, setBlooks] = useState([]);
  const [current, setCurrent] = useState(null);
  const [round, setRound] = useState(0);
  const [playerScore, setPlayerScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [guess, setGuess] = useState('');
  const [remaining, setRemaining] = useState(ROUND_SECONDS);
  const [feedback, setFeedback] = useState('');
  const [phase, setPhase] = useState('loading'); // loading | playing | between | over
  const [botGuessing, setBotGuessing] = useState(false);

  const game = useRef({}); // source of truth during a round

  useEffect(() => {
    getActiveBlooks('icecreamet')
      .then((bs) => setBlooks(bs.filter((b) => !b.is_deleted && b.is_active !== false && b.image_url && b.name)))
      .catch(() => {});
  }, []);

  const endRound = (ps, bs) => {
    if (game.current.botTimer) clearTimeout(game.current.botTimer);
    setBotGuessing(false);
    if (ps >= WIN_SCORE) {
      setPhase('over');
      setTimeout(() => onGameOver?.(ps * 50 + 100, `You beat the bot ${ps} to ${bs}!`), 1800);
    } else if (bs >= WIN_SCORE) {
      setPhase('over');
      setTimeout(() => onGameOver?.(ps * 25, `The bot won ${bs} to ${ps}.`), 1800);
    } else {
      setPhase('between');
      setTimeout(() => beginRound(game.current.round + 1, ps, bs), 2800);
    }
  };

  const beginRound = (r, ps, bs) => {
    const pool = blooks;
    if (!pool.length) return;
    const b = pool[Math.floor(Math.random() * pool.length)];
    game.current = { round: r, playerScore: ps, botScore: bs, current: b, resolved: false, botTimer: null };
    setCurrent(b);
    setRound(r);
    setPlayerScore(ps);
    setBotScore(bs);
    setGuess('');
    setFeedback('');
    setRemaining(ROUND_SECONDS);
    setPhase('playing');

    // Bot guess timing — faster as rounds progress
    const minT = Math.max(2.5, 13 - r);
    const maxT = Math.max(7, 24 - r * 1.4);
    const botDelay = (minT + Math.random() * (maxT - minT)) * 1000;
    setBotGuessing(true);
    game.current.botTimer = setTimeout(() => {
      if (game.current.resolved) return;
      game.current.resolved = true;
      const ns = game.current.botScore + 1;
      game.current.botScore = ns;
      setBotScore(ns);
      setBotGuessing(false);
      setFeedback(`🤖 Bot guessed "${b.name}" first! Bot +1`);
      endRound(game.current.playerScore, ns);
    }, botDelay);
  };

  // round countdown
  useEffect(() => {
    if (phase !== 'playing') return;
    const t = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(t);
          if (!game.current.resolved) {
            game.current.resolved = true;
            setBotGuessing(false);
            setFeedback(`⏰ Time's up! It was "${game.current.current?.name}"`);
            endRound(game.current.playerScore, game.current.botScore);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round]);

  const submitGuess = () => {
    if (!guess.trim() || phase !== 'playing' || !game.current.current) return;
    const g = guess.trim().toLowerCase();
    const answer = (game.current.current.name || '').trim().toLowerCase();
    if (g === answer) {
      if (game.current.resolved) return;
      game.current.resolved = true;
      const ns = game.current.playerScore + 1;
      game.current.playerScore = ns;
      setPlayerScore(ns);
      setFeedback(`✅ Correct! "${game.current.current.name}" — You +1`);
      endRound(ns, game.current.botScore);
    } else {
      setFeedback(`❌ "${guess}" is wrong…`);
    }
    setGuess('');
  };

  // start when blooks load
  useEffect(() => {
    if (blooks.length && phase === 'loading') beginRound(1, 0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blooks]);

  // cleanup
  useEffect(() => {
    return () => { if (game.current.botTimer) clearTimeout(game.current.botTimer); };
  }, []);

  return (
    <div className="text-white">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-xl text-[#a7fcc9] flex items-center gap-2"><Bot size={20} /> Basic GTB — vs Bot</h3>
        <Button size="icon" variant="ghost" onClick={onClose} className="text-white/60 hover:text-white"><X size={18} /></Button>
      </div>

      {/* Scoreboard */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className={`rounded-xl p-3 border ${playerScore > botScore ? 'bg-[#a7fcc9]/15 border-[#a7fcc9]/50' : 'bg-white/5 border-white/10'}`}>
          <div className="flex items-center gap-2 mb-1"><User size={14} className="text-[#a7fcc9]" /><span className="text-xs text-white/60">You</span></div>
          <p className="font-display text-2xl text-[#a7fcc9]">{playerScore}</p>
        </div>
        <div className={`rounded-xl p-3 border ${botScore > playerScore ? 'bg-red-500/15 border-red-500/50' : 'bg-white/5 border-white/10'}`}>
          <div className="flex items-center gap-2 mb-1"><Bot size={14} className="text-red-400" /><span className="text-xs text-white/60">Bot</span></div>
          <p className="font-display text-2xl text-red-400">{botScore}</p>
        </div>
      </div>
      <p className="text-center text-xs text-white/50 mb-3">First to {WIN_SCORE} wins · Round {round}</p>

      {/* Blook display */}
      <div className="rounded-xl bg-black/20 border border-white/10 p-4 text-center min-h-[180px] flex flex-col items-center justify-center mb-3">
        {phase === 'loading' && <p className="text-white/50 text-sm">Loading blooks…</p>}
        {phase !== 'loading' && current && (
          <>
            <div className="w-28 h-28 mx-auto flex items-center justify-center mb-2">
              <img
                src={current.image_url}
                alt="?"
                className="w-full h-full object-contain"
                style={phase === 'playing' ? { filter: 'brightness(0) drop-shadow(0 0 1px rgba(255,255,255,0.4))' } : {}}
              />
            </div>
            {phase === 'playing' && (
              <>
                <p className="text-sm text-white/80">Guess this blook!</p>
                <p className="text-xs text-amber-400 font-display mt-1">⏱ {remaining}s {botGuessing && '· 🤖 bot thinking…'}</p>
              </>
            )}
            {phase === 'between' && <p className="text-sm text-[#a7fcc9] font-display">It was: {current.name}</p>}
            {phase === 'over' && (
              <>
                <p className="text-3xl mb-1">{playerScore > botScore ? '🏆' : '🤖'}</p>
                <p className="font-display text-lg text-[#a7fcc9]">{playerScore > botScore ? 'You win!' : 'Bot wins!'}</p>
              </>
            )}
          </>
        )}
      </div>

      {/* Feedback */}
      {feedback && <p className="text-center text-sm text-white/80 mb-3 min-h-[20px]">{feedback}</p>}

      {/* Input */}
      {phase === 'playing' && (
        <div className="flex gap-2">
          <Input
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitGuess(); }}
            placeholder="Type the blook name…"
            className="bg-white/10 border-white/20 text-white"
          />
          <Button size="icon" onClick={submitGuess} disabled={!guess.trim()} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
            <Send size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}