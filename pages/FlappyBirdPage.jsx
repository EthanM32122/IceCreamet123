import React, { useState } from 'react';
import FlappyBird from '@/components/game/FlappyBird';
import FlappyLeaderboard from '@/components/game/FlappyLeaderboard';

const FLAPPY_IMG = 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/519c29a6d_Screenshot_20260823-213520_2-removebg-preview.png';

export default function FlappyBirdPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="bg-white/80 rounded-2xl p-3 shadow-sm">
          <div className="flex justify-center mb-3">
            <img src={FLAPPY_IMG} alt="Flabby Pird" className="w-20 h-20 object-contain" />
          </div>
          <FlappyBird onGameOver={() => setRefreshKey(k => k + 1)} />
        </div>
        <div className="bg-white/80 rounded-2xl p-3 shadow-sm">
          <FlappyLeaderboard refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  );
}