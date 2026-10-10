import React, { useState } from 'react';
import GeometryDash from '@/components/game/GeometryDash';
import GeometryLeaderboard from '@/components/game/GeometryLeaderboard';

const CUBE_IMG = 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/b2af7d599_file_00000000a6a481f58b6172b4a05c5bca-removebg-preview.png';

export default function GeometryDashPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="bg-white/80 rounded-2xl p-3 shadow-sm">
          <div className="flex justify-center mb-3">
            <img src={CUBE_IMG} alt="Cube" className="w-20 h-20 object-contain" />
          </div>
          <GeometryDash onGameOver={() => setRefreshKey(k => k + 1)} />
        </div>
        <div className="bg-white/80 rounded-2xl p-3 shadow-sm">
          <GeometryLeaderboard refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  );
}