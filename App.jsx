import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, Outlet } from 'react-router-dom';
import PageNotFound from '@/lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from '@/components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import { GameProvider } from '@/lib/gameContext.jsx';
import GameLayout from '@/components/game/GameLayout';

// Auth pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

// Game pages
import Landing from '@/pages/Landing';
import Home from '@/pages/Home';
import Chat from '@/pages/Chat';
import Stats from '@/pages/Stats';
import Leaderboard from '@/pages/Leaderboard';
import Blooks from '@/pages/Blooks';
import Bazaar from '@/pages/Bazaar';
import Trade from '@/pages/Trade';
import Suggestions from '@/pages/Suggestions';
import AdminPanel from '@/pages/AdminPanel';
import ModPanel from '@/pages/ModPanel';
import Settings from '@/pages/Settings';
import PlayerProfile from '@/pages/PlayerProfile';
import Clans from '@/pages/Clans';
import AuctionHouse from '@/pages/AuctionHouse';
import Minigames from '@/pages/Minigames';
import FlappyBirdPage from '@/pages/FlappyBirdPage';
import GeometryDashPage from '@/pages/GeometryDashPage';
import Discord from '@/pages/Discord';
import PlusStore from '@/pages/PlusStore';
import Credits from '@/pages/Credits';
import GTBLive from '@/pages/GTBLive';
import TradeRoom from '@/pages/TradeRoom';
import Giveaways from '@/pages/Giveaways';
import Mines from '@/pages/Mines';
import Craft from '@/pages/Craft';
import OpenBox from '@/pages/OpenBox';
import FlabbyPird from '@/pages/FlabbyPird';
import BlookDesign from '@/pages/BlookDesign';
import BiggiePanel from '@/pages/BiggiePanel';
import Invites from '@/pages/Invites';
import JoinApplication from '@/pages/JoinApplication';
import Links from '@/pages/Links';
import SpookyEvent from '@/pages/SpookyEvent';
import SoupsOfHivelands from '@/pages/SoupsOfHivelands';
import AltEntry from '@/pages/AltEntry';
import DownloadSource from '@/pages/DownloadSource';


const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password'].some(
    (p) => path === p || path.startsWith(p + '/')
  );

  // Auth pages must always render so users can log in / register even when
  // public-settings or token checks fail on an external host (Railway).
  if ((isLoadingPublicSettings || isLoadingAuth) && !isAuthPage) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: '#a7fcc9' }}>
        <div className="text-center">
          <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/2724130c5_file_00000000f0cc81f689edd7e643506d5b-removebg-preview.png" alt="ICECREAMET" className="h-20 w-auto object-contain mx-auto mb-4" />
          <div className="w-8 h-8 border-4 border-panel/30 border-t-panel rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (authError?.type === 'user_not_registered' && !isAuthPage) {
    return <UserNotRegisteredError />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/join/:code" element={<JoinApplication />} />
      <Route path="/" element={<Landing />} />
      <Route path="/alt-entry" element={<AltEntry />} />
      <Route path="/download-source" element={<DownloadSource />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<GameProvider><Outlet /></GameProvider>}>
        <Route element={<GameLayout />}>
          <Route path="/market" element={<Home />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/blooks" element={<Blooks />} />
          <Route path="/bazaar" element={<Bazaar />} />
          <Route path="/trade" element={<Trade />} />
          <Route path="/trade/room/:roomId" element={<TradeRoom />} />
          <Route path="/suggestions" element={<Suggestions />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/mod" element={<ModPanel />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/player/:userId" element={<PlayerProfile />} />
          <Route path="/clans" element={<Clans />} />
          <Route path="/auctions" element={<AuctionHouse />} />
          <Route path="/minigames" element={<Minigames />} />
          <Route path="/flappybird" element={<FlappyBirdPage />} />
          <Route path="/geometrydash" element={<GeometryDashPage />} />
          <Route path="/discord" element={<Discord />} />
          <Route path="/plus" element={<PlusStore />} />
          <Route path="/credits" element={<Credits />} />
          <Route path="/gtb/:lobbyId" element={<GTBLive />} />
          <Route path="/giveaways" element={<Giveaways />} />
          <Route path="/mines" element={<Mines />} />
          <Route path="/craft" element={<Craft />} />
          <Route path="/openbox" element={<OpenBox />} />
          <Route path="/flabby-pird" element={<FlabbyPird />} />
          <Route path="/blook-design" element={<BlookDesign />} />
          <Route path="/biggie-panel" element={<BiggiePanel />} />
          <Route path="/invites" element={<Invites />} />
          <Route path="/links" element={<Links />} />
          <Route path="/spooky-event" element={<SpookyEvent />} />
          <Route path="/hivelands" element={<SoupsOfHivelands />} />
        </Route>
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
