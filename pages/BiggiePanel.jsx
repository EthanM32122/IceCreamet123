import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { biggieAction, hasBiggieAccess } from '@/lib/biggieAction';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sandwich, Gift, Lock, Palette, Image as ImageIcon, Type, Loader2, UtensilsCrossed } from 'lucide-react';

const CHEESEBURGER_IMG = 'https://ac.blooket.com/marketassets/blooks/cheeseburger.svg';
const EAT_COOLDOWN = 600000;

const TROLLS = [
  { type: 'rain', label: 'Burger Rain', icon: '🍔' },
  { type: 'flip', label: 'Flip Screen', icon: '🔄' },
  { type: 'quake', label: 'Earthquake', icon: '🫨' },
  { type: 'fog', label: 'Burger Fog', icon: '🌫️' },
  { type: 'disco', label: 'Disco Mode', icon: '🪩' },
];

export default function BiggiePanel() {
  const { profile } = useGame();
  const [targetUser, setTargetUser] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [forcedList, setForcedList] = useState([]);
  const [loadingAction, setLoadingAction] = useState(null);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('info');
  const [targetBlooks, setTargetBlooks] = useState([]);
  const [selectedBlook, setSelectedBlook] = useState('');
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [loadingBlooks, setLoadingBlooks] = useState(false);
  const [eatQuantity, setEatQuantity] = useState(1);
  const [hasPanelAccess, setHasPanelAccess] = useState(false);
  const [loadingAccess, setLoadingAccess] = useState(true);

  // Helper: call biggieAction (backend function with a client-side fallback
  // so the panel works even while integration credits are exhausted)
  const biggieCall = async (payload) => {
    const res = await biggieAction(profile, payload);
    if (res?.error) throw new Error(res.error);
    return res;
  };

  // Check access (works without backend functions via the client-side fallback)
  const checkAccess = async () => {
    for (let i = 0; i < 3; i++) {
      try {
        const has = await hasBiggieAccess(profile);
        setHasPanelAccess(!!has);
        setLoadingAccess(false);
        return;
      } catch (e) {
        if (i < 2) await new Promise(r => setTimeout(r, 1500));
      }
    }
    setLoadingAccess(false);
  };

  const loadForced = async () => {
    try {
      const res = await biggieCall({ action: 'load_forced' });
      setForcedList(res.list || []);
    } catch (e) {}
  };

  useEffect(() => { checkAccess(); }, []);

  useEffect(() => {
    if (!hasPanelAccess) return;
    loadForced();
    const checkCooldown = async () => {
      try {
        const settings = await base44.entities.GameSettings.filter({ key: 'biggie_last_eat' });
        const lastEat = parseInt(settings[0]?.value || '0');
        const remaining = EAT_COOLDOWN - (Date.now() - lastEat);
        setCooldownRemaining(remaining > 0 ? remaining : 0);
      } catch (e) {}
    };
    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, [hasPanelAccess]);

  const guard = () => {
    if (!targetUser.trim()) { setMessage('Enter a username first'); setMsgType('error'); return false; }
    if (targetUser.toLowerCase().trim() === 'icecreamy') { setMessage('❌ icecreamy is immune!'); setMsgType('error'); return false; }
    return true;
  };

  const run = async (actionName, fn) => {
    if (!guard()) return;
    setLoadingAction(actionName); setMessage('');
    try {
      const result = await fn();
      setMessage(result.message || 'Done!');
      setMsgType('success');
      if (actionName === 'force') loadForced();
    } catch (e) {
      setMessage(e.message || 'Error');
      setMsgType('error');
    }
    setLoadingAction(null);
  };

  const giveCheeseburgers = async () => {
    const res = await biggieCall({ action: 'give_cheeseburgers', target_username: targetUser, quantity });
    return res;
  };

  const toggleForce = async () => {
    const lower = targetUser.toLowerCase().trim();
    const isForced = forcedList.includes(lower);
    const res = await biggieCall({ action: 'force_pulls', target_username: targetUser, enable: !isForced });
    return { message: isForced ? `Unforced ${targetUser}` : `🔒 ${targetUser} now pulls Cheeseburgers from EVERY pack!` };
  };

  const giveTheme = async () => {
    return await biggieCall({ action: 'give_theme', target_username: targetUser });
  };

  const setAvatar = async () => {
    return await biggieCall({ action: 'set_avatar', target_username: targetUser, avatar_url: CHEESEBURGER_IMG });
  };

  const setNameColor = async () => {
    return await biggieCall({ action: 'set_name_color', target_username: targetUser, color: '#FFD700' });
  };

  const loadTargetBlooks = async () => {
    if (!guard()) return;
    setLoadingBlooks(true); setMessage('');
    try {
      const res = await biggieCall({ action: 'load_blooks', target_username: targetUser });
      setTargetBlooks(res.blooks || []);
      setSelectedBlook('');
    } catch (e) {
      setMessage(e.message || 'Error loading blooks'); setMsgType('error');
    }
    setLoadingBlooks(false);
  };

  const eatBlook = async () => {
    if (!selectedBlook) { setMessage('Select a blook to eat first'); setMsgType('error'); return; }
    if (cooldownRemaining > 0) { setMessage('⏳ Cooldown active!'); setMsgType('error'); return; }
    setLoadingAction('eat'); setMessage('');
    try {
      const res = await biggieCall({ action: 'eat_blook', target_username: targetUser, player_blook_id: selectedBlook, quantity: eatQuantity });
      setMessage(res.message || 'Done!');
      setMsgType('success');
      setCooldownRemaining(EAT_COOLDOWN);
      setSelectedBlook('');
      loadTargetBlooks();
    } catch (e) {
      setMessage(e.message || 'Error'); setMsgType('error');
    }
    setLoadingAction(null);
  };

  const troll = async (trollType) => {
    if (!guard()) return;
    setLoadingAction('troll_' + trollType); setMessage('');
    try {
      const res = await biggieCall({ action: 'troll', target_username: targetUser, troll_type: trollType });
      setMessage(res.message || 'Done!');
      setMsgType('success');
    } catch (e) {
      setMessage(e.message || 'Error'); setMsgType('error');
    }
    setLoadingAction(null);
  };

  if (!profile || loadingAccess) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-panel/30 border-t-panel rounded-full animate-spin" /></div>;
  }

  if (!hasPanelAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Sandwich size={48} className="mx-auto mb-4 text-amber-500" />
          <p className="text-xl font-display text-white/60">Access Denied</p>
          <p className="text-sm text-white/40 mt-1">Only phantom_grip and approved users can access the Biggie Panel</p>
        </div>
      </div>
    );
  }

  // Any Biggie Panel user can eat blooks (not just phantom_grip)
  const canEatBlooks = hasPanelAccess;
  const isForced = forcedList.includes(targetUser.toLowerCase().trim());
  const btn = (action) => loadingAction === action;
  const cooldownMins = Math.floor(cooldownRemaining / 60000);
  const cooldownSecs = Math.floor((cooldownRemaining % 60000) / 1000);

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-14 h-14 rounded-xl overflow-hidden bg-amber-900/30 flex items-center justify-center">
          <img src={CHEESEBURGER_IMG} alt="BiggiCheezlet" className="w-full h-full object-contain" />
        </div>
        <div>
          <h1 className="text-3xl font-display text-[#a7fcc9]">Biggie Panel</h1>
          <p className="text-sm text-white/60">phantom_grip's exclusive cheeseburger powers</p>
        </div>
      </div>

      {/* BIGGIE PANEL FEATURES */}
        <>
          <div className="bg-card/90 rounded-xl p-5 mb-6 border border-border">
            <label className="text-sm font-medium mb-2 block">Target Username</label>
            <Input value={targetUser} onChange={e => setTargetUser(e.target.value)} placeholder="Enter username..." />
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-card/90 rounded-xl p-5 border border-border">
              <Sandwich className="text-amber-500 mb-2" size={28} />
              <h3 className="font-display text-lg mb-2">Give Cheeseburgers</h3>
              <Input type="number" min="1" max="99999" value={quantity} onChange={e => setQuantity(Math.max(1, Math.min(99999, +e.target.value || 1)))} className="mb-3" />
              <Button onClick={() => run('give', giveCheeseburgers)} disabled={btn('give')} className="w-full bg-amber-500 hover:bg-amber-600 text-white">
                {btn('give') ? <Loader2 size={16} className="animate-spin" /> : <Gift size={16} className="mr-1" />} Give {quantity.toLocaleString()}
              </Button>
            </div>

            <div className="bg-card/90 rounded-xl p-5 border border-border">
              <Lock className="text-red-500 mb-2" size={28} />
              <h3 className="font-display text-lg mb-2">Force Cheeseburger Pulls</h3>
              <p className="text-xs text-muted-foreground mb-3">{isForced ? '🔒 FORCED on ALL packs' : 'Not forced — normal pulls'}</p>
              <Button onClick={() => run('force', toggleForce)} disabled={btn('force')} className={`w-full ${isForced ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white`}>
                {btn('force') ? <Loader2 size={16} className="animate-spin" /> : isForced ? 'Remove Force' : 'Force ALL Packs'}
              </Button>
            </div>

            <div className="bg-card/90 rounded-xl p-5 border border-border">
              <Palette className="text-purple-500 mb-2" size={28} />
              <h3 className="font-display text-lg mb-2">Give Cheeseburger Theme</h3>
              <p className="text-xs text-muted-foreground mb-3">Apply the cheeseburger background</p>
              <Button onClick={() => run('theme', giveTheme)} disabled={btn('theme')} className="w-full bg-purple-500 hover:bg-purple-600 text-white">
                {btn('theme') ? <Loader2 size={16} className="animate-spin" /> : <Palette size={16} className="mr-1" />} Give Theme
              </Button>
            </div>

            <div className="bg-card/90 rounded-xl p-5 border border-border">
              <ImageIcon className="text-orange-500 mb-2" size={28} />
              <h3 className="font-display text-lg mb-2">Set Cheeseburger Avatar</h3>
              <p className="text-xs text-muted-foreground mb-3">Replace their avatar with a cheeseburger</p>
              <Button onClick={() => run('avatar', setAvatar)} disabled={btn('avatar')} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                {btn('avatar') ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} className="mr-1" />} Set Avatar
              </Button>
            </div>

            <div className="bg-card/90 rounded-xl p-5 border border-border">
              <Type className="text-yellow-500 mb-2" size={28} />
              <h3 className="font-display text-lg mb-2">Golden Name Color</h3>
              <p className="text-xs text-muted-foreground mb-3">Set their name color to cheeseburger gold</p>
              <Button onClick={() => run('color', setNameColor)} disabled={btn('color')} className="w-full bg-yellow-500 hover:bg-yellow-600 text-black">
                {btn('color') ? <Loader2 size={16} className="animate-spin" /> : <Type size={16} className="mr-1" />} Set Color
              </Button>
            </div>
          </div>

          <div className="bg-card/90 rounded-xl p-5 border border-purple-500/40 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🎭</span>
              <h3 className="font-display text-xl">Trolling Features</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Trigger visual effects on the target's screen. No cooldown — troll away!</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
              {TROLLS.map(t => (
                <button key={t.type} onClick={() => troll(t.type)} disabled={btn('troll_' + t.type) || !targetUser.trim()}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg border border-border hover:border-purple-500/50 hover:bg-purple-500/10 transition-colors disabled:opacity-50">
                  {btn('troll_' + t.type) ? <Loader2 size={24} className="animate-spin text-purple-500" /> : <span className="text-3xl">{t.icon}</span>}
                  <span className="text-xs font-medium text-center">{t.label}</span>
                </button>
              ))}
            </div>
            <Button onClick={() => troll('sit')} disabled={btn('troll_sit') || !targetUser.trim()} className="w-full bg-red-600 hover:bg-red-700 text-white">
              {btn('troll_sit') ? <Loader2 size={16} className="animate-spin" /> : '🫃 Sit On Them (10 min squish!)'}
            </Button>
          </div>

          {canEatBlooks && (
          <div className="bg-card/90 rounded-xl p-5 border border-red-500/40 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <UtensilsCrossed className="text-red-500" size={28} />
              <h3 className="font-display text-xl">Eat Someone's Blook</h3>
              {cooldownRemaining > 0 && <span className="ml-auto text-sm text-red-400 font-mono">⏳ {cooldownMins}m {cooldownSecs}s</span>}
            </div>
            <p className="text-xs text-muted-foreground mb-4">Devour another player's blook! A cutscene plays for everyone. 10-minute cooldown.</p>
            <div className="flex gap-2 mb-4">
              <Button onClick={loadTargetBlooks} disabled={loadingBlooks || !targetUser.trim()} variant="outline" className="border-amber-500/40 flex-1">
                {loadingBlooks ? <Loader2 size={16} className="animate-spin" /> : '🔍 Load Their Blooks'}
              </Button>
              <div className="flex items-center gap-1 px-3 rounded-md border border-border">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Eat:</span>
                <Input type="number" min="1" max="999" value={eatQuantity} onChange={e => setEatQuantity(Math.max(1, Math.min(999, +e.target.value || 1)))} className="w-16 h-8 border-0" />
              </div>
            </div>
            {targetBlooks.length > 0 && (
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Select a blook to eat:</label>
                <div className="max-h-48 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-2">
                  {targetBlooks.map(b => (
                    <button key={b.playerBlookId} onClick={() => setSelectedBlook(b.playerBlookId)}
                      className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${selectedBlook === b.playerBlookId ? 'border-red-500 bg-red-500/20' : 'border-border hover:border-red-500/50'}`}>
                      <img src={b.image} alt={b.name} className="w-8 h-8 object-contain rounded" />
                      <div className="text-left flex-1 min-w-0">
                        <p className="text-xs truncate">{b.name}</p>
                        <p className="text-xs text-muted-foreground">x{b.quantity}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {targetBlooks.length === 0 && !loadingBlooks && targetUser && (
              <p className="text-sm text-muted-foreground mb-4">Click "Load Their Blooks" to see their inventory.</p>
            )}
            <Button onClick={eatBlook} disabled={btn('eat') || !selectedBlook || cooldownRemaining > 0} className="w-full bg-red-500 hover:bg-red-600 text-white">
              {btn('eat') ? <Loader2 size={16} className="animate-spin" /> : <UtensilsCrossed size={16} className="mr-1" />}
              {cooldownRemaining > 0 ? `Cooldown (${cooldownMins}m ${cooldownSecs}s)` : `🍔 Eat ${eatQuantity > 1 ? eatQuantity + 'x ' : ''}Blook!`}
            </Button>
          </div>
          )}

          {forcedList.length > 0 && (
            <div className="bg-card/90 rounded-xl p-5 border border-border">
              <h3 className="font-display text-lg mb-3">🔒 Forced Cheeseburger Users</h3>
              <div className="flex flex-wrap gap-2">
                {forcedList.map(u => (
                  <span key={u} className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-sm">{u}</span>
                ))}
              </div>
            </div>
          )}
        </>

      {message && (
        <div className={`rounded-xl p-4 border mb-4 ${msgType === 'success' ? 'bg-green-500/10 border-green-500/40 text-green-400' : 'bg-red-500/10 border-red-500/40 text-red-400'}`}>
          <p className="text-sm font-medium">{message}</p>
        </div>
      )}
    </div>
  );
}