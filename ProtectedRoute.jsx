import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: '#0c4a30' }}>
    <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
  </div>
);

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  const { isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) {
      checkUserAuth();
    }
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  // If Base44 never answers (domain errors / network), stop the spinner after 4s
  // and send the visitor to login / landing instead of a black screen forever.
  useEffect(() => {
    if (authChecked && !isLoadingAuth) return undefined;
    const t = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, [authChecked, isLoadingAuth]);

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (timedOut && (isLoadingAuth || !authChecked)) {
    return unauthenticatedElement;
  }

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (authError) {
    return unauthenticatedElement;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  return <Outlet />;
}
