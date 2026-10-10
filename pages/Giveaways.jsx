import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import GiveawayCard from '@/components/game/GiveawayCard';
import CreateGiveawayDialog from '@/components/game/CreateGiveawayDialog';
import GiveawayDetailDialog from '@/components/game/GiveawayDetailDialog';

export default function Giveaways() {
  const { profile } = useGame();
  const [giveaways, setGiveaways] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    const all = await base44.entities.Giveaway.list('-created_date', 100);
    setGiveaways(all);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const now = Date.now();
  const active = giveaways.filter(g => g.status === 'active' && (!g.end_time || new Date(g.end_time).getTime() >= now));
  const expired = giveaways.filter(g => g.status === 'completed' || (g.status === 'active' && g.end_time && new Date(g.end_time).getTime() < now));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-display text-white">Giveaways</h2>
        {profile && <Button onClick={() => setCreateOpen(true)} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}><Plus size={16} className="mr-1" /> List Giveaway</Button>}
      </div>

      <div>
        <h3 className="font-display text-white text-lg">Available Giveaways</h3>
        <p className="text-sm text-white/50 mb-2">Below are the giveaways you are eligible for and can enter.</p>
        <div className="border-t border-white/10 mb-4" />
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" /></div>
        ) : active.length === 0 ? (
          <p className="text-white/50 text-sm">No active giveaways right now.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map(g => <GiveawayCard key={g.id} giveaway={g} onView={setSelected} />)}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-display text-white text-lg">Expired Giveaways</h3>
        <p className="text-sm text-white/50 mb-2">Below are the giveaways that have ended.</p>
        <div className="border-t border-white/10 mb-4" />
        {expired.length === 0 ? (
          <p className="text-white/50 text-sm">No expired giveaways.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {expired.map(g => <GiveawayCard key={g.id} giveaway={g} onView={setSelected} />)}
          </div>
        )}
      </div>

      <CreateGiveawayDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
      <GiveawayDetailDialog giveaway={selected} onOpenChange={setSelected} onChanged={load} />
    </div>
  );
}