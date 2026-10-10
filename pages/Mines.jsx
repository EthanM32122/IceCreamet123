import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { RARITY_ORDER } from '@/lib/constants';
import { getHourlyRate } from '@/lib/mines';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Pickaxe, AlertTriangle, Coins, HardHat, ArrowUpDown } from 'lucide-react';

const MAX_SLOTS = 15;
const BASE_SLOTS = 5;
const slotCost = (currentSlots) => 10000 * Math.max(1, currentSlots - BASE_SLOTS + 1);

export default function Mines() {
  const { profile, minedBlooks, updateProfile, addTokens } = useGame();
  const [playerBlooks, setPlayerBlooks] = useState([]);
  const [allBlooks, setAllBlooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirmBlook, setConfirmBlook] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [rateUnit, setRateUnit] = useState('hr'); // 'hr' or 'sec'
  const [hopper, setHopper] = useState(0);
  const [buyingSlot, setBuyingSlot] = useState(false);
  const { toast } = useToast();
  const hopperRef = useRef(0);

  const mineSlots = profile?.mine_slots || BASE_SLOTS;

  const loadInventory = async () => {
    if (!profile) return;
    const [pb, ab] = await Promise.all([
      base44.entities.PlayerBlook.filter({ user_id: profile.user_id, game: 'icecreamet' }, null, 2000),
      base44.entities.Blook.filter({ is_active: true, is_deleted: false }, null, 3000)
    ]);
    setPlayerBlooks(pb);
    setAllBlooks(ab);
    setLoading(false);
  };

  useEffect(() => { loadInventory(); }, [profile?.user_id]);

  // Ore hopper: accumulate tokens dug up per second for display.
  // Persisted to localStorage so switching tabs and coming back doesn't reset it.
  useEffect(() => {
    const mined = minedBlooks || [];
    const perSec = mined.reduce((sum, mb) => sum + (mb.hourly_rate || 0), 0) / 3600;
    const storageKey = `mine_hopper_${profile?.user_id}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const { value, ts } = JSON.parse(stored);
        const elapsed = (Date.now() - ts) / 1000;
        hopperRef.current = value + (perSec * elapsed);
        setHopper(hopperRef.current);
      }
    } catch {}
    const interval = setInterval(() => {
      hopperRef.current += perSec;
      setHopper(hopperRef.current);
      try { localStorage.setItem(storageKey, JSON.stringify({ value: hopperRef.current, ts: Date.now() })); } catch {}
    }, 1000);
    return () => {
      clearInterval(interval);
      try { localStorage.setItem(storageKey, JSON.stringify({ value: hopperRef.current, ts: Date.now() })); } catch {}
    };
  }, [minedBlooks, profile?.user_id]);

  const blookMap = {};
  allBlooks.forEach(b => { blookMap[b.id] = b; });

  const ownedBlooks = playerBlooks
    .map(pb => ({ ...blookMap[pb.blook_id], pbId: pb.id, quantity: pb.quantity }))
    .filter(b => b && b.image_url && b.quantity > 0)
    .sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity));

  const mined = minedBlooks || [];
  const totalHourly = mined.reduce((sum, mb) => sum + (mb.hourly_rate || 0), 0);
  const totalPerSec = totalHourly / 3600;
  const shaftLevel = Math.min(MAX_SLOTS, Math.floor(totalHourly / 200) + 1);

  const placeBlook = async () => {
    if (!confirmBlook) return;
    if (mined.length >= mineSlots) {
      toast({ title: 'No free slots!', description: `Buy more slots to send additional miners.`, variant: 'destructive' });
      return;
    }
    setPlacing(true);
    try {
      const hourlyRate = getHourlyRate(confirmBlook.rarity);
      await base44.entities.MinedBlook.create({
        user_id: profile.user_id,
        blook_id: confirmBlook.id,
        blook_name: confirmBlook.name,
        blook_image_url: confirmBlook.image_url,
        rarity: confirmBlook.rarity,
        hourly_rate: hourlyRate,
        placed_at: new Date().toISOString()
      });
      if (confirmBlook.quantity > 1) {
        await base44.entities.PlayerBlook.update(confirmBlook.pbId, { quantity: confirmBlook.quantity - 1 });
      } else {
        await base44.entities.PlayerBlook.delete(confirmBlook.pbId);
      }
      await loadInventory();
      setConfirmBlook(null);
      toast({ title: '⛏️ Miner sent!', description: `${confirmBlook.name} is now digging up tokens.` });
    } catch (e) {
      toast({ title: 'Failed to place blook', description: e.message || 'unknown error', variant: 'destructive' });
    }
    setPlacing(false);
  };

  const buySlot = async () => {
    if (mineSlots >= MAX_SLOTS) return;
    const cost = slotCost(mineSlots);
    if ((profile.tokens || 0) < cost) {
      toast({ title: 'Not enough tokens', description: `You need ${cost.toLocaleString()} tokens to buy a slot.`, variant: 'destructive' });
      return;
    }
    setBuyingSlot(true);
    try {
      await addTokens(-cost);
      await updateProfile({ mine_slots: mineSlots + 1 });
      toast({ title: '⛏️ Slot purchased!', description: `You now have ${mineSlots + 1} mine slots.` });
    } catch (e) {
      toast({ title: 'Failed to buy slot', description: e.message || 'unknown error', variant: 'destructive' });
    }
    setBuyingSlot(false);
  };

  const haulTokens = async () => {
    if (hopper < 1) {
      toast({ title: '⛏️ Nothing to haul yet', description: 'Your miners are still digging...' });
      return;
    }
    const amount = Math.floor(hopper);
    try {
      await addTokens(amount);
      toast({ title: '💰 Tokens hauled!', description: `${amount.toLocaleString()} tokens added to your balance!` });
    } catch (e) {
      toast({ title: 'Failed to haul', description: e.message || 'unknown error', variant: 'destructive' });
      return;
    }
    hopperRef.current = 0;
    setHopper(0);
    try { localStorage.setItem(`mine_hopper_${profile?.user_id}`, JSON.stringify({ value: 0, ts: Date.now() })); } catch {}
  };

  if (loading || !profile) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-panel/30 border-t-panel rounded-full animate-spin" /></div>;

  const searchLower = search.toLowerCase();
  const filteredOwned = search ? ownedBlooks.filter(b => b.name?.toLowerCase().includes(searchLower)) : ownedBlooks;
  const rateValue = rateUnit === 'hr' ? totalHourly : totalPerSec;
  const rateLabel = rateUnit === 'hr' ? '/HR' : '/SEC';
  const slotsFull = mined.length >= mineSlots;

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-panel rounded-2xl border border-white/10 p-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-display text-[#a7fcc9] flex items-center gap-2">
            <Pickaxe size={20} /> TOKEN MINE
          </h2>
          <p className="text-xs text-white/50 ml-7">SHAFT LV {shaftLevel}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-display text-white">{mined.length}/{MAX_SLOTS} MINERS</span>
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            <button
              onClick={() => setRateUnit('hr')}
              className={`px-3 py-1.5 text-xs font-display ${rateUnit === 'hr' ? 'bg-[#a7fcc9] text-panel' : 'bg-white/5 text-white/60 hover:text-white'}`}
            >/HR</button>
            <button
              onClick={() => setRateUnit('sec')}
              className={`px-3 py-1.5 text-xs font-display ${rateUnit === 'sec' ? 'bg-[#a7fcc9] text-panel' : 'bg-white/5 text-white/60 hover:text-white'}`}
            >/SEC</button>
          </div>
        </div>
      </div>

      {/* Warning */}
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-400">⚠️ WARNING: Once you place a blook in the mines, you can NEVER get it back. The blook is permanently consumed and converted into a token generator.</p>
        </div>
      </div>

      {/* Main two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Dig Metrics */}
        <div className="space-y-4">
          {/* Dig Rate Box */}
          <div className="bg-panel rounded-2xl border border-white/10 p-4 text-center">
            <Pickaxe size={28} className="text-[#a7fcc9] mx-auto mb-2" />
            <p className="text-xs text-white/50 font-display tracking-wider">DIG RATE</p>
            <p className="text-2xl font-display text-white mt-1">
              {rateValue.toLocaleString(undefined, { maximumFractionDigits: rateUnit === 'sec' ? 4 : 0 })}
              <span className="text-sm text-[#a7fcc9] ml-1">{rateLabel}</span>
            </p>
          </div>

          {/* Ore Hopper Box */}
          <div className="bg-panel rounded-2xl border border-white/10 p-6 text-center">
            <div className="relative inline-block mb-3">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#a7fcc9]/30 to-[#4ade80]/10 border-2 border-[#a7fcc9]/40 flex items-center justify-center mx-auto">
                <Coins size={32} className="text-[#f1c40f]" />
              </div>
            </div>
            <p className="text-4xl font-display text-[#f1c40f]">{hopper.toFixed(2)}</p>
            <p className="text-xs text-white/50 font-display tracking-wider mt-1">TOKENS DUG UP</p>
          </div>

          {/* Haul Button */}
          <Button
            onClick={haulTokens}
            className="w-full h-12 text-base font-display rounded-xl"
            style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}
          >
            ⛏️ HAUL TOKENS UP
          </Button>
        </div>

        {/* Right Column: Mining Crew */}
        <div className="lg:col-span-2 bg-panel rounded-2xl border border-white/10 p-4 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="font-display text-white flex items-center gap-2">
              <HardHat size={18} className="text-[#a7fcc9]" /> MINING CREW
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/70 font-display">{mined.length}/{mineSlots} HIRED</span>
              {mineSlots < MAX_SLOTS && (
                <Button
                  size="sm"
                  onClick={buySlot}
                  disabled={buyingSlot || (profile.tokens || 0) < slotCost(mineSlots)}
                  className="font-display"
                  style={{ backgroundColor: 'rgb(var(--user-sidebar))', color: '#a7fcc9' }}
                >
                  + SLOT {slotCost(mineSlots).toLocaleString()}
                </Button>
              )}
            </div>
          </div>

          {/* Crew Grid or Empty State */}
          {mined.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center min-h-[300px]">
              <Pickaxe size={48} className="text-white/10 mb-4" />
              <h4 className="text-lg font-display text-white/60 mb-1">THE MINE IS SILENT</h4>
              <p className="text-sm text-white/40 mb-6 max-w-xs">Send your first miner down to start digging tokens.</p>
              <Button
                onClick={() => setShowPicker(true)}
                className="px-8 py-3 rounded-xl font-display text-base"
                style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}
              >
                + SEND FIRST MINER
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 flex-1">
                {mined.map(mb => (
                  <div key={mb.id} className="bg-white/5 rounded-lg p-2 text-center">
                    {mb.blook_image_url && <img src={mb.blook_image_url} alt={mb.blook_name} className="w-12 h-12 object-contain mx-auto" />}
                    <p className={`text-xs mt-1 rarity-${mb.rarity} truncate`}>{mb.blook_name}</p>
                    <p className="text-[10px] text-[#a7fcc9]">💰 {mb.hourly_rate}/hr</p>
                  </div>
                ))}
              </div>
              <Button
                onClick={() => setShowPicker(true)}
                disabled={slotsFull}
                className="mt-4 w-full py-3 rounded-xl font-display"
                style={slotsFull ? {} : { backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}
                variant={slotsFull ? 'outline' : 'default'}
              >
                {slotsFull ? 'All slots full — buy more to expand' : '+ SEND MINER'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Inventory Picker Dialog */}
      <Dialog open={showPicker} onOpenChange={setShowPicker}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send a Miner Down the Shaft</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2 mb-3">
            ⚠️ The blook you pick will be PERMANENTLY consumed — you can never get it back.
          </p>
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search blooks..." className="mb-3 bg-white/10 border-white/20 text-white placeholder:text-white/40" />
          {slotsFull && (
            <p className="text-sm text-red-400 mb-3">All {mineSlots} slots are full. Buy more slots to send additional miners.</p>
          )}
          {filteredOwned.length === 0 ? (
            <p className="text-white/50 text-sm text-center py-4">No blooks available to mine.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
              {filteredOwned.slice(0, 100).map(blook => (
                <button
                  key={blook.pbId}
                  onClick={() => { setConfirmBlook(blook); setShowPicker(false); }}
                  disabled={slotsFull}
                  className="bg-white/5 rounded-lg p-2 text-center hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {blook.image_url && <img src={blook.image_url} alt={blook.name} className="w-12 h-12 object-contain mx-auto" />}
                  <p className={`text-xs mt-1 rarity-${blook.rarity} truncate`}>{blook.name}</p>
                  <p className="text-[10px] text-[#a7fcc9]">💰 {getHourlyRate(blook.rarity)}/hr</p>
                  {blook.quantity > 1 && <p className="text-[10px] text-white/60">x{blook.quantity}</p>}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmBlook} onOpenChange={v => !v && setConfirmBlook(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Place {confirmBlook?.name} in Mines?</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3">
            {confirmBlook?.image_url && <img src={confirmBlook.image_url} alt="" className="w-16 h-16 object-contain" />}
            <div>
              <p className={`text-sm rarity-${confirmBlook?.rarity}`}>{confirmBlook?.name}</p>
              <p className="text-xs text-[#a7fcc9]">💰 {confirmBlook ? getHourlyRate(confirmBlook.rarity) : 0} coins/hour</p>
            </div>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2">
            <p className="text-xs text-red-400">⚠️ This is PERMANENT. You will NEVER get this blook back. It will be consumed and converted into a coin generator forever.</p>
          </div>
          <Button onClick={placeBlook} disabled={placing} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
            {placing ? 'Placing...' : 'Yes, Place in Mines'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}