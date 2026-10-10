import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Link as RouterLink, Plus, ExternalLink, X, Link2, Trash2 } from 'lucide-react';

export default function Links() {
  const { profile } = useGame();
  const isOwner = profile?.role === 'owner';
  const [links, setLinks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [order, setOrder] = useState(0);
  const [busy, setBusy] = useState(false);

  const loadLinks = async () => {
    try {
      const list = await base44.entities.SmartLink.list('order');
      setLinks(list);
    } catch (e) {}
  };

  useEffect(() => {
    loadLinks();
    const unsub = base44.entities.SmartLink.subscribe(() => loadLinks());
    return unsub;
  }, []);

  const addLink = async () => {
    if (!title.trim() || !url.trim() || !isOwner) return;
    let cleanUrl = url.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = 'https://' + cleanUrl;
    setBusy(true);
    try {
      await base44.entities.SmartLink.create({
        title: title.trim(),
        url: cleanUrl,
        description: description.trim(),
        posted_by: profile?.username || '',
        order: order || 0
      });
      setTitle('');
      setUrl('');
      setDescription('');
      setShowForm(false);
      loadLinks();
    } catch (e) {
      alert('Failed to add link: ' + (e.message || 'unknown'));
    }
    setBusy(false);
  };

  const removeLink = async (link) => {
    if (!isOwner) return;
    if (!confirm(`Remove "${link.title}"?`)) return;
    try {
      await base44.entities.SmartLink.delete(link.id);
      loadLinks();
    } catch (e) {}
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-display text-[#a7fcc9] flex items-center gap-2"><Link2 size={22} /> Links</h2>
        {isOwner && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)} className="border-white/20 text-white">
            <Plus size={14} className="mr-1" /> {showForm ? 'Cancel' : 'Add Link'}
          </Button>
        )}
      </div>

      {isOwner && showForm && (
        <div className="bg-panel rounded-xl border border-white/10 p-4 mb-4 space-y-2">
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Link title" maxLength={80} className="bg-white/10 border-white/20 text-white placeholder:text-white/40" />
          <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." maxLength={300} className="bg-white/10 border-white/20 text-white placeholder:text-white/40" />
          <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" rows={2} maxLength={300} className="bg-white/10 border-white/20 text-white placeholder:text-white/40" />
          <Input type="number" value={order} onChange={e => setOrder(parseInt(e.target.value) || 0)} placeholder="Order" className="bg-white/10 border-white/20 text-white placeholder:text-white/40 w-32" />
          <Button onClick={addLink} disabled={busy || !title.trim() || !url.trim()} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
            {busy ? 'Adding...' : 'Add Link'}
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {links.map(link => (
          <div key={link.id} className="bg-panel rounded-xl border border-white/10 p-4 flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${link.url ? '' : ''}`} style={{ backgroundColor: '#a7fcc9' }}>
              <Link2 size={20} className="text-panel" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <RouterLink to={link.url} className="font-display text-[#a7fcc9] hover:underline truncate">{link.title}</RouterLink>
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-white flex-shrink-0"><ExternalLink size={14} /></a>
              </div>
              {link.description && <p className="text-sm text-white/60 mt-1">{link.description}</p>}
              <p className="text-[10px] text-white/30 mt-1">added by {link.posted_by || 'owner'}</p>
            </div>
            {isOwner && (
              <button onClick={() => removeLink(link)} className="text-white/30 hover:text-red-400 flex-shrink-0"><Trash2 size={16} /></button>
            )}
          </div>
        ))}
        {links.length === 0 && (
          <p className="text-white/40 text-sm text-center py-10">No links yet.</p>
        )}
      </div>
    </div>
  );
}