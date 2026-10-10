import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { getActiveInstGtb, setActiveInstGtb } from '@/lib/instgtb';
import { normalizeAnswer } from '@/lib/riddles';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Zap } from 'lucide-react';

const ACCENT = { backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' };

export default function InstGtbChannel({ blooks }) {
  const { profile, updateProfile } = useGame();
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const endRef = useRef(null);

  const ensureActive = async () => {
    let act = await getActiveInstGtb();
    if (!act || Date.now() - act.started_at > 60000) {
      const pool = blooks.filter(b => b.name && b.image_url);
      if (pool.length) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        act = await setActiveInstGtb(pick);
      }
    }
    setActive(act);
  };

  useEffect(() => {
    (async () => {
      const all = await base44.entities.ChatMessage.filter({ game: 'icecreamet', channel: 'instgtb', is_deleted: false }, '-created_date', 30);
      setMessages(all.reverse());
      await ensureActive();
    })();
    const unsub = base44.entities.ChatMessage.subscribe((event) => {
      if (event.type === 'create' && event.data.channel === 'instgtb') {
        setMessages(prev => prev.some(m => m.id === event.data.id) ? prev : [...prev, event.data]);
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    });
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(ensureActive, 10000);
    return () => { unsub(); clearInterval(tick); clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blooks]);

  const sendGuess = async () => {
    if (!profile || !active || busy || !input.trim()) return;
    setBusy(true);
    try {
      const guess = input.trim();
      if (normalizeAnswer(guess) === normalizeAnswer(active.name)) {
        await base44.entities.ChatMessage.create({
          content: `🎉 ${profile.username} guessed it! The blook was "${active.name}". +100 tokens!`,
          username: 'ICECREAMET Bot', is_system: true, user_role: 'admin', game: 'icecreamet', channel: 'instgtb'
        });
        await updateProfile({ tokens: (profile.tokens || 0) + 100 });
        const pool = blooks.filter(b => b.name && b.image_url);
        if (pool.length) {
          const pick = pool[Math.floor(Math.random() * pool.length)];
          setActive(await setActiveInstGtb(pick));
        }
      } else {
        await base44.entities.ChatMessage.create({
          user_id: profile.user_id, username: profile.username, avatar_url: profile.avatar_url || '',
          content: guess, user_role: profile.role, game: 'icecreamet', channel: 'instgtb'
        });
      }
      setInput('');
    } finally { setBusy(false); }
  };

  const elapsed = active ? Math.floor((now - active.started_at) / 1000) : 0;
  const remaining = Math.max(0, 60 - elapsed);

  return (
    <div className="flex flex-col h-full">
      <div className="text-center mb-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-sm font-display">
          <Zap size={14} className="text-yellow-400" /> Instant GTB · new blook in {remaining}s
        </div>
      </div>
      <div className="flex justify-center mb-3">
        {active?.image_url
          ? <img src={active.image_url} alt="?" className="h-40 w-40 object-contain rounded-xl bg-white/5 p-2 border border-white/10" />
          : <div className="h-40 w-40 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40">Loading...</div>}
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 mb-3 min-h-0">
        {messages.map(m => (
          <div key={m.id} className="flex gap-2">
            <div className={`w-7 h-7 flex-shrink-0 overflow-hidden ${m.is_system ? 'rounded-full' : 'avatar-rounded-square'} bg-white/10`}>
              {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                : m.is_system ? <div className="w-full h-full flex items-center justify-center text-xs">🤖</div>
                : <div className="w-full h-full flex items-center justify-center text-[10px] text-white">{m.username?.[0]?.toUpperCase()}</div>}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-display text-white">{m.username}</span>
              <p className="text-sm text-white/90 break-words leading-snug">{m.content}</p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2">
        <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendGuess(); } }}
          placeholder="Type your guess..." className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40" />
        <Button size="icon" onClick={sendGuess} disabled={busy || !active} style={ACCENT}><Send size={16} /></Button>
      </div>
    </div>
  );
}