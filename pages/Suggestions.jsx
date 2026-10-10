import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ThumbsUp } from 'lucide-react';

export default function Suggestions() {
  const { profile } = useGame();
  const [suggestions, setSuggestions] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    const all = await base44.entities.Suggestion.list('-upvotes', 50);
    const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
    const expired = all.filter(s => new Date(s.created_date).getTime() < cutoff);
    for (const s of expired) { await base44.entities.Suggestion.delete(s.id); }
    setSuggestions(all.filter(s => new Date(s.created_date).getTime() >= cutoff));
  };

  const submit = async () => {
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    await base44.entities.Suggestion.create({
      user_id: profile.user_id,
      username: profile.username,
      title: title.trim(),
      content: content.trim()
    });
    setTitle('');
    setContent('');
    setSubmitting(false);
    loadSuggestions();
  };

  const upvote = async (sug) => {
    await base44.entities.Suggestion.update(sug.id, { upvotes: (sug.upvotes || 0) + 1 });
    loadSuggestions();
  };

  return (
    <div>
      <h2 className="text-2xl font-display text-panel mb-4">Suggestions</h2>
      <div className="bg-white rounded-2xl shadow-sm border p-4 mb-6">
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Suggestion title..." className="mb-2" />
        <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Describe your idea..." className="mb-2" rows={3} />
        <Button onClick={submit} disabled={submitting} style={{ backgroundColor: 'rgb(var(--user-sidebar))' }}>Submit</Button>
      </div>
      <div className="space-y-3">
        {suggestions.map(sug => (
          <div key={sug.id} className="bg-white rounded-xl border p-4 flex gap-3">
            <button onClick={() => upvote(sug)} className="flex flex-col items-center text-muted-foreground hover:text-panel transition-colors">
              <ThumbsUp size={16} />
              <span className="text-xs mt-0.5">{sug.upvotes || 0}</span>
            </button>
            <div>
              <h4 className="font-display text-sm text-panel">{sug.title}</h4>
              <p className="text-xs text-foreground/80 mt-1">{sug.content}</p>
              <p className="text-[10px] text-muted-foreground mt-1">by {sug.username} • {sug.status}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}