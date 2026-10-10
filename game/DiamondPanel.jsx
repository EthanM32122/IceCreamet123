import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Gem } from 'lucide-react';
import { COINS_PER_DIAMOND } from '@/lib/constants';
import { DiamondIcon, TokenIcon } from '@/components/game/CurrencyIcon';

export default function DiamondPanel() {
  const { profile, updateProfile, addDiamonds } = useGame();
  const [convAmount, setConvAmount] = useState(1);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { type: 'ok'|'err', text }

  if (!profile) return null;

  const diamonds = profile.diamonds || 0;
  const convCost = convAmount * COINS_PER_DIAMOND;

  const convert = async () => {
    const n = Math.max(1, Math.min(100000, parseInt(convAmount) || 1));
    const cost = n * COINS_PER_DIAMOND;
    if ((profile.tokens || 0) < cost) {
      setMsg({ type: 'err', text: `You need 🪙 ${cost.toLocaleString()} to buy ${n} 💎` });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await updateProfile({
        tokens: (profile.tokens || 0) - cost,
        diamonds: Math.round(((profile.diamonds || 0) + n) * 100) / 100
      });
      setMsg({ type: 'ok', text: `Converted 🪙 ${cost.toLocaleString()} into 💎 ${n}!` });
    } catch (e) {
      setMsg({ type: 'err', text: 'Conversion failed. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  const redeem = async () => {
    const c = code.trim();
    if (!c) return;
    setBusy(true);
    setMsg(null);
    try {
      const matches = await base44.entities.RedeemCode.filter({ code: c, is_active: true });
      if (matches.length === 0) {
        setMsg({ type: 'err', text: 'Invalid or expired code.' });
        setBusy(false);
        return;
      }
      const rc = matches[0];
      if (rc.max_uses > 0 && (rc.uses_count || 0) >= rc.max_uses) {
        setMsg({ type: 'err', text: 'This code has reached its use limit.' });
        setBusy(false);
        return;
      }
      const already = await base44.entities.CodeRedemption.filter({ code_id: rc.id, user_id: profile.user_id });
      if (rc.is_weekly) {
        const latest = already.reduce((m, r) => !m || new Date(r.created_date) > new Date(m.created_date) ? r : m, null);
        if (latest) {
          const elapsed = Date.now() - new Date(latest.created_date).getTime();
          const weekMs = 7 * 24 * 60 * 60 * 1000;
          if (elapsed < weekMs) {
            const daysLeft = Math.max(1, Math.ceil((weekMs - elapsed) / (24 * 60 * 60 * 1000)));
            setMsg({ type: 'err', text: `Already claimed this week — try again in ~${daysLeft} day(s)!` });
            setBusy(false);
            return;
          }
        }
      } else if (already.length > 0) {
        setMsg({ type: 'err', text: 'You already redeemed this code.' });
        setBusy(false);
        return;
      }

      // Grant the prize
      let prizeText = '';
      if (rc.prize_type === 'tokens') {
        await updateProfile({ tokens: (profile.tokens || 0) + (rc.prize_amount || 0) });
        prizeText = `🪙 ${rc.prize_amount.toLocaleString()} tokens`;
      } else if (rc.prize_type === 'diamonds') {
        await addDiamonds(rc.prize_amount || 0);
        prizeText = `💎 ${rc.prize_amount} diamonds`;
      } else if (rc.prize_type === 'blook') {
        const existing = await base44.entities.PlayerBlook.filter({ user_id: profile.user_id, blook_id: rc.blook_id, game: 'icecreamet' });
        if (existing.length > 0) {
          await base44.entities.PlayerBlook.update(existing[0].id, { quantity: (existing[0].quantity || 1) + 1 });
        } else {
          await base44.entities.PlayerBlook.create({ user_id: profile.user_id, blook_id: rc.blook_id, quantity: 1, shiny_quantity: 0, game: 'icecreamet' });
        }
        prizeText = `🧊 ${rc.blook_name || 'a blook'}!`;
      }

      await base44.entities.CodeRedemption.create({
        code_id: rc.id, code: rc.code, user_id: profile.user_id,
        username: profile.username, prize_type: rc.prize_type, prize_amount: rc.prize_amount || 0
      });
      await base44.entities.RedeemCode.update(rc.id, { uses_count: (rc.uses_count || 0) + 1 });

      setMsg({ type: 'ok', text: `Redeemed! You got ${prizeText}` });
      setCode('');
    } catch (e) {
      setMsg({ type: 'err', text: 'Redemption failed. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-panel rounded-2xl border border-white/10 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Gem className="text-cyan-400" size={20} />
        <h3 className="font-display text-cyan-400">Diamonds</h3>
        <span className="ml-auto text-2xl font-display text-cyan-400 flex items-center gap-1"><DiamondIcon size={22} /> {diamonds.toLocaleString()}</span>
      </div>
      <p className="text-xs text-white/60 mb-3">Earn <DiamondIcon size={12} /> by selling shiny blooks. Spend <DiamondIcon size={12} /> on packs (2x luck) or save them up!</p>

      <div className="grid sm:grid-cols-2 gap-3">
        {/* Coin -> Diamond converter */}
        <div className="bg-white/5 rounded-xl p-3">
          <p className="text-xs text-white/70 mb-2">Convert coins to diamonds</p>
          <p className="text-[10px] text-white/50 mb-2 flex items-center gap-1">Rate: <TokenIcon size={12} /> {COINS_PER_DIAMOND.toLocaleString()} = <DiamondIcon size={12} /> 1</p>
          <div className="flex items-center gap-2">
            <Input type="number" min={1} value={convAmount} onChange={e => setConvAmount(Math.max(1, parseInt(e.target.value) || 1))} className="w-24 bg-white/10 border-white/20 text-white text-center" />
            <Button size="sm" onClick={convert} disabled={busy} style={{ backgroundColor: '#22d3ee', color: '#000' }}>
              Buy <DiamondIcon size={14} /> {convAmount}
            </Button>
          </div>
          <p className="text-[10px] text-white/50 mt-1 flex items-center gap-1">Cost: <TokenIcon size={12} /> {convCost.toLocaleString()}</p>
        </div>

        {/* Redeem code */}
        <div className="bg-white/5 rounded-xl p-3">
          <p className="text-xs text-white/70 mb-2">Redeem a code</p>
          <p className="text-[10px] text-white/50 mb-2">Enter a code to claim a surprise prize.</p>
          <div className="flex items-center gap-2">
            <Input value={code} onChange={e => setCode(e.target.value)} placeholder="Enter code" className="flex-1 bg-white/10 border-white/20 text-white" />
            <Button size="sm" onClick={redeem} disabled={busy || !code.trim()} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
              Redeem
            </Button>
          </div>
        </div>
      </div>

      {msg && (
        <p className={`text-xs mt-3 ${msg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>
      )}
    </div>
  );
}