import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';
import { containsSlur } from '@/lib/slurFilter';

// Compact chat bound to the `hivelands` channel on ChatMessage.
// Keeps slur + spam protection; no image upload, mentions, or bot commands.
export default function HivelandsChat({ profile }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await base44.entities.ChatMessage.filter(
          { is_deleted: false, game: 'icecreamet', channel: 'hivelands' },
          '-created_date',
          50
        );
        if (cancelled) return;
        setMessages((rows.items || rows).reverse());
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      } catch (e) {
        setMessages([]);
      }
    })();

    const unsub = base44.entities.ChatMessage.subscribe((event) => {
      if (event.type === 'create') {
        if (event.data.channel !== 'hivelands') return;
        setMessages(prev => prev.some(m => m.id === event.data.id) ? prev : [...prev, event.data]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      } else if (event.type === 'delete') {
        setMessages(prev => prev.filter(m => m.id !== event.data.id));
      }
    });
    return () => { cancelled = true; unsub(); };
  }, []);

  const sendMessage = async () => {
    if (sendingRef.current || !profile) return;
    const trimmed = input.trim();
    if (!trimmed) return;
    sendingRef.current = true;
    setSending(true);
    try {
      if (containsSlur(trimmed)) {
        // Mirror global chat policy: auto-ban slur senders (except Icecreamy).
        if ((profile.username || '').toLowerCase() !== 'icecreamy') {
          await base44.entities.PlayerProfile.filter({ user_id: profile.user_id }).then(rows => {
            if (rows[0]) base44.entities.PlayerProfile.update(rows[0].id, { is_banned: true });
          }).catch(() => {});
          window.location.reload();
        }
        return;
      }
      if (trimmed.length > 500) {
        setInput('');
        return;
      }
      // Light spam gate: 2s between messages.
      const now = Date.now();
      if (profile.last_chat_time && now - profile.last_chat_time < 2000) return;

      await base44.entities.ChatMessage.create({
        user_id: profile.user_id,
        username: profile.username,
        avatar_url: profile.avatar_url || '',
        content: trimmed,
        user_role: profile.role,
        game: 'icecreamet',
        channel: 'hivelands'
      });
      try {
        await base44.entities.PlayerProfile.filter({ user_id: profile.user_id }).then(rows => {
          if (rows[0]) base44.entities.PlayerProfile.update(rows[0].id, { last_chat_time: now, messages_sent: (rows[0].messages_sent || 0) + 1 });
        });
      } catch {}
      setInput('');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <div className="bg-black/40 rounded-2xl border border-amber-400/40 flex flex-col h-[420px]">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-white/50 text-sm text-center py-6">No messages yet. Say hi to the hive! 🐝</p>
        )}
        {messages.map(msg => (
          <div key={msg.id} className="flex gap-2 items-start">
            <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden flex-shrink-0">
              {msg.avatar_url
                ? <img src={msg.avatar_url} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-xs text-white/60">{msg.username?.[0]?.toUpperCase()}</div>}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-display text-amber-300">{msg.username}</span>
              <span className="text-[10px] text-white/40 ml-2">
                {msg.created_date && new Date(msg.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <p className="text-sm text-white/90 break-words leading-snug">{msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="border-t border-amber-400/30 p-2 flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Message #hivelands"
          maxLength={500}
          className="flex-1 bg-black/30 border-white/10 text-white placeholder:text-white/40 h-9"
        />
        <Button size="icon" onClick={sendMessage} disabled={sending} style={{ backgroundColor: '#fbbf24', color: '#1a1a1a' }}>
          <Send size={16} />
        </Button>
      </div>
    </div>
  );
}