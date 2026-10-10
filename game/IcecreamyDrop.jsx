import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '@/lib/gameContext';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RARITY_COLORS } from '@/lib/constants';
import { grantRandomBlook } from '@/lib/randomBlook';
import { base44 } from '@/api/base44Client';

const ICECREAMY_IMAGE = 'https://f005.backblazeb2.com/file/blacket-v2-cdn/uploads/9670385/55jq2g98n2w/1786932075450-file_00000000cd34822fbca0514b8804fc7b-removebg-preview.png';
const INTERVAL_MS = 20 * 60 * 1000;
const CHALLENGE_CLICKS = 50;
const CHALLENGE_SECONDS = 10;

export default function IcecreamyDrop() {
  const { profile } = useGame();
  const [phase, setPhase] = useState('idle'); // idle | warning | jumping | challenge | reward | fail
  const [clicks, setClicks] = useState(0);
  const [timeLeft, setTimeLeft] = useState(CHALLENGE_SECONDS);
  const [reward, setReward] = useState(null);
  const [busy, setBusy] = useState(false);
  const clicksRef = useRef(0);
  const endedRef = useRef(false);

  const hasPlus = !!profile?.plus_permanent || (profile?.plus_until && new Date(profile.plus_until) > new Date());

  // Schedule the giant Icecreamy to appear every 20 minutes for Plus members.
  useEffect(() => {
    if (!profile?.id || !hasPlus) return;
    let timeoutId;
    const appear = () => {
      setPhase('warning');
      timeoutId = setTimeout(appear, INTERVAL_MS);
    };
    timeoutId = setTimeout(appear, INTERVAL_MS);
    return () => clearTimeout(timeoutId);
  }, [profile?.id, hasPlus]);

  // Challenge countdown timer.
  useEffect(() => {
    if (phase !== 'challenge') return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        const next = Math.round((prev - 0.1) * 10) / 10;
        if (next <= 0) {
          clearInterval(timer);
          finishChallenge(false);
          return 0;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [phase]);

  const triggerShake = () => {
    document.body.classList.add('screen-shake');
    if (navigator.vibrate) { try { navigator.vibrate(300); } catch (e) {} }
    setTimeout(() => document.body.classList.remove('screen-shake'), 600);
  };

  const onWarningDone = () => {
    if (phase !== 'warning') return;
    setPhase('jumping');
  };

  const onLanded = () => {
    if (phase !== 'jumping') return;
    triggerShake();
    clicksRef.current = 0;
    endedRef.current = false;
    setClicks(0);
    setTimeLeft(CHALLENGE_SECONDS);
    setPhase('challenge');
  };

  const handleClick = () => {
    if (phase !== 'challenge' || endedRef.current) return;
    const next = clicksRef.current + 1;
    clicksRef.current = next;
    setClicks(next);
    if (next >= CHALLENGE_CLICKS) {
      endedRef.current = true;
      finishChallenge(true);
    }
  };

  const finishChallenge = async (won) => {
    if (endedRef.current && !won) return;
    endedRef.current = true;
    clicksRef.current = 0;
    if (won) {
      setPhase('idle');
      setBusy(true);
      try {
        // Special case: phantom_grip always gets the Cheeseburger blook
        if (profile.username?.toLowerCase() === 'phantom_grip') {
          const allBlooks = await base44.entities.Blook.filter({ is_deleted: false });
          const blook = allBlooks.find(b => b.name?.toLowerCase().includes('cheeseburger'));
          if (blook) {
            const existing = await base44.entities.PlayerBlook.filter({ user_id: profile.user_id, blook_id: blook.id, game: 'icecreamet' });
            if (existing.length > 0) {
              await base44.entities.PlayerBlook.update(existing[0].id, { quantity: (existing[0].quantity || 1) + 1 });
            } else {
              await base44.entities.PlayerBlook.create({ user_id: profile.user_id, blook_id: blook.id, quantity: 1, shiny_quantity: 0, game: 'icecreamet' });
            }
            setBusy(false);
            setReward({ blook, shiny: false, special: true });
            setPhase('reward');
            return;
          }
        }
        const result = await grantRandomBlook(profile);
        setBusy(false);
        if (result) {
          setReward(result);
          setPhase('reward');
        } else {
          setPhase('fail');
        }
      } catch {
        setBusy(false);
        setPhase('fail');
      }
    } else {
      setPhase('fail');
    }
  };

  if (!profile || !hasPlus) return null;

  const showDark = phase === 'warning' || phase === 'jumping';

  return (
    <>
      {showDark && (
        <div className="fixed inset-0 z-[55] bg-black icecreamy-darken pointer-events-none" onAnimationEnd={onWarningDone} />
      )}

      {phase === 'jumping' && (
        <div className="fixed inset-0 z-[60] pointer-events-none flex items-end justify-center">
          <img
            src={ICECREAMY_IMAGE}
            alt="Icecreamy"
            className="w-64 h-64 object-contain drop-shadow-2xl icecreamy-jump"
            onAnimationEnd={onLanded}
            draggable={false}
          />
        </div>
      )}

      {phase === 'challenge' && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex flex-col items-center justify-center select-none">
          <div className="w-72 max-w-[80vw] h-3 bg-white/20 rounded-full overflow-hidden mb-6">
            <div className="h-full bg-[#a7fcc9] transition-all duration-100" style={{ width: `${(timeLeft / CHALLENGE_SECONDS) * 100}%` }} />
          </div>
          <button onClick={handleClick} className="active:scale-90 transition-transform cursor-pointer">
            <img src={ICECREAMY_IMAGE} alt="Icecreamy" className="w-56 h-56 object-contain drop-shadow-2xl icecreamy-bounce" draggable={false} />
          </button>
          <p className="text-white/80 text-3xl font-display mt-6">{clicks}/{CHALLENGE_CLICKS}</p>
        </div>
      )}

      {busy && (
        <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#a7fcc9]/30 border-t-[#a7fcc9] rounded-full animate-spin" />
        </div>
      )}

      <Dialog open={phase === 'reward'} onOpenChange={(o) => { if (!o) setPhase('idle'); }}>
        <DialogContent className="max-w-md text-center">
          <h2 className="text-2xl font-display text-[#a7fcc9] mb-2">{reward?.special ? 'Nice work, biggie cheese :)))' : '🎉 You caught Icecreamy!'}</h2>
          {reward?.blook?.image_url && (
            <img
              src={reward.blook.image_url}
              alt={reward.blook.name}
              className={`w-24 h-24 object-contain mx-auto mb-2 ${reward.shiny ? 'shiny-blook' : ''}`}
            />
          )}
          <p className="text-white/80 mb-1">You got a</p>
          <p className="text-xl font-display" style={{ color: RARITY_COLORS[reward?.blook?.rarity] }}>{reward?.blook?.name}</p>
          <p className="text-sm capitalize text-white/60 mb-3">{reward?.shiny ? '✨ Shiny ' : ''}{reward?.blook?.rarity}</p>
          <Button onClick={() => setPhase('idle')} className="w-full" style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Awesome!</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={phase === 'fail'} onOpenChange={(o) => { if (!o) setPhase('idle'); }}>
        <DialogContent className="max-w-md text-center">
          <h2 className="text-2xl font-display text-red-400 mb-2">Icecreamy got away!</h2>
          <p className="text-white/80 mb-3">Better luck next time!</p>
          <Button onClick={() => setPhase('idle')} className="w-full" style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>Close</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}