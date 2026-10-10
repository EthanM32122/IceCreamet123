import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const BART_IMAGE = 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/131c638c2_image.png';
const BANNER_IMAGE = 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/01974e918_image.png';
const BART_BANNER_NAME = 'Click The Bart Banner';
const INTERVAL_MS = 5 * 60 * 1000;
const VISIBLE_MS = 12000;
const CHALLENGE_CLICKS = 50;
const CHALLENGE_SECONDS = 10;

export default function ClickTheBart() {
  const { profile } = useGame();
  const navigate = useNavigate();
  const [showBart, setShowBart] = useState(false);
  const [pos, setPos] = useState({ x: 100, y: 100 });
  const [challenge, setChallenge] = useState(false);
  const [clicks, setClicks] = useState(0);
  const [timeLeft, setTimeLeft] = useState(CHALLENGE_SECONDS);
  const [showReward, setShowReward] = useState(false);
  const [showFail, setShowFail] = useState(false);
  const bannerIdRef = useRef(null);
  const hideTimerRef = useRef(null);
  const clicksRef = useRef(0);
  const endedRef = useRef(false);

  useEffect(() => {
    base44.entities.Banner.filter({ name: BART_BANNER_NAME }).then(rows => {
      if (rows[0]) bannerIdRef.current = rows[0].id;
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    let timeoutId;
    const scheduleNext = () => {
      const jitter = Math.random() * 60000;
      timeoutId = setTimeout(appear, INTERVAL_MS + jitter);
    };
    const appear = () => {
      const x = Math.random() * Math.max(20, window.innerWidth - 140) + 10;
      const y = Math.random() * Math.max(20, window.innerHeight - 180) + 80;
      setPos({ x, y });
      setShowBart(true);
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setShowBart(false), VISIBLE_MS);
      scheduleNext();
    };
    scheduleNext();
    return () => { clearTimeout(timeoutId); clearTimeout(hideTimerRef.current); };
  }, [profile?.id]);

  // Challenge countdown timer
  useEffect(() => {
    if (!challenge) return;
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
  }, [challenge]);

  const startChallenge = () => {
    setShowBart(false);
    clearTimeout(hideTimerRef.current);
    clicksRef.current = 0;
    endedRef.current = false;
    setClicks(0);
    setTimeLeft(CHALLENGE_SECONDS);
    setChallenge(true);
  };

  const handleChallengeClick = () => {
    if (endedRef.current) return;
    const next = clicksRef.current + 1;
    clicksRef.current = next;
    setClicks(next);
    if (next >= CHALLENGE_CLICKS) {
      endedRef.current = true;
      setChallenge(false);
      finishChallenge(true);
    }
  };

  const finishChallenge = async (won) => {
    if (endedRef.current && !won) return;
    endedRef.current = true;
    setChallenge(false);
    clicksRef.current = 0;
    if (won) {
      const bannerId = bannerIdRef.current;
      if (!bannerId) { setShowFail(true); return; }
      try {
        const owned = await base44.entities.PlayerBanner.filter({ user_id: profile.user_id, banner_id: bannerId });
        if (owned.length === 0) {
          await base44.entities.PlayerBanner.create({ user_id: profile.user_id, banner_id: bannerId });
        }
        setShowReward(true);
      } catch {
        setShowFail(true);
      }
    } else {
      setShowFail(true);
    }
  };

  if (!profile) return null;

  return (
    <>
      {showBart && !challenge && (
        <button
          onClick={startChallenge}
          className="fixed z-[60] hover:scale-110 active:scale-95 transition-transform"
          style={{ left: pos.x, top: pos.y }}
          title="Click The Bart!"
        >
          <img src={BART_IMAGE} alt="Bart" className="w-24 h-32 object-contain drop-shadow-lg cursor-pointer" draggable={false} />
        </button>
      )}

      {challenge && (
        <div className="fixed inset-0 z-[70] bg-black/80 flex flex-col items-center justify-center select-none">
          <div className="text-center mb-4">
            <p className="text-4xl font-display text-[#a7fcc9]">{clicks}/{CHALLENGE_CLICKS}</p>
            <p className={`text-2xl font-display ${timeLeft <= 3 ? 'text-red-400' : 'text-white'}`}>⏱️ {timeLeft.toFixed(1)}s</p>
          </div>
          <button onClick={handleChallengeClick} className="active:scale-90 transition-transform cursor-pointer">
            <img src={BART_IMAGE} alt="Bart" className="w-48 h-64 object-contain drop-shadow-2xl" draggable={false} />
          </button>
          <p className="text-white/60 text-sm mt-4">Click Bart {CHALLENGE_CLICKS} times in {CHALLENGE_SECONDS} seconds!</p>
        </div>
      )}

      <Dialog open={showReward} onOpenChange={setShowReward}>
        <DialogContent className="max-w-md text-center">
          <h2 className="text-2xl font-display text-[#a7fcc9] mb-2">🎉 You did it!</h2>
          <p className="text-white/80 mb-3">You clicked Bart {CHALLENGE_CLICKS} times in {CHALLENGE_SECONDS} seconds and unlocked the Click The Bart banner!</p>
          <img src={BANNER_IMAGE} alt="Click The Bart Banner" className="w-full rounded-lg" />
          <Button onClick={() => { setShowReward(false); navigate('/blooks'); }} className="w-full" style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
            View My Banners
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={showFail} onOpenChange={setShowFail}>
        <DialogContent className="max-w-md text-center">
          <h2 className="text-2xl font-display text-red-400 mb-2">💀 You lost it!</h2>
          <p className="text-white/80 mb-3">You didn't click fast enough! Bart got away. Try again next time he appears.</p>
          <Button onClick={() => setShowFail(false)} className="w-full" style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}