import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import moment from 'moment';
import { useGame } from '@/lib/gameContext';
import { ROLE_HIERARCHY, RARITY_ORDER } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ImageUpload from '@/components/game/ImageUpload';
import ColorPicker from '@/components/game/ColorPicker';
import GradientColorPicker from '@/components/game/GradientColorPicker';
import ThemeCustomizer from '@/components/game/ThemeCustomizer';
import ShinyThemePicker from '@/components/game/ShinyThemePicker';
import PlaylistManager from '@/components/game/PlaylistManager';
import { User, List, Pencil, Settings as SettingsIcon, Star, LogOut, ShieldCheck, KeyRound } from 'lucide-react';
import { hashPassword, checkPassword, getStoredPasswordHash } from '@/lib/verificationQuestions';

const extractYouTubeId = (url) => {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
};

export default function Settings() {
  const { profile, updateProfile } = useGame();
  const [username, setUsername] = useState(profile?.username || '');
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [nameColor, setNameColor] = useState(profile?.name_color || '');
  const [savingColor, setSavingColor] = useState(false);
  const [chatColor, setChatColor] = useState(profile?.chat_color || '');
  const [savingChatColor, setSavingChatColor] = useState(false);
  const [emailDisconnected, setEmailDisconnected] = useState(profile?.email_disconnected || false);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [playerBlooks, setPlayerBlooks] = useState([]);
  const [allBlooks, setAllBlooks] = useState([]);
  const [blooksLoading, setBlooksLoading] = useState(true);

  const isAdmin = profile && ROLE_HIERARCHY[profile.role] >= ROLE_HIERARCHY.admin;
  const isMod = profile && ROLE_HIERARCHY[profile.role] >= ROLE_HIERARCHY.moderator;
  const isPlus = profile && (!!profile.plus_permanent || (profile.plus_until && new Date(profile.plus_until) > new Date()));
  const isProfileLocked = !!profile?.profile_locked;
  const hasGradient = !!profile?.gradient_unlocked;
  const canAffordGradient = (profile?.tokens || 0) >= 10000000;
  const [buyingGradient, setBuyingGradient] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(profile?.music_enabled !== false);
  const [bartPopup, setBartPopup] = useState(profile?.bart_popup_enabled !== false);
  const [icecreamyPopup, setIcecreamyPopup] = useState(profile?.icecreamy_popup_enabled !== false);
  const [musicUrl, setMusicUrl] = useState('');
  const [settingMusic, setSettingMusic] = useState(false);

  const buyGradient = async () => {
    if (!canAffordGradient || hasGradient || buyingGradient) return;
    setBuyingGradient(true);
    try {
      await updateProfile({ tokens: (profile.tokens || 0) - 10000000, gradient_unlocked: true });
    } catch (e) {
      alert('Failed to purchase gradient colors: ' + (e.message || 'unknown error'));
    }
    setBuyingGradient(false);
  };

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [pb, ab] = await Promise.all([
        base44.entities.PlayerBlook.filter({ user_id: profile.user_id }),
        base44.entities.Blook.filter({ is_active: true, is_deleted: false })
      ]);
      setPlayerBlooks(pb);
      setAllBlooks(ab);
      setBlooksLoading(false);
    })();
  }, [profile?.user_id]);

  const blookMap = {};
  allBlooks.forEach(b => { blookMap[b.id] = b; });
  const rarityIndex = (r) => { const i = RARITY_ORDER.indexOf(r); return i === -1 ? 99 : i; };
  const ownedBlooks = playerBlooks
    .map(pb => ({ ...blookMap[pb.blook_id], quantity: pb.quantity }))
    .filter(b => b && b.image_url)
    .sort((a, b) => rarityIndex(a.rarity) - rarityIndex(b.rarity));

  const saveUsername = async () => {
    if (!username.trim() || username.trim().length < 3) return;
    if (username.trim() === profile.username) return;
    setSaving(true);
    const oldUsername = profile.username;
    await updateProfile({ username: username.trim() });
    try { await base44.entities.UsernameChange.create({ user_id: profile.user_id, old_username: oldUsername, new_username: username.trim() }); } catch (e) {}
    setSaving(false);
  };

  const saveAvatar = async () => {
    setSavingAvatar(true);
    await updateProfile({ avatar_url: avatarUrl });
    setSavingAvatar(false);
  };

  const pickBlookAvatar = async (blook) => {
    setSavingAvatar(true);
    setAvatarUrl(blook.image_url);
    await updateProfile({ avatar_url: blook.image_url });
    setSavingAvatar(false);
  };

  const saveNameColor = async () => {
    setSavingColor(true);
    await updateProfile({ name_color: nameColor });
    setSavingColor(false);
  };

  const saveChatColor = async () => {
    setSavingChatColor(true);
    await updateProfile({ chat_color: chatColor });
    setSavingChatColor(false);
  };

  const clearAvatar = async () => {
    setSavingAvatar(true);
    setAvatarUrl('');
    await updateProfile({ avatar_url: '' });
    setSavingAvatar(false);
  };

  const toggleSetting = async (key, current, setter) => {
    const next = !current;
    setter(next);
    await updateProfile({ [key]: next });
  };

  const setCustomMusic = async () => {
    const ytId = extractYouTubeId(musicUrl);
    if (!ytId) { alert('Please paste a valid YouTube URL.'); return; }
    if ((profile?.tokens || 0) < 100000) { alert('You need 100,000 tokens to change the lobby music.'); return; }
    setSettingMusic(true);
    try {
      await updateProfile({ custom_music_yt_id: ytId, tokens: (profile.tokens || 0) - 100000 });
      setMusicUrl('');
      alert('Lobby music updated! It will start playing on your next page load.');
    } catch (e) {
      alert('Failed to set music: ' + (e.message || 'unknown error'));
    }
    setSettingMusic(false);
  };

  const toggleEmailDisconnect = async () => {
    const next = !emailDisconnected;
    setEmailDisconnected(next);
    await updateProfile({ email_disconnected: next });
  };

  const changePassword = async () => {
    if (!profile) return;
    if (!newPw || newPw.length < 4) { alert('New password must be at least 4 characters.'); return; }
    if (newPw !== confirmPw) { alert('New passwords do not match.'); return; }
    const storedHash = getStoredPasswordHash(profile);
    if (storedHash) {
      const ok = await checkPassword(curPw, storedHash);
      if (!ok) { alert('Current security password is incorrect.'); return; }
    }
    setPwSaving(true);
    try {
      const hash = await hashPassword(newPw);
      const hours = 3 + Math.floor(Math.random() * 3);
      const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      await updateProfile({ verification_answers: JSON.stringify([hash]), verified_until: until });
      setCurPw(''); setNewPw(''); setConfirmPw('');
      alert('Security password updated!');
    } catch (e) {
      alert('Failed to update password: ' + (e.message || 'unknown error'));
    }
    setPwSaving(false);
  };

  const sendLoginReset = async () => {
    setSendingReset(true);
    try {
      const me = await base44.auth.me();
      if (!me?.email) { alert('Could not find your email address.'); return; }
      await base44.auth.resetPasswordRequest(me.email);
      setResetSent(true);
    } catch (e) {
      alert('Failed to send reset email: ' + (e.message || 'unknown error'));
    }
    setSendingReset(false);
  };

  const handleLogout = () => {
    base44.auth.logout('/login');
  };

  if (!profile) return null;

  return (
    <div>
      <h2 className="text-2xl font-display text-panel mb-6">Settings</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        {/* Profile */}
        <div className="bg-panel rounded-2xl border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <User size={16} className="text-[#a7fcc9]" />
            <h3 className="font-display text-white">Profile</h3>
          </div>
          <div className="space-y-1.5 text-sm">
            <p className="text-white"><span className="text-white/50">Username:</span> {profile.username}</p>
            <p className="text-white capitalize"><span className="text-white/50">Role:</span> {profile.role}</p>
            <p className="text-white"><span className="text-white/50">Joined:</span> {profile.join_date ? moment(profile.join_date).format('M/D/YYYY h:mm:ss A') : '—'}</p>
          </div>
        </div>

        {/* Plan */}
        <div className="bg-panel rounded-2xl border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <List size={16} className="text-[#a7fcc9]" />
            <h3 className="font-display text-white">Plan</h3>
          </div>
          {isPlus ? (
            <p className="text-sm text-white">ICECREAMET <span className="plus-rainbow">Plus</span></p>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/70">Free Plan</p>
              <Button size="sm" asChild style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}><Link to="/plus">Get Plus</Link></Button>
            </div>
          )}
        </div>

        {/* Edit Info */}
        <div className="bg-panel rounded-2xl border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Pencil size={16} className="text-[#a7fcc9]" />
            <h3 className="font-display text-white">Edit Info</h3>
          </div>
          <div className="space-y-3">
            {isProfileLocked && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 mb-1">
                <p className="text-xs text-red-400">🔒 Your profile is locked by staff. You can't change your username, avatar, or name color. Ask a co-owner+ to unlock it.</p>
              </div>
            )}
            <div>
              <p className="text-xs text-white/50 mb-1">Change Username</p>
              <div className="flex gap-2">
                <Input value={username} onChange={e => setUsername(e.target.value)} maxLength={20} disabled={isProfileLocked} className="bg-white/10 border-white/20 text-white placeholder:text-white/40 disabled:opacity-50" />
                <Button onClick={saveUsername} disabled={isProfileLocked || saving || username.trim().length < 3 || username === profile.username} style={{ backgroundColor: 'rgb(var(--user-sidebar))' }}>{saving ? 'Saving...' : 'Save'}</Button>
              </div>
            </div>
            {isAdmin && !isProfileLocked ? (
              <div>
                <p className="text-xs text-white/50 mb-1">Change Avatar</p>
                <ImageUpload label="" value={avatarUrl} onChange={setAvatarUrl} />
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={saveAvatar} disabled={savingAvatar || avatarUrl === (profile.avatar_url || '')} style={{ backgroundColor: 'rgb(var(--user-sidebar))' }}>{savingAvatar ? 'Saving...' : 'Save Avatar'}</Button>
                  {avatarUrl && <Button size="sm" variant="outline" onClick={clearAvatar} className="border-white/20 text-white">Remove</Button>}
                </div>
              </div>
            ) : (
              <p className="text-xs text-white/50">{isProfileLocked ? '🔒 Avatar locked by staff' : <>Change Avatar — pick a blook on the <Link to="/stats" className="underline text-[#a7fcc9]">Stats page</Link></>}</p>
            )}
          </div>
        </div>

        {/* General */}
        <div className="bg-panel rounded-2xl border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <SettingsIcon size={16} className="text-[#a7fcc9]" />
            <h3 className="font-display text-white">General</h3>
          </div>
          <Button variant="outline" onClick={handleLogout} className="text-red-400 border-red-500/30 hover:bg-red-500/10 w-full"><LogOut size={14} className="mr-2" /> Log Out</Button>
          <Button asChild variant="outline" className="mt-2 w-full border-yellow-400/40 text-yellow-300 hover:bg-yellow-400/10"><Link to="/flabby-pird">🐦 FLABBY PIRD V2</Link></Button>
        </div>

        {/* Game Settings */}
        <div className="bg-panel rounded-2xl border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <SettingsIcon size={16} className="text-[#a7fcc9]" />
            <h3 className="font-display text-white">Game Settings</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-white">🎵 Background Music</p>
                <p className="text-xs text-white/50">Play gentle ambient music while you play.</p>
              </div>
              <button onClick={() => toggleSetting('music_enabled', musicEnabled, setMusicEnabled)} className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${musicEnabled ? 'bg-[#a7fcc9]' : 'bg-white/20'} relative`}><span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${musicEnabled ? 'left-6' : 'left-0.5'}`} /></button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-white">🎯 Click the Bart Popup</p>
                <p className="text-xs text-white/50">Show the Click the Bart event popup.</p>
              </div>
              <button onClick={() => toggleSetting('bart_popup_enabled', bartPopup, setBartPopup)} className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${bartPopup ? 'bg-[#a7fcc9]' : 'bg-white/20'} relative`}><span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${bartPopup ? 'left-6' : 'left-0.5'}`} /></button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-white">🧊 Icecreamy Drop Popup</p>
                <p className="text-xs text-white/50">Show the Icecreamy Drop event popup.</p>
              </div>
              <button onClick={() => toggleSetting('icecreamy_popup_enabled', icecreamyPopup, setIcecreamyPopup)} className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${icecreamyPopup ? 'bg-[#a7fcc9]' : 'bg-white/20'} relative`}><span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${icecreamyPopup ? 'left-6' : 'left-0.5'}`} /></button>
            </div>
          </div>
        </div>

        {/* Custom Lobby Music */}
        <div className="bg-panel rounded-2xl border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🎵</span>
            <h3 className="font-display text-white">Custom Lobby Music</h3>
          </div>
          <p className="text-xs text-white/50 mb-3">Set any YouTube video as your lobby background music. Costs <span className="text-[#a7fcc9] font-display">100,000 tokens</span> each time you change it.</p>
          {profile?.custom_music_yt_id && (
            <div className="bg-white/5 rounded-lg p-2 mb-3 flex items-center gap-2">
              <img src={`https://img.youtube.com/vi/${profile.custom_music_yt_id}/default.jpg`} alt="" className="w-10 h-10 rounded object-cover" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/70">Current: <a href={`https://youtu.be/${profile.custom_music_yt_id}`} target="_blank" rel="noopener noreferrer" className="text-[#a7fcc9] underline">YouTube video</a></p>
                <p className="text-[10px] text-white/40">Changing it costs another 100,000 tokens.</p>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Input value={musicUrl} onChange={e => setMusicUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="bg-white/10 border-white/20 text-white placeholder:text-white/40" />
            <Button size="sm" onClick={setCustomMusic} disabled={settingMusic || !musicUrl.trim() || (profile?.tokens || 0) < 100000} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>{settingMusic ? 'Setting...' : 'Set (100K)'}</Button>
          </div>
          <p className="text-[10px] text-white/40 mt-2">Your balance: {(profile?.tokens || 0).toLocaleString()} tokens</p>
        </div>

        {/* Music Playlist */}
        <PlaylistManager />

        {/* Email & Privacy */}
        <div className="bg-panel rounded-2xl border border-white/10 p-4 md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={16} className="text-[#a7fcc9]" />
            <h3 className="font-display text-white">Email & Privacy</h3>
          </div>
          <ul className="text-sm text-white/70 space-y-2">
            <li>🔒 The game never shows your email to anyone — profiles, settings, and staff tools only ever show your username.</li>
            <li>🧊 Your blooks, tokens, and progress are saved under your account — they aren't tied to your email being visible.</li>
            <li>🔑 Your email is only used to sign you in. To log in without typing your email, use <span className="text-[#a7fcc9]">Continue with Google</span> on the login page.</li>
            <li>⚠️ Your email is your login credential, so it can't be deleted without deleting the account — but it's never visible inside the game.</li>
          </ul>
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm">
              <p className="text-white font-display">Disconnect my email</p>
              <p className="text-xs text-white/50">Hides your email from the game and opts you out of any email-based features. Your email stays with the login system so you can still sign in.</p>
            </div>
            <Button size="sm" onClick={toggleEmailDisconnect} variant={emailDisconnected ? 'outline' : 'default'} style={emailDisconnected ? {} : { backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
              {emailDisconnected ? 'Email disconnected ✓' : 'Disconnect email'}
            </Button>
          </div>
        </div>

        {/* Security Password */}
        <div className="bg-panel rounded-2xl border border-white/10 p-4 md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <KeyRound size={16} className="text-[#a7fcc9]" />
            <h3 className="font-display text-white">Security Password</h3>
          </div>
          <p className="text-xs text-white/50 mb-3">
            {getStoredPasswordHash(profile)
              ? "Change the second password you enter during periodic security checks."
              : "You haven't set a security password yet. You'll be asked to create one on your next security check."}
          </p>
          <div className="space-y-3 max-w-sm">
            {getStoredPasswordHash(profile) && (
              <div>
                <p className="text-xs text-white/50 mb-1">Current password</p>
                <Input type="password" value={curPw} onChange={e => setCurPw(e.target.value)} placeholder="••••••••" className="bg-white/10 border-white/20 text-white placeholder:text-white/40" />
              </div>
            )}
            <div>
              <p className="text-xs text-white/50 mb-1">New password</p>
              <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="••••••••" className="bg-white/10 border-white/20 text-white placeholder:text-white/40" />
            </div>
            <div>
              <p className="text-xs text-white/50 mb-1">Confirm new password</p>
              <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="••••••••" className="bg-white/10 border-white/20 text-white placeholder:text-white/40" />
            </div>
            <Button size="sm" onClick={changePassword} disabled={pwSaving || !newPw || !confirmPw || (getStoredPasswordHash(profile) && !curPw)} style={{ backgroundColor: 'rgb(var(--user-sidebar))' }}>{pwSaving ? 'Saving...' : 'Update Password'}</Button>
          </div>
        </div>

        {/* Login Password */}
        <div className="bg-panel rounded-2xl border border-white/10 p-4 md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <KeyRound size={16} className="text-[#a7fcc9]" />
            <h3 className="font-display text-white">Login Password</h3>
          </div>
          <p className="text-xs text-white/50 mb-3">
            This is the password you use to sign in. To change it, we'll send a secure reset link to your account email — follow the link to set a new password.
          </p>
          {resetSent ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
              <p className="text-sm text-green-400">✓ Reset link sent! Check your email and follow the link to set a new password.</p>
              <Button size="sm" variant="outline" onClick={() => setResetSent(false)} className="mt-2 border-white/20 text-white">Send again</Button>
            </div>
          ) : (
            <Button size="sm" onClick={sendLoginReset} disabled={sendingReset} style={{ backgroundColor: 'rgb(var(--user-sidebar))' }}>
              {sendingReset ? 'Sending...' : 'Send Reset Link'}
            </Button>
          )}
        </div>

        {/* Plus Settings */}
        {isPlus && (
          <div className="bg-panel rounded-2xl border border-white/10 p-4 md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <Star size={16} className="text-[#a7fcc9]" />
              <h3 className="font-display text-white">Plus Settings</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isMod && !isProfileLocked && (
                <div>
                  <p className="text-xs text-white/50 mb-2">Change Username Color</p>
                  <ColorPicker value={nameColor} onChange={setNameColor} allowRainbow={isAdmin} />
                  <Button size="sm" onClick={saveNameColor} disabled={savingColor} style={{ backgroundColor: 'rgb(var(--user-sidebar))' }} className="mt-2">{savingColor ? 'Saving...' : 'Save Color'}</Button>
                </div>
              )}
              {!isProfileLocked && (
                <div>
                  <p className="text-xs text-white/50 mb-2">Chat Message Color</p>
                  <ColorPicker value={chatColor} onChange={setChatColor} allowRainbow={isAdmin} />
                  <Button size="sm" onClick={saveChatColor} disabled={savingChatColor} style={{ backgroundColor: 'rgb(var(--user-sidebar))' }} className="mt-2">{savingChatColor ? 'Saving...' : 'Save Color'}</Button>
                </div>
              )}
              <div>
                <p className="text-xs text-white/50 mb-2">Theme</p>
                <ThemeCustomizer />
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-white/50 mb-2">Shiny Blook Theme</p>
                <ShinyThemePicker />
              </div>
            </div>
          </div>
        )}

        {/* Gradient Colors — Plus benefit or 10M token purchase */}
        {(isPlus || hasGradient || canAffordGradient) && (
          <div className="bg-panel rounded-2xl border border-white/10 p-4 md:col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">🌈</span>
              <h3 className="font-display text-white">Gradient Colors</h3>
            </div>
            {(isPlus || hasGradient) ? (
              <>
                <p className="text-xs text-white/50 mb-3">{isPlus ? 'Plus benefit! Pick gradient colors for your username and chat messages.' : 'Unlocked! Pick gradient colors for your username and chat messages.'}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {!isProfileLocked && (
                    <div>
                      <p className="text-xs text-white/50 mb-2">Username Gradient</p>
                      <GradientColorPicker value={nameColor} onChange={setNameColor} />
                      <Button size="sm" onClick={saveNameColor} disabled={savingColor} style={{ backgroundColor: 'rgb(var(--user-sidebar))' }} className="mt-2">{savingColor ? 'Saving...' : 'Save Gradient'}</Button>
                    </div>
                  )}
                  {!isProfileLocked && (
                    <div>
                      <p className="text-xs text-white/50 mb-2">Chat Message Gradient</p>
                      <GradientColorPicker value={chatColor} onChange={setChatColor} />
                      <Button size="sm" onClick={saveChatColor} disabled={savingChatColor} style={{ backgroundColor: 'rgb(var(--user-sidebar))' }} className="mt-2">{savingChatColor ? 'Saving...' : 'Save Gradient'}</Button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-white/50">Unlock gradient username & chat colors permanently for 10,000,000 tokens — or get Plus to access them for free.</p>
                <Button size="sm" onClick={buyGradient} disabled={buyingGradient} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>{buyingGradient ? 'Purchasing...' : 'Buy for 10M Tokens'}</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}