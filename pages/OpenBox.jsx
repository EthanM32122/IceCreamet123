import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '@/lib/gameContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { VERITY_AVATARS, postVerityMessage } from '@/lib/verity';

export default function OpenBox() {
  const { profile, updateProfile } = useGame();
  const navigate = useNavigate();
  const [opening, setOpening] = useState(false);
  const [showVerity, setShowVerity] = useState(false);

  const alreadyUnlocked = !!profile?.verity_unlocked;

  const openBox = async () => {
    if (opening || alreadyUnlocked) return;
    setOpening(true);
    try {
      await updateProfile({ verity_unlocked: true });
      await postVerityMessage("Hello! I'm Verity, your personal helper friend. Ask me anything, I know everything.", 'happy');
      setShowVerity(true);
    } catch {}
    setOpening(false);
  };

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <h2 className="text-3xl font-display text-[#a7fcc9] mb-2">📦 The Mystery Box</h2>
      <p className="text-white/60 mb-8 text-center max-w-md">Something is inside... open it to find out who is waiting for you.</p>
      <button onClick={openBox} disabled={opening || alreadyUnlocked} className="transition-transform hover:scale-105 active:scale-95 disabled:opacity-50">
        <div className="w-56 h-56 rounded-2xl flex items-center justify-center text-7xl shadow-lg" style={{ background: 'linear-gradient(135deg, #a7fcc9, rgb(var(--user-sidebar)))' }}>
          {alreadyUnlocked ? '✅' : '📦'}
        </div>
      </button>
      <div className="mt-6 text-center">
        {alreadyUnlocked ? (
          <p className="text-white/70">You already unlocked Verity! Go to chat and type <span className="text-[#a7fcc9]">@Verity</span> to ask him anything.</p>
        ) : (
          <Button onClick={openBox} disabled={opening} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>{opening ? 'Opening...' : 'Open the Box'}</Button>
        )}
      </div>
      <Button variant="outline" onClick={() => navigate('/chat')} className="mt-4 border-white/20 text-white">Go to Chat</Button>

      <Dialog open={showVerity} onOpenChange={setShowVerity}>
        <DialogContent className="max-w-sm text-center">
          <img src={VERITY_AVATARS.happy} alt="Verity" className="w-24 h-24 rounded-2xl mx-auto object-contain" />
          <h2 className="text-2xl font-display text-[#a7fcc9] mt-2">Verity has arrived!</h2>
          <p className="text-white/80 mt-1">Hello! I'm Verity, your personal helper friend. Ask me anything, I know everything.</p>
          <p className="text-xs text-white/50 mt-2">Type <span className="text-[#a7fcc9]">@Verity</span> in chat to ask me a question.</p>
          <Button onClick={() => { setShowVerity(false); navigate('/chat'); }} className="w-full" style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Go to Chat</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}