import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function UpdateCatalog() {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    base44.entities.UpdateEntry.filter({ is_active: true }, '-created_date', 100)
      .then(list => { if (active) setUpdates(list); })
      .catch(() => { if (active) setUpdates([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <div className="bg-panel rounded-2xl border border-white/10 p-4">
      <h3 className="font-display text-[#a7fcc9] text-lg mb-1">📢 Update Catalog</h3>
      <p className="text-xs text-white/60 mb-3">Everything new in ICECREAMET, newest first.</p>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-[#a7fcc9]/30 border-t-[#a7fcc9] rounded-full animate-spin" />
        </div>
      ) : updates.length === 0 ? (
        <p className="text-white/60 text-sm">No updates posted yet. Check back soon!</p>
      ) : (
        <div className="space-y-3">
          {updates.map(u => (
            <div key={u.id} className="bg-white/5 rounded-xl border border-white/10 p-3">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {u.version && (
                  <span className="text-[10px] font-display px-2 py-0.5 rounded-full bg-[#a7fcc9]/20 border border-[#a7fcc9]/40 text-[#a7fcc9]">
                    {u.version}
                  </span>
                )}
                <h4 className="font-display text-white">{u.title}</h4>
              </div>
              <p className="text-[10px] text-white/40 mb-2">
                {u.created_date ? new Date(u.created_date).toLocaleDateString([], { timeZone: 'America/New_York' }) : ''}
              </p>
              {u.image_url && <img src={u.image_url} alt="" className="w-full max-h-64 object-contain rounded-lg mb-2" />}
              {u.content && <p className="text-sm text-white/80 whitespace-pre-wrap break-words">{u.content}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}