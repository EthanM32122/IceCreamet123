import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import BlookJumpers from '@/components/BlookJumpers';

const AUTH_BG = "https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/8133195b6_Screenshot_20260827-0318212.jpg";

export default function BannedScreen({ profile }) {
  const [username, setUsername] = useState(profile?.username || '');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!reason.trim()) { setError('Please enter a reason for your appeal.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await base44.entities.BanAppeal.create({
        user_id: profile?.user_id || '',
        username: username.trim() || profile?.username || '',
        reason: reason.trim(),
        status: 'pending'
      });
      setSubmitted(true);
    } catch (e) {
      setError('Failed to submit appeal. Please try again in a moment.');
    }
    setSubmitting(false);
  };

  const canSelfUnban = ['icecreamy', '_minti_'].includes((profile?.username || '').toLowerCase());
  const [unbanning, setUnbanning] = useState(false);

  const unbanSelf = async () => {
    setUnbanning(true);
    try {
      await base44.entities.PlayerProfile.update(profile.id, { is_banned: false, ban_reason: '', banned_by: '' });
      window.location.reload();
    } catch (e) {
      setError('Failed to unban. Please try again.');
      setUnbanning(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8 bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url("${AUTH_BG}")` }}
    >
      <BlookJumpers />
      <div className="w-full max-w-md relative z-10">
        <div className="rounded-2xl border border-white/30 shadow-xl p-8 backdrop-blur-md bg-white/15">
          <h1 className="text-3xl font-display text-red-400 mb-3 text-center" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.7)" }}>🚫 You Are Banned</h1>
          <p className="text-white/90 text-center mb-5 text-sm font-display" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}>
            You are currently banned by <span className="font-bold text-white">{profile?.banned_by || 'an admin'}</span> for: <span className="italic">"{profile?.ban_reason || 'No reason provided'}"</span>. If you believe this is a mistake, please fill out a ban appeal below:
          </p>
          {canSelfUnban && (
            <div className="mb-4 bg-green-500/20 border border-green-500/40 rounded-lg p-4 text-center">
              <p className="text-white/80 text-xs mb-3">You have permanent ban immunity. Unban yourself instantly:</p>
              <Button onClick={unbanSelf} disabled={unbanning} className="w-full" style={{ backgroundColor: '#34d399', color: '#fff' }}>
                {unbanning ? 'Unbanning...' : '🔓 Unban Myself'}
              </Button>
            </div>
          )}
          {submitted ? (
            <div className="text-center bg-green-500/20 border border-green-500/40 rounded-lg p-4">
              <p className="text-green-300 font-display">✅ Appeal submitted!</p>
              <p className="text-white/70 text-xs mt-1">The admin team will review your appeal. You may close this page.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/60 mb-1 block">Username</label>
                <Input value={username} onChange={e => setUsername(e.target.value)} className="bg-white/10 border-white/20 text-white" />
              </div>
              <div>
                <label className="text-xs text-white/60 mb-1 block">Why do you think you were banned unfairly?</label>
                <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={4} className="bg-white/10 border-white/20 text-white" placeholder="Explain your situation..." />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <Button onClick={submit} disabled={submitting} className="w-full" style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
                {submitting ? 'Submitting...' : 'Submit Appeal'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}