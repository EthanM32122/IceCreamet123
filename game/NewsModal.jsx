import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { X } from 'lucide-react';

export default function NewsModal({ onClose }) {
  const { updateProfile } = useGame();
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.NewsItem.filter({ is_active: true }, '-created_date').then(items => {
      setNews(items);
      setLoading(false);
    });
  }, []);

  const handleClose = async () => {
    await updateProfile({ has_seen_news: true });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b" style={{ backgroundColor: '#a7fcc9', borderRadius: '1rem 1rem 0 0' }}>
          <h2 className="text-xl font-display text-panel">📰 Latest News</h2>
          <button onClick={handleClose} className="text-panel hover:opacity-70">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-panel/30 border-t-panel rounded-full animate-spin mx-auto" />
            </div>
          ) : news.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No news yet — check back later!</p>
          ) : (
            news.map(item => (
              <div key={item.id} className="bg-muted/50 rounded-xl p-4">
                <h3 className="font-display text-panel mb-1">{item.title}</h3>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap">{item.content}</p>
                {item.image_url && <img src={item.image_url} alt="" className="mt-2 rounded-lg max-h-40 object-cover" />}
              </div>
            ))
          )}
        </div>
        <div className="p-4 border-t">
          <Button onClick={handleClose} className="w-full" style={{ backgroundColor: 'rgb(var(--user-sidebar))' }}>
            Got it!
          </Button>
        </div>
      </div>
    </div>
  );
}