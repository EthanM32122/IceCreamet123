import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Hivelands leaderboards: top players by soups crafted, coins, and honey.
export default function HivelandsLeaderboards({ currentUserId }) {
  const [soupBoard, setSoupBoard] = useState([]);
  const [coinBoard, setCoinBoard] = useState([]);
  const [honeyBoard, setHoneyBoard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await base44.entities.HivelandsProfile.filter({}, '-coins', 200);
        const list = rows.items || rows;
        if (cancelled) return;
        setSoupBoard([...list].sort((a, b) => (b.soups_made || 0) - (a.soups_made || 0)).slice(0, 20));
        setCoinBoard([...list].sort((a, b) => (b.coins || 0) - (a.coins || 0)).slice(0, 20));
        setHoneyBoard([...list].sort((a, b) => (b.honey || 0) - (a.honey || 0)).slice(0, 20));
      } catch (e) {}
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const renderBoard = (rows, getValue, emoji) => (
    <div className="bg-black/40 rounded-2xl border border-amber-400/40 p-3">
      {rows.length === 0 && !loading && (
        <p className="text-white/50 text-sm text-center py-6">No entries yet. Be the first!</p>
      )}
      {rows.map((row, i) => {
        const isMe = row.user_id === currentUserId;
        return (
          <div
            key={row.id}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-1 ${isMe ? 'bg-amber-400/20 border border-amber-400/50' : 'bg-white/5 border border-white/10'}`}
          >
            <span className={`w-7 text-center font-display text-sm ${i === 0 ? 'text-yellow-300' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-500' : 'text-white/50'}`}>
              {i + 1}
            </span>
            <span className="flex-1 text-sm text-white font-display truncate">
              {row.username || 'Beekeeper'}
              {isMe && <span className="ml-1 text-amber-300 text-xs">(you)</span>}
            </span>
            <span className="text-sm font-display text-amber-300">{emoji} {(getValue(row) || 0).toLocaleString()}</span>
          </div>
        );
      })}
      {loading && <p className="text-white/50 text-sm text-center py-6">Loading…</p>}
    </div>
  );

  return (
    <Tabs defaultValue="soups" className="w-full">
      <TabsList className="grid w-full grid-cols-3 bg-black/30 border border-amber-400/30">
        <TabsTrigger value="soups">🍲 Soups</TabsTrigger>
        <TabsTrigger value="coins">🪙 Coins</TabsTrigger>
        <TabsTrigger value="honey">🍯 Honey</TabsTrigger>
      </TabsList>
      <TabsContent value="soups" className="mt-3">
        {renderBoard(soupBoard, r => r.soups_made, '🍲')}
      </TabsContent>
      <TabsContent value="coins" className="mt-3">
        {renderBoard(coinBoard, r => r.coins, '🪙')}
      </TabsContent>
      <TabsContent value="honey" className="mt-3">
        {renderBoard(honeyBoard, r => r.honey, '🍯')}
      </TabsContent>
    </Tabs>
  );
}