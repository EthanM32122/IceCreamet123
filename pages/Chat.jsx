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
import { Send, Image, Trash2, Hash, ChevronDown, Smile, Zap, Sparkles, Reply, X, BarChart3, Link2 } from 'lucide-react';
import Links from '@/pages/Links';
import { handleBotCommand, getActiveGames, clearUnscramble, clearGtb, clearGtb2, clearGtp } from '@/lib/chatBot';
import { clearRiddle, normalizeAnswer } from '@/lib/riddles';
import InstGtbChannel from '@/components/game/InstGtbChannel';
import PullsChannel from '@/components/game/PullsChannel';
import PollWidget from '@/components/game/PollWidget';
import { DEFAULT_BOT_AVATAR, getBotAvatar } from '@/lib/botAvatar';
import { handleVerityMention } from '@/lib/verity';

const EMOJIS = ['😀','😂','😎','🥳','🤔','😢','😡','👍','👎','❤️','🔥','🎉','🧊','🪙','✨','🤖'];

const playPingSound = () => {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {}
};

export default function Chat() {
  const { profile, updateProfile } = useGame();
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messagesError, setMessagesError] = useState('');
  const [botAvatar, setBotAvatar] = useState(DEFAULT_BOT_AVATAR);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [players, setPlayers] = useState([]);
  const [clanByUser, setClanByUser] = useState({});
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [typers, setTypers] = useState([]);
  const lastTypingWrite = useRef(0);
  const myUsernameRef = useRef('');
  useEffect(() => { myUsernameRef.current = profile?.username || ''; }, [profile?.username]);

  // Clear "pinged" indicator — mark all chat notifications as read on mount
  useEffect(() => {
    if (!profile) return;
    (async () => {
      try {
        await base44.entities.Notification.updateMany(
          { user_id: profile.user_id, is_read: false, link: '/chat' },
          { $set: { is_read: true } }
        );
      } catch (e) {}
    })();
  }, [profile?.user_id]);
  const [channel, setChannel] = useState('global');
  const [blooks, setBlooks] = useState([]);
  const [packs, setPacks] = useState([]);
  const [badges, setBadges] = useState([]);
  const [playerBadges, setPlayerBadges] = useState([]);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    (async () => {
      // Load messages first (priority), then stagger enrichment data with
      // wide gaps so the mount burst stays under the API rate limit.
      await loadMessages();
      // Wave 1: data needed to render messages (names, blook emotes, pack tags)
      await Promise.all([
        getAllPlayers().then(setPlayers).catch(() => {}),
        getActiveBlooks().then(setBlooks).catch(() => {}),
        getPacks().then(setPacks).catch(() => {})
      ]);
      // Wave 2: badges + clans (small gap keeps us under the API rate limit)
      await new Promise(r => setTimeout(r, 120));
      await Promise.all([
        getBadges().then(setBadges).catch(() => {}),
        getPlayerBadges().then(setPlayerBadges).catch(() => {}),
        Promise.all([getClanMembers(), getClans()]).then(([members, clans]) => {
          const clanMap = {};
          clans.forEach(c => { clanMap[c.id] = c; });
          const byUser = {};
          members.forEach(m => { byUser[m.user_id] = clanMap[m.clan_id]; });
          setClanByUser(byUser);
        }).catch(() => {})
      ]);
    })();
    const unsub = base44.entities.ChatMessage.subscribe((event) => {
      if (event.type === 'create') {
        if (event.data.game !== 'icecreamet') return;
        if (event.data.channel && event.data.channel !== 'global') return;
        const me = myUsernameRef.current;
        if (me && event.data.mentions && event.data.username !== me) {
          if (event.data.mentions.split(',').includes(me)) playPingSound();
        }
        if (event.data.is_deleted) return;
        setMessages(prev => prev.some(m => m.id === event.data.id) ? prev : [...prev, event.data].slice(-50));
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      } else if (event.type === 'update') {
        setMessages(prev => prev.map(m => m.id === event.data.id ? { ...m, ...event.data } : m));
      } else if (event.type === 'delete') {
        setMessages(prev => prev.filter(m => m.id !== event.data.id));
      }
    });
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    if (showMentions) getAllPlayers().then(setPlayers).catch(() => {});
  }, [showMentions]);

  // Bot picture is admin-controlled; keep it in sync live.
  useEffect(() => {
    getBotAvatar().then(setBotAvatar).catch(() => {});
    const unsub = base44.entities.GameSettings.subscribe((event) => {
      if (event.data?.key === 'bot_avatar') getBotAvatar().then(setBotAvatar).catch(() => {});
    });
    return unsub;
  }, []);

  // Who is currently typing — live via the ChatTyping entity.
  useEffect(() => {
    if (!profile) return;
    let mounted = true;
    base44.entities.ChatTyping.filter({}, null, 100).then(rows => {
      if (!mounted) return;
      const now = Date.now();
      setTypers(rows.filter(t => t.user_id !== profile.user_id && now - (t.last_typed || 0) < 4000));
    }).catch(() => {});
    const unsub = base44.entities.ChatTyping.subscribe((event) => {
      if (event.type === 'delete') {
        setTypers(prev => prev.filter(t => t.id !== event.id));
      } else if (event.data?.user_id !== profile.user_id && event.data?.last_typed) {
        setTypers(prev => [...prev.filter(t => t.id !== event.id), { ...event.data, id: event.id }]);
      }
    });
    const interval = setInterval(() => {
      setTypers(prev => prev.filter(t => Date.now() - (t.last_typed || 0) < 4000));
    }, 3000);
    return () => { mounted = false; clearInterval(interval); unsub(); };
  }, [profile?.user_id]);

  const sendTyping = () => {
    if (!profile) return;
    const now = Date.now();
    if (now - lastTypingWrite.current < 2500) return;
    lastTypingWrite.current = now;
    base44.entities.ChatTyping.upsert(
      [{ user_id: profile.user_id, username: profile.username, last_typed: now }],
      { key: 'user_id' }
    ).catch(() => {});
  };

  const clearMyTyping = () => {
    if (!profile) return;
    base44.entities.ChatTyping.filter({ user_id: profile.user_id }).then(rows => {
      if (rows[0]) base44.entities.ChatTyping.delete(rows[0].id);
    }).catch(() => {});
  };

  const loadMessages = async () => {
    setMessagesLoading(true);
    setMessagesError('');
    let msgs;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        msgs = await base44.entities.ChatMessage.filter({ is_deleted: false, game: 'icecreamet' }, '-created_date', 50);
        break;
      } catch (e) {
        if (attempt === 2) { setMessagesError(e?.message || 'Unable to load chat.'); setMessagesLoading(false); return; }
        await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
      }
    }
    const seen = new Set();
    const unique = msgs.reverse().filter(m => {
      if (seen.has(m.id)) return false;
      if (m.channel && m.channel !== 'global') return false;
      seen.add(m.id);
      return true;
    });
    setMessages(unique);
    setMessagesLoading(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const sendBotMessage = async (text) => {
    // The bot must never repeat a slur or any bypass — this is the single
    // chokepoint for all bot output (command replies, the `ran "<input>"`
    // prefix, echoed usernames, auto-mute notices, game-win messages).
    const content = containsSlur(text) ? "🚫 I can't say that." : text;
    await base44.entities.ChatMessage.create({ content, username: 'ICECREAMET Bot', avatar_url: botAvatar, is_system: true, user_role: 'admin', game: 'icecreamet' });
  };

  const postUserMessage = async (content, imageUrl, extra = {}) => {
    const msg = await base44.entities.ChatMessage.create({
      user_id: profile.user_id, username: profile.username, avatar_url: profile.avatar_url || '',
      content: content || '', image_url: imageUrl || '', user_role: profile.role, game: 'icecreamet', channel: 'global',
      ...extra
    });
    try {
      base44.functions.invoke('discordSendChat', {
        username: profile.username, content: content || '', avatarUrl: profile.avatar_url, imageUrl
      }).catch(() => {});
    } catch (e) {}
    return msg;
  };

  const sendMessage = async (content, imageUrl) => {
    if (sendingRef.current) return;
    if (!profile) return;
    const muteExpired = profile.is_muted && profile.mute_until && new Date(profile.mute_until) <= new Date();
    if (profile.is_muted && !muteExpired) return;
    if (muteExpired) { updateProfile({ is_muted: false, mute_until: null }); }
    if (!content?.trim() && !imageUrl) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const now = Date.now();
      const trimmed = (content || '').trim();

      if (containsSlur(trimmed)) {
        if ((profile.username || '').toLowerCase() !== 'icecreamy') {
          await updateProfile({ is_banned: true });
          window.location.reload();
        }
        return;
      }

      // Sharing an IP address is blocked outright; bypassing the filter is a
      // ban just like a slur.
      if (containsIpAttempt(trimmed)) {
        if ((profile.username || '').toLowerCase() !== 'icecreamy') {
          await updateProfile({ is_banned: true, ban_reason: 'Attempted to share an IP address in chat', banned_by: 'Security System' });
          window.location.reload();
        }
        return;
      }

      if ((content || '').length > 1000) {
        await updateProfile({ is_muted: true, mute_until: new Date(now + 3600000).toISOString() });
        await sendBotMessage(`🤖 ${profile.username} was auto-muted for sending over 1000 characters.`);
        return;
      }

      if (trimmed.startsWith('/')) {
        const lowerCmd = trimmed.toLowerCase();
        if (lowerCmd === '/everyone' || lowerCmd.startsWith('/everyone ')) {
          const msgText = trimmed.slice('/everyone'.length).trim();
          const freshPlayers = await getAllPlayers().catch(() => players);
          const nowMs = Date.now();
          const onlinePlayers = freshPlayers.filter(p => !p.is_banned && p.user_id !== profile.user_id && p.last_seen && nowMs - p.last_seen < 120000);
          const onlineUsernames = onlinePlayers.map(p => p.username);
          await postUserMessage(msgText || `📢 @everyone!`, imageUrl, { mentions: onlineUsernames.join(',') });
          const notifs = onlinePlayers.map(p => ({ user_id: p.user_id, type: 'custom', title: '📢 @everyone', message: `${profile.username} pinged everyone in #global`, link: '/chat', is_read: false }));
          if (notifs.length) { try { await base44.entities.Notification.bulkCreate(notifs); } catch {} }
          setInput('');
          return;
        }
        try {
          const isStaff = ROLE_HIERARCHY[profile.role] >= ROLE_HIERARCHY.helper;
          const hasVerified = playerBadges.some(pb => pb.badge_id === VERIFIED_BADGE_ID);
          const reply = await handleBotCommand(trimmed, profile, blooks, packs, hasVerified || isStaff);
          if (reply) await sendBotMessage(`👤 ${profile.username} ran "${trimmed}"\n${reply}`);
        } catch (e) {
          await sendBotMessage('⚠️ Command error: ' + (e.message || 'unknown'));
        }
        setInput('');
        return;
      }

      if (profile.last_chat_time && now - profile.last_chat_time < 2000) return;
      const spamCount = (profile.chat_spam_count || 0);
      if (now - (profile.last_chat_time || 0) < 3000) {
        if (spamCount >= 3) {
          await updateProfile({ is_muted: true, mute_until: new Date(now + 300000).toISOString(), chat_spam_count: 0 });
          await sendBotMessage(`🤖 ${profile.username} has been auto-muted for spam (5 minutes)`);
          return;
        }
        await updateProfile({ chat_spam_count: spamCount + 1, last_chat_time: now, messages_sent: (profile.messages_sent || 0) + 1 });
      } else {
        await updateProfile({ chat_spam_count: 0, last_chat_time: now, messages_sent: (profile.messages_sent || 0) + 1 });
      }

      const games = await getActiveGames().catch(() => ({}));
      const activeAnswer = games.unscramble || null;
      const activeRiddle = games.riddle || null;
      const activeGtb = games.gtb || null;
      const activeGtb2 = games.gtb2 || null;
      const activeGtp = games.gtp || null;

      if (activeAnswer && trimmed.toLowerCase() === activeAnswer.toLowerCase()) {
        await postUserMessage(content, imageUrl);
        await sendBotMessage(`🎉 ${profile.username} unscrambled it! The answer was "${activeAnswer}". +50 tokens!`);
        await clearUnscramble();
        await updateProfile({ tokens: (profile.tokens || 0) + 50 });
        setInput('');
        return;
      }

      if (activeRiddle) {
        const { answer: rAnswer, reward: rReward } = activeRiddle;
        if (normalizeAnswer(trimmed) === normalizeAnswer(rAnswer)) {
          await base44.entities.ChatMessage.create({
            user_id: profile.user_id, username: profile.username, avatar_url: profile.avatar_url || '',
            content: content || '', image_url: imageUrl || '', user_role: profile.role, game: 'icecreamet'
          });
          await sendBotMessage(`🧩 ${profile.username} solved the riddle! The answer was "${rAnswer}". +${rReward} tokens!`);
          await clearRiddle();
          await updateProfile({ tokens: (profile.tokens || 0) + rReward });
          setInput('');
          return;
        }
      }

      if (activeGtb) {
        if (normalizeAnswer(trimmed) === normalizeAnswer(activeGtb)) {
          await base44.entities.ChatMessage.create({
            user_id: profile.user_id, username: profile.username, avatar_url: profile.avatar_url || '',
            content: content || '', image_url: imageUrl || '', user_role: profile.role, game: 'icecreamet'
          });
          await sendBotMessage(`🔮 ${profile.username} guessed it! The blook was "${activeGtb}". +100 tokens!`);
          await clearGtb();
          await updateProfile({ tokens: (profile.tokens || 0) + 100 });
          setInput('');
          return;
        }
      }

      if (activeGtb2) {
        if (normalizeAnswer(trimmed) === normalizeAnswer(activeGtb2)) {
          await base44.entities.ChatMessage.create({
            user_id: profile.user_id, username: profile.username, avatar_url: profile.avatar_url || '',
            content: content || '', image_url: imageUrl || '', user_role: profile.role, game: 'icecreamet'
          });
          await sendBotMessage(`🔮 ${profile.username} guessed it! The blook was "${activeGtb2}". +100 tokens!`);
          await clearGtb2();
          await updateProfile({ tokens: (profile.tokens || 0) + 100 });
          setInput('');
          return;
        }
      }

      if (activeGtp) {
        if (normalizeAnswer(trimmed) === normalizeAnswer(activeGtp)) {
          await base44.entities.ChatMessage.create({
            user_id: profile.user_id, username: profile.username, avatar_url: profile.avatar_url || '',
            content: content || '', image_url: imageUrl || '', user_role: profile.role, game: 'icecreamet'
          });
          await sendBotMessage(`⚡ ${profile.username} guessed it! The Pokemon was "${activeGtp}". +100 tokens!`);
          await clearGtp();
          await updateProfile({ tokens: (profile.tokens || 0) + 100 });
          setInput('');
          return;
        }
      }

      // Pings: only online, existing users receive a ping notification.
      const freshPlayers = await getAllPlayers().catch(() => players);
      const nowMs = Date.now();
      const onlinePlayers = freshPlayers.filter(p => !p.is_banned && p.last_seen && nowMs - p.last_seen < 120000);
      const onlineUsernames = new Set(onlinePlayers.map(p => p.username));
      const mentionMatches = (content || '').match(/@(\w+)/g) || [];
      let mentions = mentionMatches.map(m => m.slice(1)).filter(u => u.toLowerCase() !== 'everyone' && onlineUsernames.has(u));
      if (/@everyone\b/i.test(content || '')) {
        const everyoneMentions = onlinePlayers.filter(p => p.user_id !== profile.user_id).map(p => p.username);
        mentions = [...new Set([...mentions, ...everyoneMentions])];
        const notifs = onlinePlayers.filter(p => p.user_id !== profile.user_id).map(p => ({ user_id: p.user_id, type: 'custom', title: '📢 @everyone', message: `${profile.username} pinged everyone in #global`, link: '/chat', is_read: false }));
        if (notifs.length) { try { await base44.entities.Notification.bulkCreate(notifs); } catch {} }
      }
      const replyExtra = replyingTo ? { reply_to_id: replyingTo.id, reply_to_username: replyingTo.username, reply_to_content: (replyingTo.content || '').slice(0, 100) } : {};
      await postUserMessage(content, imageUrl, { mentions: mentions.join(','), ...replyExtra });
      if (/@verity\b/i.test(content || '')) {
        handleVerityMention(content, profile).catch(() => {});
      }
      setReplyingTo(null);
      setInput('');
      clearMyTyping();
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await uploadFile(file);
    await sendMessage('', file_url);
  };

  const deleteMessage = async (msgId) => {
    await base44.entities.ChatMessage.update(msgId, { is_deleted: true });
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);
    if (val.trim()) sendTyping(); else clearMyTyping();
    const lastAt = val.lastIndexOf('@');
    if (lastAt >= 0 && lastAt === val.length - 1 - (val.length - 1 - lastAt)) {
      const after = val.slice(lastAt + 1);
      if (!after.includes(' ')) { setShowMentions(true); setMentionFilter(after.toLowerCase()); return; }
    }
    setShowMentions(false);
  };

  const insertMention = (username) => {
    const lastAt = input.lastIndexOf('@');
    setInput(input.slice(0, lastAt) + '@' + username + ' ');
    setShowMentions(false);
  };

  const canDelete = profile && ROLE_HIERARCHY[profile.role] >= ROLE_HIERARCHY.moderator;
  const isMuted = profile?.is_muted && (!profile.mute_until || new Date(profile.mute_until) > new Date());

  const blookByName = {};
  blooks.forEach(b => { blookByName[(b.name || '').toLowerCase()] = b; });
  const profileMap = {};
  players.forEach(p => { profileMap[p.user_id] = p; });
  const badgeMap = {};
  badges.forEach(b => { badgeMap[b.id] = b; });
  const userBadges = {};
  playerBadges.forEach(a => {
    const b = badgeMap[a.badge_id];
    if (b) (userBadges[a.user_id] = userBadges[a.user_id] || []).push(b);
  });

  const nowMs = Date.now();
  const onlineUsernames = new Set(players.filter(p => !p.is_banned && p.last_seen && nowMs - p.last_seen < 120000).map(p => p.username));
  const onlineCount = players.filter(p => !p.is_banned && p.last_seen && nowMs - p.last_seen < 120000).length;
  const isOnline = profile?.last_seen && Date.now() - profile.last_seen < 120000;

  const renderTextWithLinks = (text, keyPrefix) => {
    const urlRe = /(https?:\/\/[^\s]+)/g;
    const nodes = [];
    let lastIndex = 0;
    let match;
    let idx = 0;
    while ((match = urlRe.exec(text)) !== null) {
      if (match.index > lastIndex) nodes.push(<span key={`${keyPrefix}-t-${idx}`}>{text.slice(lastIndex, match.index)}</span>);
      const url = match[0];
      const isImage = /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(url);
      if (isImage) {
        nodes.push(<img key={`${keyPrefix}-img-${idx}`} src={url} alt="" className="inline-block max-h-32 rounded-lg my-1 align-middle" onError={(e) => { e.target.style.display = 'none'; }} />);
      } else {
        nodes.push(<a key={`${keyPrefix}-a-${idx}`} href={url} target="_blank" rel="noopener noreferrer" className="text-[#00BFFF] underline break-all">{url}</a>);
      }
      lastIndex = match.index + url.length;
      idx++;
    }
    if (lastIndex < text.length) nodes.push(<span key={`${keyPrefix}-t-end`}>{text.slice(lastIndex)}</span>);
    return <span key={keyPrefix}>{nodes}</span>;
  };

  const renderContent = (content) => {
    const parts = content.split(/(\*\*[^*]+\*\*|@\w+|\[[^\]]+\]|<#[0-9a-fA-F]{6}>[\s\S]*?<\/#[0-9a-fA-F]{6}>)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('@')) {
        const name = part.slice(1);
        if (name.toLowerCase() === 'everyone') return <span key={i} style={{ color: '#fbbf24' }} className="font-display">{part}</span>;
        if (onlineUsernames.has(name)) return <span key={i} style={{ color: '#00BFFF' }} className="font-display">{part}</span>;
        return <span key={i} className="text-white/90">{part}</span>;
      }
      if (part.startsWith('[') && part.endsWith(']')) {
        const b = blookByName[part.slice(1, -1).toLowerCase()];
        if (b && b.image_url) return <img key={i} src={b.image_url} alt={b.name} title={b.name} className="inline-block w-7 h-7 object-contain align-middle mx-0.5" />;
        return part;
      }
      const cm = part.match(/^<#([0-9a-fA-F]{6})>([\s\S]*)<\/#[0-9a-fA-F]{6}>$/);
      if (cm) return <span key={i} style={{ color: '#' + cm[1] }}>{cm[2]}</span>;
      return renderTextWithLinks(part, i);
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {[
            { key: 'global', label: '#global', Icon: Hash },
            { key: 'polls', label: '#polls', Icon: BarChart3 },
            { key: 'instgtb', label: '#InstGtb', Icon: Zap },
            { key: 'pulls', label: '#Pulls', Icon: Sparkles },
            { key: 'links', label: '#links', Icon: Link2 },
          ].map(t => (
            <button key={t.key} onClick={() => setChannel(t.key)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 font-display text-sm ${channel === t.key ? 'bg-[#a7fcc9] text-panel' : 'bg-panel text-white/70 hover:text-white'}`}>
              <t.Icon size={14} /> {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-panel border border-green-500/30">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-green-400 font-display">{onlineCount} online</span>
          </div>
        {profile && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-panel border border-white/10">
            <div className="w-9 h-9 avatar-rounded-square bg-white/10 overflow-hidden">
              {profile.avatar_url ? <img src={profile.avatar_url} alt="" className={`w-full h-full object-cover ${profile.shiny_avatar ? 'shiny-blook' : ''}`} /> : <div className="w-full h-full flex items-center justify-center text-xs text-white">{profile.username?.[0]?.toUpperCase()}</div>}
            </div>
            <span className="text-sm text-white font-display hidden sm:inline">{profile.username}</span>
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-gray-500'}`} />
          </div>
        )}
      </div>

      {/* Chat panel */}
      <div className="flex-1 bg-panel/80 rounded-2xl border border-white/10 overflow-hidden flex flex-col backdrop-blur-sm">
        {channel === 'global' && (<>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messagesLoading && <p className="text-primary">Loading chat...</p>}
          {messagesError && <div className="text-destructive"><p>{messagesError}</p><Button onClick={loadMessages} className="mt-2">Retry</Button></div>}
          {!messagesLoading && !messagesError && messages.length === 0 && <p className="text-primary">No messages yet.</p>}
          {messages.map(msg => {
            const isMention = msg.mentions?.split(',').includes(profile?.username);
            return (
              <div key={msg.id} className={`flex gap-4 ${isMention ? 'bg-[#00BFFF]/10 -mx-2 px-2 py-1 rounded' : ''}`}>
                 <div className={`w-14 h-14 bg-white/10 flex-shrink-0 overflow-hidden ${msg.is_system ? 'rounded-full' : 'avatar-rounded-square'}`}>
                   {msg.is_system ? <img src={botAvatar} alt="Bot" className="w-full h-full object-contain" /> : msg.avatar_url ? <img src={msg.avatar_url} alt="" className={`w-full h-full object-cover ${profileMap[msg.user_id]?.shiny_avatar ? 'shiny-blook' : ''}`} /> : <div className="w-full h-full flex items-center justify-center text-xs text-white/60">{msg.username?.[0]?.toUpperCase()}</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(() => {
                      const clan = clanByUser[msg.user_id];
                      if (!clan) return null;
                      const isRainbow = (clan.color || '').toLowerCase() === 'rainbow';
                      return <span className={`text-xs font-display px-1 rounded ${isRainbow ? 'rainbow-name' : ''}`} style={isRainbow ? { border: '1px solid #ffffff44' } : { color: clan.color || '#a7fcc9', border: `1px solid ${clan.color || '#a7fcc9'}66` }}>[{clan.name}]</span>;
                    })()}
                    {(() => {
                      const nc = profileMap[msg.user_id]?.name_color;
                      const cs = getColorStyle(nc, ROLE_HIERARCHY[msg.user_role] >= ROLE_HIERARCHY.admin);
                      const hasStyle = cs.className || Object.keys(cs.style || {}).length > 0;
                      if (hasStyle) {
                        return <span className={`text-base font-display ${cs.className}`} style={cs.style}>{msg.user_role && ROLE_BADGES[msg.user_role]} {msg.username}</span>;
                      }
                      return <span className="text-base font-display" style={{ color: ROLE_COLORS[msg.user_role] || '#a7fcc9' }}>{msg.user_role && ROLE_BADGES[msg.user_role]} {msg.username}</span>;
                    })()}
                    {(userBadges[msg.user_id] || []).map(b => <img key={b.id} src={b.image_url} alt={b.name} title={b.name} className="w-5 h-5 object-contain inline-block align-middle" />)}
                    <span className="text-[10px] text-white/30">{msg.created_date && new Date(msg.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' })}</span>
                    {!msg.is_system && <button onClick={() => setReplyingTo({ id: msg.id, username: msg.username, content: msg.content })} className="text-white/30 hover:text-[#a7fcc9]"><Reply size={12} /></button>}
                    {canDelete && !msg.is_system && <button onClick={() => deleteMessage(msg.id)} className="text-white/30 hover:text-red-400 ml-auto"><Trash2 size={12} /></button>}
                  </div>
                  {msg.reply_to_id && (
                    <div className="flex items-center gap-1.5 mb-1 pl-2 border-l-2 border-[#00BFFF]/40">
                      <Reply size={10} className="text-white/40 flex-shrink-0" />
                      <span className="text-xs text-white/50 truncate"><span className="text-[#00BFFF] font-display">{msg.reply_to_username}</span>: <span className="text-white/40">{msg.reply_to_content?.slice(0, 80)}</span></span>
                    </div>
                  )}
                  {msg.content && (() => {
                    const cc = profileMap[msg.user_id]?.chat_color;
                    const cs = getColorStyle(cc, ROLE_HIERARCHY[msg.user_role] >= ROLE_HIERARCHY.admin);
                    const hasStyle = cs.className || Object.keys(cs.style || {}).length > 0;
                    return <p className={`text-xl break-words leading-snug ${cs.className}`} style={hasStyle ? cs.style : { color: 'rgba(255,255,255,0.9)' }}>{renderContent(msg.content)}</p>;
                  })()}
                  {msg.image_url && <img src={msg.image_url} alt="" className="mt-1 max-h-48 rounded-lg" />}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {typers.length > 0 && (
          <div className="border-t border-white/10 px-4 py-1.5">
            <p className="text-xs text-white/50 italic">
              {typers.length === 1
                ? <><span className="text-[#a7fcc9] font-display">{typers[0].username}</span> is typing<span className="typing-dots">...</span></>
                : <><span className="text-[#a7fcc9] font-display">{typers.slice(0, 3).map(t => t.username).join(', ')}</span>{typers.length > 3 ? ` and ${typers.length - 3} more` : ''} are typing<span className="typing-dots">...</span></>}
            </p>
          </div>
        )}
        {/* Input */}
        <div className="border-t border-white/10 p-3 relative">
          {isMuted && <p className="text-xs text-red-400 mb-1">You are muted</p>}
          {showMentions && (
            <div className="absolute bottom-full left-3 bg-[#1a4d2e] border border-white/20 rounded-lg shadow-lg max-h-32 overflow-y-auto w-56 z-10">
              {(() => {
                const on = Date.now();
                const online = players.filter(p => p.user_id !== profile?.user_id && !p.is_banned && p.last_seen && on - p.last_seen < 120000 && p.username?.toLowerCase().includes(mentionFilter));
                if (online.length === 0) return <p className="px-3 py-2 text-xs text-white/50">No online players</p>;
                return online.slice(0, 8).map(p => (
                  <button key={p.id} onClick={() => insertMention(p.username)} className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-sm text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />{p.username}
                  </button>
                ));
              })()}
            </div>
          )}
          {showEmojis && (
            <div className="absolute bottom-full right-3 mb-1 bg-[#1a4d2e] border border-white/20 rounded-lg shadow-lg p-2 grid grid-cols-8 gap-1 z-10">
              {EMOJIS.map(e => <button key={e} onClick={() => { setInput(input + e); setShowEmojis(false); }} className="text-lg hover:bg-white/10 rounded p-1">{e}</button>)}
            </div>
          )}
          {replyingTo && (
            <div className="flex items-center gap-2 mb-1 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 text-xs">
              <Reply size={12} className="text-[#00BFFF] flex-shrink-0" />
              <span className="text-white/50 truncate">Replying to <span className="text-[#00BFFF] font-display">{replyingTo.username}</span>: <span className="text-white/40">{(replyingTo.content || '').slice(0, 60)}</span></span>
              <button onClick={() => setReplyingTo(null)} className="ml-auto text-white/40 hover:text-white flex-shrink-0"><X size={14} /></button>
            </div>
          )}
          <div className="flex gap-2 items-center bg-white/5 rounded-lg border border-white/10 px-3 py-1">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            <Input value={input} onChange={handleInputChange} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!sendingRef.current) sendMessage(input); } }}
              placeholder={isMuted ? 'You are muted' : 'Message #global'} disabled={isMuted || sending}
              maxLength={1000}
              className="flex-1 bg-transparent border-0 text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0 h-9" />
            <button onClick={() => fileInputRef.current?.click()} disabled={isMuted} className="text-white/50 hover:text-white transition-colors"><Image size={18} /></button>
            <button onClick={() => setShowEmojis(!showEmojis)} className="text-white/50 hover:text-white transition-colors"><Smile size={18} /></button>
            <Button size="icon" onClick={() => { if (!sendingRef.current) sendMessage(input); }} disabled={isMuted || sending} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
              <Send size={16} />
            </Button>
          </div>
        </div>
        </>)}
        {channel === 'polls' && (
          <div className="flex-1 overflow-y-auto p-4">
            <PollWidget />
          </div>
        )}
        {channel === 'instgtb' && (
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
    </div>
  );
}