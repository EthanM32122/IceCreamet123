import React, { useState } from 'react';
import { useGame } from '@/lib/gameContext';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Second-password security gate.
 * Modes from gameContext: 'setup' (first time) | 'quiz' (re-verify).
 */
export default function VerificationGate() {
  const {
    showVerification,
    verificationMode,
    verificationError,
    submitVerification,
  } = useGame() || {};

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  if (!showVerification) return null;

  const isSetup = verificationMode === 'setup';

  const onSubmit = async (e) => {
    e?.preventDefault?.();
    if (busy) return;
    setBusy(true);
    try {
      await submitVerification?.({
        mode: isSetup ? 'setup' : 'quiz',
        password,
        confirm,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!showVerification} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <h2 className="text-xl font-display text-white mb-2">
          {isSetup ? 'Set a security password' : 'Security check'}
        </h2>
        <p className="text-sm text-white/70 mb-4">
          {isSetup
            ? 'Create a second password. You will need it every day to keep playing. Do not share it.'
            : 'Enter your security password to continue.'}
        </p>
        <form onSubmit={onSubmit} className="space-y-3">
          <Input
            type="password"
            placeholder="Security password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className="bg-black/30 border-white/20 text-white"
          />
          {isSetup && (
            <Input
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="bg-black/30 border-white/20 text-white"
            />
          )}
          {verificationError ? (
            <p className="text-sm text-red-400">{verificationError}</p>
          ) : null}
          <Button
            type="submit"
            disabled={busy || !password}
            className="w-full"
            style={{ backgroundColor: '#a7fcc9', color: '#0a2e1a' }}
          >
            {busy ? 'Checking…' : isSetup ? 'Save password' : 'Unlock'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
