import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Newspaper } from 'lucide-react';

export default function NewsPanel() {
  const [news, setNews] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.NewsItem.filter({ is_active: true }, '-created_date').then(items => {
      setNews(items);
      setSelected(items[0] || null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading || !selected) return null;

  return (
    <div className="w-full lg:w-72 flex-shrink-0 lg:ml-auto bg-[#f7f2e7] rounded-xl border-2 border-[#a7fcc9]/50 overflow-hidden shadow-lg" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
      <div className="bg-[#a7fcc9] text-panel px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Newspaper size={14} />
          <span className="font-display text-xs tracking-wider">ICECREAMET TIMES</span>
        </div>
        <span className="text-[9px] text-panel/70 font-display">{new Date().toLocaleDateString()}</span>
      </div>
      <div className="p-3">
        {news.length > 1 && (
          <div className="flex flex-wrap gap-1 mb-2 pb-2 border-b border-panel/20">
            {news.slice(0, 6).map((item, i) => (
              <button key={item.id} onClick={() => setSelected(item)} className={`text-[9px] px-1.5 py-0.5 rounded font-display ${selected?.id === item.id ? 'bg-panel text-white' : 'bg-panel/10 text-panel hover:bg-panel/20'}`}>
                {i + 1}
              </button>
            ))}
          </div>
        )}
        <h4 className="font-display text-sm text-panel leading-tight mb-1">{selected.title}</h4>
        <p className="text-[11px] text-panel/80 leading-snug line-clamp-5 whitespace-pre-wrap">{selected.content}</p>
        {selected.image_url && <img src={selected.image_url} alt="" className="mt-2 rounded w-full max-h-24 object-cover" />}
      </div>
    </div>
  );
}