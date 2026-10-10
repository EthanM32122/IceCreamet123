import React, { useState, useEffect } from 'react';
import { Link, Outlet } from 'react-router-dom';
import Sidebar from '@/components/game/Sidebar';
import NotificationBell from '@/components/game/NotificationBell';
import { TokenIcon } from '@/components/game/CurrencyIcon';
import UsernameModal from '@/components/game/UsernameModal';
import NewsModal from '@/components/game/NewsModal';
import RulesModal from '@/components/game/RulesModal';
import NewsSidebar from '@/components/game/NewsSidebar';
import RulesSidebar from '@/components/game/RulesSidebar';
import LiveTradePopups from '@/components/game/LiveTradePopups';
import BoostPopup from '@/components/game/BoostPopup';
import UpdateChecker from '@/components/UpdateChecker';
import ClickTheBart from '@/components/game/ClickTheBart';
import VerityWatcher from '@/components/game/VerityWatcher';
import IcecreamyDrop from '@/components/game/IcecreamyDrop';
import VerificationGate from '@/components/game/VerificationGate';
import { base44 } from '@/api/base44Client';
import { useGame } from '@/lib/gameContext';
import { getTheme, DEFAULT_THEME_ID } from '@/lib/themes';
import { SHINY_THEMES } from '@/lib/shiny';
import BlookJumpers from '@/components/BlookJumpers';
import BannedScreen from '@/components/game/BannedScreen';
import BackgroundMusic from '@/components/game/BackgroundMusic';
import BiggieEatCutscene from '@/components/game/BiggieEatCutscene';
import BiggieTrollOverlay from '@/components/game/BiggieTrollOverlay';
import PumpkinSeedEvent from '@/components/game/PumpkinSeedEvent';
import AdminAbuse from '@/components/game/AdminAbuse';
import { isEventLive } from '@/lib/spookyEvent';

