import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Newspaper, X } from 'lucide-react';

export default function NewsSidebar({ open, onClose }) {
  const [news, setNews] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadNews = () => base44.entities.NewsItem.filter({ is_active: true }, '-created_date').then(items => {
    setNews(items);
    setSelected(items[0] || null);
    setLoading(false);
  }).catch(() => setLoading(false));

  useEffect(() => {
    if (!open) return;
    loadNews();
  }, [open]);

  // Realtime: refresh and jump to the newest item whenever news is created/updated.
  useEffect(() => {
    if (!open) return;
    const unsub = base44.entities.NewsItem.subscribe((event) => {
      if (event.type !== 'create' && event.type !== 'update') return;
      base44.entities.NewsItem.filter({ is_active: true }, '-created_date').then(items => {
        setNews(items);
        setSelected(items[0] || null);
      }).catch(() => {});
    });
    return unsub;
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-[#1a1a1a] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Newspaper size={18} className="text-white" />
            <span className="font-display text-white">ICECREAMET News</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading && <div className="flex justify-center py-8"><div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" /></div>}
          {!loading && news.length === 0 && <p className="text-white/50 text-sm text-center py-8">No news right now.</p>}
          {news.length > 1 && (
            <div className="flex flex-wrap gap-1 mb-3 pb-3 border-b border-white/10">
              {news.slice(0, 8).map((item, i) => (
                <button key={item.id} onClick={() => setSelected(item)} className={`text-[10px] px-2 py-1 rounded font-display ${selected?.id === item.id ? 'bg-[#a7fcc9] text-panel' : 'bg-white/10 text-white hover:bg-white/20'}`}>{i + 1}</button>
              ))}
            </div>
          )}
          {selected && (
            <div>
              <h3 className="font-display text-white text-lg leading-tight mb-3">{selected.title}</h3>
              {selected.image_url && <img src={selected.image_url} alt="" className="rounded-lg w-full max-h-56 object-cover mb-3 shadow-lg" />}
              <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{selected.content}</p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}