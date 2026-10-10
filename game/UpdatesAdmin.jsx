import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Edit, Trash2 } from 'lucide-react';
import ImageUpload from '@/components/game/ImageUpload';

export default function UpdatesAdmin() {
  const [updates, setUpdates] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', version: '', content: '', image_url: '', is_active: true });

  useEffect(() => { load(); }, []);
  const load = () => base44.entities.UpdateEntry.list('-created_date').then(setUpdates).catch(() => {});

  const save = async () => {
    if (!form.title.trim()) return;
    if (editing) { await base44.entities.UpdateEntry.update(editing, form); }
    else { await base44.entities.UpdateEntry.create(form); }
    setForm({ title: '', version: '', content: '', image_url: '', is_active: true });
    setEditing(null); load();
  };

  const del = async (id) => {
    if (!confirm('Delete this update entry?')) return;
    await base44.entities.UpdateEntry.delete(id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="bg-panel rounded-xl border border-white/10 p-4">
        <h3 className="font-display text-[#a7fcc9] mb-3">{editing ? 'Edit Update' : 'Post an Update'}</h3>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Title (e.g. Biggie Panel is here!)" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <Input placeholder="Version (optional, e.g. v1.4)" value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} />
          <ImageUpload label="Image (optional)" value={form.image_url} onChange={v => setForm({ ...form, image_url: v })} />
        </div>
        <Textarea placeholder="What changed in this update?" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="mt-2" rows={4} />
        <div className="flex items-center gap-2 mt-2">
          <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
          <span className="text-xs text-white">Visible to players</span>
        </div>
        <div className="flex gap-2 mt-3">
          <Button onClick={save} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>{editing ? 'Update' : 'Post'}</Button>
          {editing && <Button variant="outline" onClick={() => { setEditing(null); setForm({ title: '', version: '', content: '', image_url: '', is_active: true }); }}>Cancel</Button>}
        </div>
      </div>
      <div className="space-y-2">
        {updates.map(u => (
          <div key={u.id} className="bg-panel rounded-xl border border-white/10 p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="font-display text-sm text-[#a7fcc9]">{u.version ? `${u.version} — ` : ''}{u.title}</span>
              {!u.is_active && <span className="text-[10px] text-red-400 ml-2">(hidden)</span>}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <Button size="sm" variant="outline" onClick={() => { setEditing(u.id); setForm({ title: u.title || '', version: u.version || '', content: u.content || '', image_url: u.image_url || '', is_active: u.is_active !== false }); }} className="border-white/20 text-white"><Edit size={12} /></Button>
              <Button size="sm" variant="outline" onClick={() => del(u.id)} className="border-white/20 text-red-400"><Trash2 size={12} /></Button>
            </div>
          </div>
        ))}
        {updates.length === 0 && <p className="text-white/60 text-xs">No updates posted yet.</p>}
      </div>
    </div>
  );
}