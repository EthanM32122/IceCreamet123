import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { getAllPlayers } from '@/lib/playersCache';
import { getActiveBlooks, getPacks, getBadges, getPlayerBadges, getClans, getClanMembers } from '@/lib/gameDataCache';
import { uploadFile } from '@/lib/uploadFile';
import { useGame } from '@/lib/gameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ROLE_COLORS, ROLE_BADGES, ROLE_HIERARCHY, VERIFIED_BADGE_ID } from '@/lib/constants';
import { containsSlur, containsIpAttempt } from '@/lib/slurFilter';
import { getColorStyle } from '@/lib/colorStyle';
import { Send, Image, Trash2, Hash, Smile, Reply, X } from 'lucide-react';
import Links from '@/pages/Links';
import { handleBotCommand, getActiveGames, clearUnscramble, clearGtb, clearGtb2, clearGtp } from '@/lib/chatBot';
import { clearRiddle, normalizeAnswer } from '@/lib/riddles';
import InstGtbChannel from '@/components/game/InstGtbChannel';
import PullsChannel from '@/components/game/PullsChannel';
import { DEFAULT_BOT_AVATAR, getBotAvatar } from '@/lib/botAvatar';
import { handleVerityMention } from '@/lib/verity';

const EMOJIS = ['😀','😂','😎','🥳','🤔','😢','😡','👍','👎','❤️','🔥','🎉','🧊','🪙','✨','🤖'];
const playPingSound = () => { try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; const ctx = new AC(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime); osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.08); gain.gain.setValueAtTime(0.12, ctx.currentTime); gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25); osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.25); } catch (e) {} };