export default function GameLayout() {
  const game = useGame();
  const profile = game?.profile;
  const loading = game?.loading ?? true;
  const [showUsername, setShowUsername] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showNews, setShowNews] = useState(false);
  const [newsOpen, setNewsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  useEffect(() => {
    if (profile && !profile.has_set_username) {
      setShowUsername(true);
    } else if (profile && !profile.has_seen_rules) {
      setShowRules(true);
    } else if (profile && !profile.has_seen_news) {
      setShowNews(true);
    }
  }, [profile]);

  // Pop the news sidebar open instantly whenever a new news item is published.
  useEffect(() => {
    const unsub = base44.entities.NewsItem.subscribe((event) => {
      if (event.type === 'create' && event.data?.is_active !== false) {
        setNewsOpen(true);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const isPhantomGrip = profile?.username?.toLowerCase() === 'phantom_grip';
    // During SPOOKY MONTH everyone (phantom_grip included) gets the spooky
    // theme; once the month-long event is over everyone reverts to their
    // normal theme (phantom_grip's exclusive cheeseburger, others' chosen bg).
    const theme = isEventLive()
      ? getTheme('spooky')
      : getTheme(profile?.theme_bg || (isPhantomGrip ? 'cheeseburger' : DEFAULT_THEME_ID));
    const hex = theme.sidebar.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    document.body.style.background = theme.bg;
    if (theme.animated) {
      document.body.style.backgroundSize = '200% 200%';
      document.body.style.animation = 'themePan 12s ease infinite';
    } else {
      document.body.style.backgroundSize = '';
      document.body.style.animation = '';
    }
    document.documentElement.style.setProperty('--user-sidebar', `${r} ${g} ${b}`);
    if (isPhantomGrip) document.body.classList.add('phantom-grip-theme');

    // Apply the player's chosen shiny theme (Plus) as a body class so every
    // `.shiny-blook` across the app picks up the themed glow.
    SHINY_THEMES.forEach(t => { if (t.class) document.body.classList.remove(t.class); });
    const shinyClass = SHINY_THEMES.find(t => t.id === profile?.shiny_theme)?.class;
    if (shinyClass) document.body.classList.add(shinyClass);

    return () => {
      document.body.style.background = '';
      document.body.style.backgroundSize = '';
      document.body.style.animation = '';
      document.documentElement.style.removeProperty('--user-sidebar');
      document.body.classList.remove('phantom-grip-theme');
      SHINY_THEMES.forEach(t => { if (t.class) document.body.classList.remove(t.class); });
    };
  }, [profile?.theme_bg, profile?.shiny_theme, profile?.username]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: '#a7fcc9' }}>
        <div className="text-center">
          <h1 className="text-4xl font-display text-panel mb-4">ICECREAMET</h1>
          <div className="w-8 h-8 border-4 border-panel/30 border-t-panel rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-foreground">{game.loadError || 'Your player profile is unavailable.'}</p>
      <button onClick={() => game.loadProfile()} className="rounded-lg bg-primary text-primary-foreground px-4 py-2">Try again</button>
    </div>;
  }

  if (profile?.is_banned) {
    return <BannedScreen profile={profile} />;
  }

  const isPhantomGrip = profile?.username?.toLowerCase() === 'phantom_grip';
  const theme = isEventLive()
    ? getTheme('spooky')
    : getTheme(profile?.theme_bg || (isPhantomGrip ? 'cheeseburger' : DEFAULT_THEME_ID));
  const eventLive = isEventLive();

  return (
    <div className="min-h-screen">
      {theme.blookJump && <BlookJumpers onCatch={(_b, reward) => game.addTokens?.(reward)} />}
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-2" style={{ backgroundColor: 'rgb(var(--user-sidebar))' }}>
        <Link to="/" className="flex items-center gap-2" title="Home">
          <img
            src={profile?.username?.toLowerCase() === 'phantom_grip'
              ? 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/d8c5ed85f_image.png'
              : 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/2724130c5_file_00000000f0cc81f689edd7e643506d5b-removebg-preview.png'}
            alt={profile?.username?.toLowerCase() === 'phantom_grip' ? 'BiggiCheezlet' : 'ICECREAMET'}
            className="h-8 w-auto object-contain"
          />
          <span className="flex flex-col leading-tight">
            {eventLive ? (
              <>
                <span className="font-display text-white text-base sm:text-lg tracking-wide">{isPhantomGrip ? 'BiggiCheezlet SPOOKY MONTH :)' : 'ICECREAMET SPOOKY MONTH :)'}</span>
                <span className="spooky-month-gradient font-display text-[10px] sm:text-xs tracking-wide">SPOOKY MONTH Event</span>
              </>
            ) : (
              <>
                <span className="font-display text-white text-base sm:text-lg tracking-wide">{isPhantomGrip ? 'BiggiCheezlet' : 'ICECREAMET'}</span>
                <span className="font-display text-[#a7fcc9] text-[10px] sm:text-xs tracking-wide">Play, collect, trade!</span>
              </>
            )}
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {profile && (
            <Link to="/stats" className="flex items-center gap-2 text-xs text-white">
              <div className="w-7 h-7 avatar-rounded-square bg-white/20 overflow-hidden flex-shrink-0">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-white">{profile.username?.[0]?.toUpperCase()}</div>
                )}
              </div>
              <span className="hidden md:inline truncate max-w-[120px]">{profile.username}</span>
              <span className="text-[#a7fcc9] flex items-center gap-1"><TokenIcon size={12} /> {profile.tokens?.toLocaleString() || 0}</span>
            </Link>
          )}
          <NotificationBell />
        </div>
      </header>
      <main className="min-h-screen px-6 pt-16 pb-24">
        <Outlet />
      </main>
      <Sidebar onOpenNews={() => setNewsOpen(true)} onOpenRules={() => setRulesOpen(true)} />
      {showUsername && (
        <UsernameModal onClose={() => setShowUsername(false)} onDone={() => {
          setShowUsername(false);
          if (!profile.has_seen_rules) setShowRules(true);
          else if (!profile.has_seen_news) setShowNews(true);
        }} />
      )}
      {showRules && (
        <RulesModal onClose={() => setShowRules(false)} onDone={() => {
          setShowRules(false);
          if (!profile.has_seen_news) setShowNews(true);
        }} />
      )}
      {showNews && <NewsModal onClose={() => setShowNews(false)} />}
      <NewsSidebar open={newsOpen} onClose={() => setNewsOpen(false)} />
      <RulesSidebar open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <LiveTradePopups />
      <BoostPopup />
      <UpdateChecker />
      <BackgroundMusic />
      {profile?.bart_popup_enabled !== false && <ClickTheBart />}
      <VerityWatcher />
      {profile?.icecreamy_popup_enabled !== false && <IcecreamyDrop />}
      <PumpkinSeedEvent />
      <AdminAbuse />
      {game?.showVerification && <VerificationGate />}
      <BiggieEatCutscene />
      <BiggieTrollOverlay />
    </div>
  );
}