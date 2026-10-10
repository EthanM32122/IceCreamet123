import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGame } from '@/lib/gameContext';

export default function UsernameModal({ onClose, onDone }) {
  const { updateProfile } = useGame();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (username.trim().length > 20) {
      setError('Username must be 20 characters or less');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ username: username.trim(), has_set_username: true });
      onDone();
    } catch {
      setError('Failed to set username');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
        <h2 className="text-xl font-display text-panel text-center mb-2">Welcome to ICECREAMET!</h2>
        <p className="text-sm text-center text-muted-foreground mb-4">Choose a username to get started</p>
        <Input
          value={username}
          onChange={e => { setUsername(e.target.value); setError(''); }}
          placeholder="Enter username..."
          className="mb-2"
          maxLength={20}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full"
          style={{ backgroundColor: 'rgb(var(--user-sidebar))' }}
        >
          {saving ? 'Setting...' : 'Start Playing!'}
        </Button>
      </div>
    </div>
  );
}