export default function ChatView() {
  const { profile, updateProfile } = useGame();
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messagesError, setMessagesError] = useState('');
  const [botAvatar, setBotAvatar] = useState(DEFAULT_BOT_AVATAR);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [players, setPlayers] = useState([]);
  const [clanByUser, setClanByUser] = useState({});
  const [showEmojis, setShowEmojis] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [typers, setTypers] = useState([]);
  const [channel, setChannel] = useState('global');
  const [blooks, setBlooks] = useState([]);
  const [packs, setPacks] = useState([]);
  const [badges, setBadges] = useState([]);
  const [playerBadges, setPlayerBadges] = useState([]);
  const lastTypingWrite = useRef(0);
  const myUsernameRef = useRef('');
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const sendingRef = useRef(false);
  useEffect(() => { myUsernameRef.current = profile?.username || ''; }, [profile?.username]);

  const appendMessage = (msg) => {
    if (!msg || !msg.id || msg.is_deleted) return;
    if (msg.game && msg.game !== 'icecreamet') return;
    if (msg.channel && msg.channel !== 'global') return;
    const stamped = msg.created_date ? msg : { ...msg, created_date: new Date().toISOString() };
    setMessages(prev => prev.some(m => m.id === stamped.id) ? prev : [...prev, stamped].slice(-100));
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  useEffect(() => {
    (async () => {
      await loadMessages();
      await Promise.all([getAllPlayers().then(setPlayers).catch(() => {}), getActiveBlooks().then(setBlooks).catch(() => {}), getPacks().then(setPacks).catch(() => {})]);
      await new Promise(r => setTimeout(r, 120));
      await Promise.all([getBadges().then(setBadges).catch(() => {}), getPlayerBadges().then(setPlayerBadges).catch(() => {}), Promise.all([getClanMembers(), getClans()]).then(([members, clans]) => {
        const clanMap = {}; clans.forEach(c => { clanMap[c.id] = c; });
        const byUser = {}; members.forEach(m => { byUser[m.user_id] = clanMap[m.clan_id]; });
        setClanByUser(byUser);
      }).catch(() => {})]);
    })();
    const unsub = base44.entities.ChatMessage.subscribe((event) => {
      try {
        if (event.type === 'create') {
          const data = event.data || {};
          if (data.game && data.game !== 'icecreamet') return;
          if (data.channel && data.channel !== 'global') return;
          const me = myUsernameRef.current;
          if (me && data.mentions && data.username !== me && String(data.mentions).split(',').includes(me)) playPingSound();
          if (!data.is_deleted) appendMessage(data);
        } else if (event.type === 'update') {
          const id = event.data?.id || event.id; if (!id) return;
          // If marked deleted, remove; otherwise merge fields — never wipe the list
          if (event.data?.is_deleted) {
            setMessages(prev => prev.filter(m => m.id !== id));
          } else {
            setMessages(prev => prev.map(m => m.id === id ? { ...m, ...event.data } : m));
          }
        } else if (event.type === 'delete') {
          const id = event.data?.id || event.id; if (!id) return;
          setMessages(prev => prev.filter(m => m.id !== id));
        }
      } catch (e) {}
    });
    const poll = setInterval(async () => {
      try {
        const msgs = await base44.entities.ChatMessage.filter({ is_deleted: false, game: 'icecreamet' }, '-created_date', 40);
        if (!Array.isArray(msgs) || !msgs.length) return;
        const incoming = msgs.filter(m => !m.channel || m.channel === 'global');
        setMessages(prev => {
          // ONLY add new ids — never re-sort/drop messages when idle
          const existing = new Set(prev.map(m => m.id));
          const toAdd = incoming.filter(m => m.id && !existing.has(m.id));
          if (!toAdd.length) return prev;
          return [...prev, ...[...toAdd].reverse()].slice(-100);
        });
      } catch (e) {}
    }, 3000);
    return () => { try { unsub(); } catch {} clearInterval(poll); };
  }, []);

  useEffect(() => { getBotAvatar().then(setBotAvatar).catch(() => {}); }, []);
  useEffect(() => {
    if (!profile) return;
    let mounted = true;
    base44.entities.ChatTyping.filter({}, null, 100).then(rows => {
      if (!mounted) return;
      const now = Date.now();
      setTypers(rows.filter(t => t.user_id !== profile.user_id && now - (t.last_typed || 0) < 4000));
    }).catch(() => {});
    const unsub = base44.entities.ChatTyping.subscribe((event) => {
      if (event.type === 'delete') setTypers(prev => prev.filter(t => t.id !== event.id));
      else if (event.data?.user_id !== profile.user_id && event.data?.last_typed) setTypers(prev => [...prev.filter(t => t.id !== event.id), { ...event.data, id: event.id }]);
    });
    const interval = setInterval(() => setTypers(prev => prev.filter(t => Date.now() - (t.last_typed || 0) < 4000)), 3000);
    return () => { mounted = false; clearInterval(interval); unsub(); };
  }, [profile?.user_id]);

  const sendTyping = () => {
    if (!profile) return;
    const now = Date.now();
    if (now - lastTypingWrite.current < 2500) return;
    lastTypingWrite.current = now;
    base44.entities.ChatTyping.upsert([{ user_id: profile.user_id, username: profile.username, last_typed: now }], { key: 'user_id' }).catch(() => {});
  };
  const clearMyTyping = () => {
    if (!profile) return;
    base44.entities.ChatTyping.filter({ user_id: profile.user_id }).then(rows => { if (rows[0]) base44.entities.ChatTyping.delete(rows[0].id); }).catch(() => {});
  };

  const loadMessages = async () => {
    setMessagesLoading(true); setMessagesError('');
    let msgs;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { msgs = await base44.entities.ChatMessage.filter({ is_deleted: false, game: 'icecreamet' }, '-created_date', 50); break; }
      catch (e) { if (attempt === 2) { setMessagesError(e?.message || 'Unable to load chat.'); setMessagesLoading(false); return; } await new Promise(r => setTimeout(r, 600 * (attempt + 1))); }
    }
    const seen = new Set();
    const unique = msgs.reverse().filter(m => { if (seen.has(m.id) || (m.channel && m.channel !== 'global')) return false; seen.add(m.id); return true; });
    setMessages(unique); setMessagesLoading(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const sendBotMessage = async (text) => {
    const content = containsSlur(text) ? "I can't say that." : text;
    const botMsg = await base44.entities.ChatMessage.create({ content, username: 'ICECREAMET Bot', avatar_url: botAvatar, is_system: true, user_role: 'admin', game: 'icecreamet', channel: 'global' });
    appendMessage(botMsg);
  };

  const postUserMessage = async (content, imageUrl, extra = {}) => {
    const msg = await base44.entities.ChatMessage.create({ user_id: profile.user_id, username: profile.username, avatar_url: profile.avatar_url || '', content: content || '', image_url: imageUrl || '', user_role: profile.role, game: 'icecreamet', channel: 'global', ...extra });
    appendMessage(msg);
    try { base44.functions.invoke('discordSendChat', { username: profile.username, content: content || '', avatarUrl: profile.avatar_url, imageUrl }).catch(() => {}); } catch (e) {}
    return msg;
  };

  const sendMessage = async (content, imageUrl) => {
    if (sendingRef.current || !profile) return;
    const muteExpired = profile.is_muted && profile.mute_until && new Date(profile.mute_until) <= new Date();
    if (profile.is_muted && !muteExpired) return;
    if (muteExpired) updateProfile({ is_muted: false, mute_until: null });
    if (!content?.trim() && !imageUrl) return;
    sendingRef.current = true; setSending(true);
    try {
      const now = Date.now(); const trimmed = (content || '').trim();
      if (containsSlur(trimmed)) { if ((profile.username || '').toLowerCase() !== 'icecreamy') { await updateProfile({ is_banned: true }); window.location.reload(); } return; }
      if (containsIpAttempt(trimmed)) { if ((profile.username || '').toLowerCase() !== 'icecreamy') { await updateProfile({ is_banned: true, ban_reason: 'Attempted to share an IP address in chat', banned_by: 'Security System' }); window.location.reload(); } return; }
      if ((content || '').length > 1000) { await updateProfile({ is_muted: true, mute_until: new Date(now + 3600000).toISOString() }); await sendBotMessage(profile.username + ' was auto-muted for over 1000 characters.'); return; }
      if (trimmed.startsWith('/')) {
        try {
          const isStaff = ROLE_HIERARCHY[profile.role] >= ROLE_HIERARCHY.helper;
          const hasVerified = playerBadges.some(pb => pb.badge_id === VERIFIED_BADGE_ID);
          const reply = await handleBotCommand(trimmed, profile, blooks, packs, hasVerified || isStaff);
          if (reply) await sendBotMessage(profile.username + ' ran "' + trimmed + '"\n' + reply);
        } catch (e) { await sendBotMessage('Command error: ' + (e.message || 'unknown')); }
        setInput(''); return;
      }
      if (profile.last_chat_time && now - profile.last_chat_time < 2000) return;
      await updateProfile({ last_chat_time: now, messages_sent: (profile.messages_sent || 0) + 1 });
      const games = await getActiveGames().catch(() => ({}));
      if (games.unscramble && trimmed.toLowerCase() === String(games.unscramble).toLowerCase()) {
        await postUserMessage(content, imageUrl); await sendBotMessage(profile.username + ' unscrambled it! +50 tokens!'); await clearUnscramble(); await updateProfile({ tokens: (profile.tokens || 0) + 50 }); setInput(''); return;
      }
      const mentionMatches = (content || '').match(/@(\w+)/g) || [];
      const mentions = mentionMatches.map(m => m.slice(1)).join(',');
      const replyExtra = replyingTo ? { reply_to_id: replyingTo.id, reply_to_username: replyingTo.username, reply_to_content: (replyingTo.content || '').slice(0, 100) } : {};
      await postUserMessage(content, imageUrl, { mentions, ...replyExtra });
      if (/@verity\b/i.test(content || '')) handleVerityMention(content, profile).catch(() => {});
      setReplyingTo(null); setInput(''); clearMyTyping();
    } finally { sendingRef.current = false; setSending(false); }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file || !profile) return;
    try { const { file_url } = await uploadFile({ file }); await sendMessage('', file_url); } catch (err) { console.error(err); }
    e.target.value = '';
  };

  const deleteMessage = async (id) => { try { await base44.entities.ChatMessage.update(id, { is_deleted: true }); setMessages(prev => prev.filter(m => m.id !== id)); } catch (e) {} };
  const canDelete = (m) => profile && (m.user_id === profile.user_id || ROLE_HIERARCHY[profile.role] >= ROLE_HIERARCHY.helper);

  const profileMap = {};
  players.forEach(p => { profileMap[p.user_id] = p; });
  const userBadges = {};
  playerBadges.forEach(pb => {
    const b = badges.find(x => x.id === pb.badge_id);
    if (!b) return;
    if (!userBadges[pb.user_id]) userBadges[pb.user_id] = [];
    userBadges[pb.user_id].push(b);
  });

  const channels = [
    { id: 'global', label: 'global' },
    { id: 'inst-gtb', label: 'inst-gtb' },
    { id: 'pulls', label: 'pulls' },
    { id: 'links', label: 'links' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      <div className="flex items-center gap-1 px-2 py-2 border-b border-white/10 overflow-x-auto">
        {channels.map(ch => (
          <button key={ch.id} type="button" onClick={() => setChannel(ch.id)} className={`px-3 py-1.5 rounded-lg text-sm font-display whitespace-nowrap ${channel === ch.id ? 'bg-white/20 text-[#a7fcc9]' : 'text-white/60 hover:bg-white/10'}`}>
            <Hash size={12} className="inline mr-1" />{ch.label}
          </button>
        ))}
      </div>

      {channel === 'global' && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messagesLoading && <p className="text-white/50 text-sm">Loading chat...</p>}
            {messagesError && <p className="text-red-400 text-sm">{messagesError}</p>}
            {messages.map(msg => {
              const isMention = profile?.username && msg.mentions && String(msg.mentions).split(',').includes(profile.username);
              const clan = clanByUser[msg.user_id];
              const nc = profileMap[msg.user_id]?.name_color;
              const cs = getColorStyle(nc, ROLE_HIERARCHY[msg.user_role] >= ROLE_HIERARCHY.admin);
              return (
                <div key={msg.id} className={`flex gap-4 group ${isMention ? 'bg-[#00BFFF]/10 -mx-2 px-2 py-1 rounded' : ''}`}>
                  <div className={`w-14 h-14 bg-white/10 flex-shrink-0 overflow-hidden ${msg.is_system ? 'rounded-full' : 'avatar-rounded-square'}`}>
                    {msg.is_system ? (
                      <img src={botAvatar} alt="Bot" className="w-full h-full object-contain" />
                    ) : msg.avatar_url ? (
                      <img src={msg.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-white/60">{msg.username?.[0]?.toUpperCase()}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {clan && <span className="text-xs font-display px-1 rounded" style={{ color: clan.color || '#a7fcc9', border: `1px solid ${(clan.color || '#a7fcc9')}66` }}>[{clan.name}]</span>}
                      <span className={`text-base font-display ${cs.className || ''}`} style={cs.style?.color ? cs.style : { color: ROLE_COLORS[msg.user_role] || '#a7fcc9' }}>
                        {msg.user_role && ROLE_BADGES[msg.user_role]} {msg.username}
                      </span>
                      {(userBadges[msg.user_id] || []).map(b => (
                        <img key={b.id} src={b.image_url} alt={b.name} title={b.name} className="w-5 h-5 object-contain" />
                      ))}
                      <span className="text-[10px] text-white/30">{msg.created_date && new Date(msg.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {canDelete(msg) && (
                        <button type="button" onClick={() => deleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400"><Trash2 size={12} /></button>
                      )}
                      <button type="button" onClick={() => setReplyingTo(msg)} className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-white"><Reply size={12} /></button>
                    </div>
                    {msg.reply_to_username && (
                      <p className="text-[10px] text-white/40">replying to @{msg.reply_to_username}: {(msg.reply_to_content || '').slice(0, 60)}</p>
                    )}
                    {msg.content && <p className="text-base text-white/90 break-words whitespace-pre-wrap">{msg.content}</p>}
                    {msg.image_url && <img src={msg.image_url} alt="" className="mt-1 max-h-48 rounded-lg" />}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          {typers.length > 0 && <p className="text-xs text-white/40 px-4">{typers.map(t => t.username).join(', ')} typing...</p>}
          {replyingTo && (
            <div className="px-4 py-1 flex items-center gap-2 text-xs text-white/60 border-t border-white/10">
              <Reply size={12} /> Replying to {replyingTo.username}
              <button type="button" onClick={() => setReplyingTo(null)} className="ml-auto"><X size={12} /></button>
            </div>
          )}
          <div className="p-3 border-t border-white/10 flex gap-2 items-center relative">
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
            <Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} className="border-white/20"><Image size={16} /></Button>
            <Button type="button" variant="outline" size="icon" onClick={() => setShowEmojis(v => !v)} className="border-white/20"><Smile size={16} /></Button>
            {showEmojis && (
              <div className="absolute bottom-14 left-12 z-20 bg-panel border border-white/10 rounded-xl p-2 grid grid-cols-8 gap-1 shadow-xl">
                {EMOJIS.map(em => (
                  <button key={em} type="button" className="text-lg hover:bg-white/10 rounded p-1" onClick={() => { setInput(v => v + em); setShowEmojis(false); }}>{em}</button>
                ))}
              </div>
            )}
            <Input value={input} onChange={e => { setInput(e.target.value); sendTyping(); }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }} placeholder={profile?.is_muted ? 'You are muted' : 'Message #global'} disabled={!!profile?.is_muted || sending} className="flex-1" />
            <Button type="button" onClick={() => sendMessage(input)} disabled={sending || !!profile?.is_muted} style={{ backgroundColor: '#a7fcc9', color: '#0c4a30' }}><Send size={16} /></Button>
          </div>
        </>
      )}

      {channel === 'inst-gtb' && (
        <div className="flex-1 p-4 flex flex-col min-h-0">
          <InstGtbChannel blooks={blooks} />
        </div>
      )}
      {channel === 'pulls' && (
        <div className="flex-1 p-4 flex flex-col min-h-0">
          <PullsChannel />
        </div>
      )}
      {channel === 'links' && (
        <div className="flex-1 overflow-y-auto p-4">
          <Links />
        </div>
      )}
    </div>
  );
}
