import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { getAllBlooks } from '@/lib/gameDataCache';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus } from 'lucide-react';

const PRIZE_TYPES = [
  { value: 'tokens', label: 'Tokens 🪙' },
  { value: 'diamonds', label: 'Diamonds 💎' },
  { value: 'blook', label: 'Blook 🧊' }
];

// SPOOKY MONTH event blooks are exclusive seed rewards and cannot be granted by codes.
const SPOOKY_PACK_ID = '6abdc8898281b760c964c249';

export default function AdminCodes() {
  const { profile } = useGame();
  const [codes, setCodes] = useState([]);
  const [allBlooks, setAllBlooks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    code: '', prize_type: 'tokens', prize_amount: 1000, blook_id: '', blook_name: '', max_uses: 1, is_weekly: false, note: ''
  });
  const [msg, setMsg] = useState(null);

  const load = async () => {
    try {
      const [list, blooks] = await Promise.all([
        base44.entities.RedeemCode.filter({}, '-created_date', 100),
        getAllBlooks('icecreamet')
      ]);
      setCodes(list);
      setAllBlooks(blooks);
    } catch (e) {}
  };

  useEffect(() => { load(); }, []);

  if (!profile) return null;
  const isMinion = profile.user_id === '6a99b529fd54567710eb02d5';
  if (profile.role !== 'owner' && !isMinion) return null;

  const genCode = () => {
    const s = Math.random().toString(36).slice(2, 8).toUpperCase();
    setForm(f => ({ ...f, code: 'ICE-' + s }));
  };

  const submit = async () => {
    if (!form.code.trim()) { setMsg({ type: 'err', text: 'Enter or generate a code.' }); return; }
    if (form.prize_type === 'blook' && !form.blook_id) { setMsg({ type: 'err', text: 'Select a blook for this code.' }); return; }
    if ((form.prize_type === 'tokens' || form.prize_type === 'diamonds') && (!form.prize_amount || form.prize_amount <= 0)) {
      setMsg({ type: 'err', text: 'Enter a prize amount.' }); return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await base44.entities.RedeemCode.create({
        code: form.code.trim().toUpperCase(),
        prize_type: form.prize_type,
        prize_amount: form.prize_type === 'blook' ? 0 : Number(form.prize_amount),
        blook_id: form.prize_type === 'blook' ? form.blook_id : '',
        blook_name: form.prize_type === 'blook' ? form.blook_name : '',
        max_uses: Math.max(0, parseInt(form.max_uses) || 0),
        uses_count: 0,
        created_by: profile.username,
        is_active: true,
        is_weekly: !!form.is_weekly,
        note: form.note || ''
      });
      setForm({ code: '', prize_type: 'tokens', prize_amount: 1000, blook_id: '', blook_name: '', max_uses: 1, is_weekly: false, note: '' });
      setMsg({ type: 'ok', text: 'Code created!' });
      load();
    } catch (e) {
      setMsg({ type: 'err', text: 'Failed to create code.' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    try { await base44.entities.RedeemCode.delete(id); load(); } catch (e) {}
  };

  const toggleActive = async (c) => {
    try { await base44.entities.RedeemCode.update(c.id, { is_active: !c.is_active }); load(); } catch (e) {}
  };

  const prizeLabel = (c) => {
    if (c.prize_type === 'tokens') return `🪙 ${c.prize_amount}`;
    if (c.prize_type === 'diamonds') return `💎 ${c.prize_amount}`;
    return `🧊 ${c.blook_name || 'Blook'}`;
  };

  return (
    <div className="bg-panel rounded-2xl border border-white/10 p-4 mb-4">
      <h3 className="font-display text-[#a7fcc9] mb-3">🎟️ Code Manager <span className="text-[10px] text-white/50">(Owner{isMinion ? ' / Minion' : ''})</span></h3>

      <div className="bg-white/5 rounded-xl p-3 mb-3">
        <div className="grid sm:grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-white/60">Code</label>
            <div className="flex gap-1">
              <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="ICE-XXXXXX" className="bg-white/10 border-white/20 text-white" />
              <Button size="sm" variant="outline" onClick={genCode} className="border-white/20 text-white">Gen</Button>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-white/60">Prize Type</label>
            <select value={form.prize_type} onChange={e => setForm(f => ({ ...f, prize_type: e.target.value }))} className="w-full h-9 rounded-md bg-white/10 border border-white/20 text-white px-2">
              {PRIZE_TYPES.map(p => <option key={p.value} value={p.value} className="text-black">{p.label}</option>)}
            </select>
          </div>
          {form.prize_type === 'blook' ? (
            <div className="sm:col-span-2">
              <label className="text-[10px] text-white/60">Blook</label>
              <select value={form.blook_id} onChange={e => { const b = allBlooks.find(x => x.id === e.target.value); setForm(f => ({ ...f, blook_id: e.target.value, blook_name: b?.name || '' })); }} className="w-full h-9 rounded-md bg-white/10 border border-white/20 text-white px-2">
                <option value="" className="text-black">Select a blook…</option>
                {allBlooks.filter(b => b.pack_id !== SPOOKY_PACK_ID).map(b => <option key={b.id} value={b.id} className="text-black">{b.name} ({b.rarity})</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-[10px] text-white/60">Amount</label>
              <Input type="number" value={form.prize_amount} onChange={e => setForm(f => ({ ...f, prize_amount: e.target.value }))} className="bg-white/10 border-white/20 text-white" />
            </div>
          )}
          <div>
            <label className="text-[10px] text-white/60">Max Uses (0 = unlimited)</label>
            <Input type="number" value={form.max_uses} onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))} className="bg-white/10 border-white/20 text-white" />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none h-9">
              <input type="checkbox" checked={!!form.is_weekly} onChange={e => setForm(f => ({ ...f, is_weekly: e.target.checked }))} className="w-4 h-4 accent-[#a7fcc9]" />
              <span className="text-xs text-white/80">Weekly <span className="text-[10px] text-white/50">(once per user / 7 days)</span></span>
            </label>
          </div>
          <div>
            <label className="text-[10px] text-white/60">Note (optional)</label>
            <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="e.g. Twitter giveaway" className="bg-white/10 border-white/20 text-white" />
          </div>
        </div>
        <Button size="sm" onClick={submit} disabled={busy} className="mt-2" style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
          <Plus size={14} className="mr-1" /> Create Code
        </Button>
        {msg && <p className={`text-xs mt-2 ${msg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>}
      </div>

      <div className="max-h-64 overflow-y-auto space-y-1.5">
        {codes.map(c => (
          <div key={c.id} className={`flex items-center gap-2 rounded-lg p-2 ${c.is_active ? 'bg-white/5' : 'bg-white/5 opacity-50'}`}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-display text-white truncate">{c.code} {c.is_weekly && <span className="text-[9px] bg-[#a7fcc9]/20 text-[#a7fcc9] rounded px-1 ml-1">WEEKLY</span>} <span className="text-[10px] text-white/50">{prizeLabel(c)}</span></p>
              <p className="text-[10px] text-white/50">
                Uses: {c.uses_count || 0}{c.max_uses > 0 ? `/${c.max_uses}` : ' ∞'} · {c.note || 'no note'}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => toggleActive(c)} className="border-white/20 text-white text-[10px]">{c.is_active ? 'On' : 'Off'}</Button>
            <Button size="sm" variant="outline" onClick={() => remove(c.id)} className="border-red-400/40 text-red-400">
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
        {codes.length === 0 && <p className="text-center text-white/60 text-sm py-4">No codes yet</p>}
      </div>
    </div>
  );
}