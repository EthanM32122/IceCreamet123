import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Trophy } from 'lucide-react';

export default function GeometryLeaderboard({ refreshKey }) {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const all = await base44.entities.GeometryScore.filter({}, '-score', 10);
        setScores(all);
      } catch (e) {
        setScores([]);
      }
      setLoading(false);
    })();
  }, [refreshKey]);

  return (
    <div className="bg-panel rounded-2xl border border-white/10 p-4">
      <h3 className="font-display text-[#a7fcc9] mb-3 flex items-center gap-2"><Trophy size={16} /> Top 10 Survival Times</h3>
      {loading ? (
        <div className="flex justify-center py-4"><div className="w-6 h-6 border-4 border-[#a7fcc9]/30 border-t-[#a7fcc9] rounded-full animate-spin" /></div>
      ) : scores.length === 0 ? (
        <p className="text-white/50 text-sm text-center py-4">No scores yet. Be the first!</p>
      ) : (
        <div className="space-y-1">
          {scores.map((s, i) => (
            <div key={s.id} className={`flex items-center justify-between px-3 py-1.5 rounded-lg ${i === 0 ? 'bg-yellow-500/20' : 'bg-white/5'}`}>
              <span className="text-white text-sm">#{i + 1} {s.username || 'Player'}</span>
              <span className="text-[#a7fcc9] font-display text-sm">{s.score}s</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}