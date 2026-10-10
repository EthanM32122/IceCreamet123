import React, { useState, useEffect, useRef } from 'react';

// Detects when a new build of the app has been deployed by polling index.html
// and comparing the script tags. When a change is found, shows a popup prompting
// the user to reload.
export default function UpdateChecker() {
  const [showPopup, setShowPopup] = useState(false);
  const initialFpRef = useRef(null);

  useEffect(() => {
    const getFingerprint = async () => {
      try {
        const res = await fetch('/index.html', { cache: 'no-cache' });
        const html = await res.text();
        // Extract script src URLs — these change when a new build is deployed
        const matches = html.match(/src="[^"]*\.js[^"]*"/g) || [];
        return matches.join('|');
      } catch (e) {
        return null;
      }
    };

    getFingerprint().then(fp => { initialFpRef.current = fp; });

    const checkForUpdate = async () => {
      const fp = await getFingerprint();
      if (fp && initialFpRef.current && fp !== initialFpRef.current) {
        setShowPopup(true);
      }
    };

    const interval = setInterval(checkForUpdate, 60000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  if (!showPopup) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[200] bg-panel rounded-2xl border border-[#a7fcc9] p-4 shadow-2xl max-w-sm animate-blook-rise">
      <p className="text-white font-display mb-3">🔄 A new update is available. Reload?</p>
      <div className="flex gap-2 justify-end">
        <button onClick={() => setShowPopup(false)} className="text-xs text-white/60 px-3 py-1.5 rounded-lg hover:bg-white/10">Later</button>
        <button onClick={() => window.location.reload()} className="text-xs bg-[#a7fcc9] px-3 py-1.5 rounded-lg font-display" style={{ color: 'rgb(var(--user-sidebar))' }}>Reload</button>
      </div>
    </div>
  );
}