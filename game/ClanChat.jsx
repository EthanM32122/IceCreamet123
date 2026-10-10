import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { ROLE_COLORS, ROLE_BADGES } from '@/lib/constants';
import { containsSlur } from '@/lib/slurFilter';
import { useGame } from '@/lib/gameContext';
import { Smile, Send } from 'lucide-react';

export default function ClanChat({ clanId, profile }) {
  const { updateProfile } = useGame();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!clanId) return;
    base44.entities.ClanMessage.filter({ clan_id: clanId }).then(msgs => {
      const seen = new Set();
      const unique = msgs.sort((a, b) => new Date(a.created_date) - new Date(b.created_date)).filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      setMessages(unique);
    });
    const unsubscribe = base44.entities.ClanMessage.subscribe((event) => {
      if (event.data?.clan_id !== clanId) return;
      if (event.type === 'create') {
        setMessages(prev => prev.some(m => m.id === event.data.id) ? prev : [...prev, event.data]);
      }
    });
    return unsubscribe;
  }, [clanId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const trimmed = input.trim();
    if (containsSlur(trimmed)) {
      await updateProfile({ is_banned: true });
      await base44.entities.ClanMessage.create({
        clan_id: clanId,
        content: `🚫 ${profile.username} was banned for using a slur.`,
        is_system: true,
        user_role: 'admin'
      });
      setInput('');
      return;
    }
    await base44.entities.ClanMessage.create({
      clan_id: clanId,
      user_id: profile.user_id,
      username: profile.username,
      avatar_url: profile.avatar_url || '',
      content: trimmed,
      is_system: false,
      user_role: profile.role
    });
    setInput('');
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-white/5 rounded-lg p-3 mb-2 space-y-2 min-h-[200px]">
        {messages.map(msg => (
          <div key={msg.id} className="flex items-start gap-2.5 text-sm">
            <div className="w-10 h-10 avatar-rounded-square bg-white/10 overflow-hidden flex-shrink-0">
              {msg.avatar_url ? <img src={msg.avatar_url} className="w-full h-full object-cover" alt="" /> :
                <div className="w-full h-full flex items-center justify-center text-xs text-white">{msg.username?.[0]?.toUpperCase()}</div>}
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-display" style={{ color: ROLE_COLORS[msg.user_role] || '#a7fcc9' }}>
                {ROLE_BADGES[msg.user_role] || ''} {msg.username}
              </span>
              <span className="ml-1 break-words text-white">{msg.content}</span>
            </div>
          </div>
        ))}
        {messages.length === 0 && <p className="text-white/40 text-center py-8 text-sm">No messages yet — say hi!</p>}
      </div>
      <div className="flex gap-2 items-center bg-white/5 rounded-lg p-2">
        <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Message" className="text-sm h-9 bg-transparent border-0 text-white placeholder:text-white/40 focus-visible:ring-0" />
        <button className="text-white/40 hover:text-white p-1" title="Emoji" type="button"><Smile size={18} /></button>
        <button onClick={sendMessage} className="bg-[#a7fcc9] text-panel rounded-md p-2 hover:opacity-90" title="Send" type="button"><Send size={16} /></button>
      </div>
    </div>
  );
}