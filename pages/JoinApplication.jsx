import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Loader2 } from 'lucide-react';

export default function JoinApplication() {
  const { code } = useParams();
  const [state, setState] = useState('loading');
  const [inviter, setInviter] = useState(null);
  const [form, setForm] = useState({ email: '', age: '', discord_username: '', reason: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    base44.entities.InviteLink.filter({ code })
      .then(links => {
        if (!links[0]) { setState('invalid'); return; }
        setInviter(links[0]);
        setState('form');
      })
      .catch(() => setState('invalid'));
  }, [code]);

  const submit = async () => {
    setError('');
    if (!form.email.trim()) { setError('Enter your email so we can send you an invite.'); return; }
    const age = parseInt(form.age, 10);
    if (!age || age < 1 || age > 120) { setError('Enter your age as a number.'); return; }
    if (!form.discord_username.trim()) { setError('Enter your Discord username.'); return; }
    if (!form.reason.trim()) { setError('Tell us why you want to join.'); return; }

    setSubmitting(true);
    try {
      await base44.entities.InviteApplication.create({
        code,
        inviter_user_id: inviter.inviter_user_id,
        inviter_username: inviter.inviter_username,
        email: form.email.trim(),
        age,
        discord_username: form.discord_username.trim(),
        reason: form.reason.trim(),
        status: 'pending'
      });
      setState('sent');
    } catch (e) {
      setError('Could not send your application. Please try again.');
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#9af3c0' }}>
      <div className="w-full max-w-md bg-white/90 backdrop-blur rounded-2xl border border-white/40 p-6 shadow-xl">
        {state === 'loading' && (
          <div className="flex justify-center py-10"><Loader2 size={28} className="animate-spin text-emerald-600" /></div>
        )}

        {state === 'invalid' && (
          <div className="text-center py-6">
            <p className="text-lg font-display text-emerald-900 mb-1">Invalid invite link</p>
            <p className="text-sm text-emerald-900/70 mb-4">This invite link doesn't exist or is no longer active.</p>
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white"><Link to="/">Go home</Link></Button>
          </div>
        )}

        {state === 'sent' && (
          <div className="text-center py-6">
            <CheckCircle2 size={40} className="mx-auto text-emerald-600 mb-3" />
            <p className="text-lg font-display text-emerald-900 mb-1">Application sent!</p>
            <p className="text-sm text-emerald-900/70">An admin will review it. If you're approved, you'll get an invite email to create your account.</p>
          </div>
        )}

        {state === 'form' && (
          <>
            <div className="text-center mb-5">
              {inviter?.inviter_avatar && (
                <img src={inviter.inviter_avatar} alt="" className="w-14 h-14 rounded-2xl object-contain mx-auto mb-2 bg-emerald-100" />
              )}
              <p className="text-lg font-display text-emerald-900">
                {inviter?.inviter_username} invited you to ICECREAMET
              </p>
              <p className="text-sm text-emerald-900/70">Answer a few questions so an admin can approve you.</p>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-emerald-900">Email (for your invite)</Label>
                <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" className="bg-white border-emerald-200 text-emerald-900" />
              </div>
              <div>
                <Label className="text-emerald-900">Age</Label>
                <Input type="number" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} placeholder="13" className="bg-white border-emerald-200 text-emerald-900" />
              </div>
              <div>
                <Label className="text-emerald-900">Discord username</Label>
                <Input value={form.discord_username} onChange={e => setForm({ ...form, discord_username: e.target.value })} placeholder="yourname" className="bg-white border-emerald-200 text-emerald-900" />
              </div>
              <div>
                <Label className="text-emerald-900">Why do you want to join?</Label>
                <Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} rows={3} placeholder="Tell us a bit about yourself..." className="bg-white border-emerald-200 text-emerald-900" />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button onClick={submit} disabled={submitting} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Send application'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}