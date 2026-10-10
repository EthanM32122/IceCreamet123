import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import ImageUpload from '@/components/game/ImageUpload';
import { BOT_AVATAR_KEY, DEFAULT_BOT_AVATAR, getBotAvatar } from '@/lib/botAvatar';

export default function BotAdmin() {
  const [avatar, setAvatar] = useState('');
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getBotAvatar().then(v => { setAvatar(v); setSaved(v); }).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!avatar.trim()) return;
    setSaving(true);
    try {
      const existing = await base44.entities.GameSettings.filter({ key: BOT_AVATAR_KEY });
      if (existing.length) await base44.entities.GameSettings.update(existing[0].id, { value: avatar.trim() });
      else await base44.entities.GameSettings.create({ key: BOT_AVATAR_KEY, value: avatar.trim(), category: 'general' });
      setSaved(avatar.trim());
      alert('Bot picture updated!');
    } catch (e) {
      alert('Failed: ' + (e.message || 'unknown error'));
    }
    setSaving(false);
  };

  if (loading) return <p className="text-white/60 text-xs">Loading...</p>;

  return (
    <div className="bg-panel rounded-xl border border-white/10 p-4">
      <h3 className="font-display text-[#a7fcc9] mb-1">🤖 ICECREAMET Bot</h3>
      <p className="text-xs text-white/60 mb-3">Change the profile picture of the ICECREAMET Bot in chat. It applies to every bot message instantly.</p>

      <div className="flex items-center gap-4 mb-3">
        <div className="w-16 h-16 rounded-full bg-white/10 overflow-hidden flex-shrink-0">
          {(avatar || DEFAULT_BOT_AVATAR) && <img src={avatar || DEFAULT_BOT_AVATAR} alt="Bot" className="w-full h-full object-contain" />}
        </div>
        <div className="flex-1">
          <ImageUpload label="Bot Picture" value={avatar} onChange={setAvatar} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving || !avatar.trim()} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
          {saving ? 'Saving...' : 'Save Bot Picture'}
        </Button>
        {saved !== DEFAULT_BOT_AVATAR && (
          <Button variant="outline" onClick={() => setAvatar(DEFAULT_BOT_AVATAR)} className="border-white/20 text-white">Use Default</Button>
        )}
      </div>
    </div>
  );
}