import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ShieldCheck, IceCream, Lock } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';

// Roles allowed into the alternate backup entrance.
const ALLOWED_ROLES = ['co-owner', 'executive-manager', 'owner', 'biggie'];

const PATTERN = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24'%3E%3Cpath fill='white' d='M12 2a4 4 0 0 1 4 4v.5a1 1 0 0 1-.3.7L12 14 8.3 7.2a1 1 0 0 1-.3-.7V6a4 4 0 0 1 4-4z'/%3E%3Cpath fill='white' d='M8.5 14h7l-3.5 8z'/%3E%3C/svg%3E";

export default function AltEntry() {
  const { isAuthenticated, isLoadingAuth, user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (isLoadingAuth || !isAuthenticated || !user?.id) return;
    base44.entities.PlayerProfile.filter({ user_id: user.id }, { limit: 1 })
      .then(({ items }) => setProfile(items[0] || null))
      .catch(() => setProfile(null))
      .finally(() => setLoadingProfile(false));
  }, [isAuthenticated, isLoadingAuth, user?.id]);

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0c4a30' }}>
        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: '/alt-entry' }} />;
  }

  if (loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0c4a30' }}>
        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const allowed = profile && ALLOWED_ROLES.includes(profile.role);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden" style={{ backgroundColor: '#0c4a30' }}>
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{ backgroundImage: `url("${PATTERN}")`, backgroundSize: '56px 56px' }}
      />
      <div className="relative max-w-md w-full text-center">
        <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/2724130c5_file_00000000f0cc81f689edd7e643506d5b-removebg-preview.png" alt="ICECREAMET" className="h-20 w-auto object-contain mx-auto mb-3 drop-shadow-lg" />
        <h1 className="text-4xl font-display text-white tracking-wide">ICECREAMET</h1>
        <div className="flex items-center gap-3 my-4">
          <div className="h-px flex-1 bg-white/30" />
          <IceCream className="text-white/80" size={18} />
          <div className="h-px flex-1 bg-white/30" />
        </div>

        {allowed ? (
          <>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white/90 text-sm mb-6">
              <ShieldCheck size={16} /> Backup Entrance · Co-Owners+
            </div>
            <p className="text-white/70 text-sm mb-8">
              This is the alternate backup entrance. Your account, blooks, tokens, and progress are all here — same as the main link. Share this link only with trusted staff.
            </p>
            <button
              onClick={() => navigate('/stats')}
              className="flex items-center gap-2 px-8 py-3.5 rounded-full font-display text-[#0c4a30] shadow-lg hover:scale-[1.02] transition-transform mx-auto"
              style={{ backgroundColor: '#93d4ad' }}
            >
              <IceCream size={18} /> Enter ICECREAMET
            </button>
          </>
        ) : (
          <>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20 text-red-200 text-sm mb-6">
              <Lock size={16} /> Access Denied
            </div>
            <p className="text-white/70 text-sm">
              This backup entrance is restricted to Co-Owners and above. If you believe this is a mistake, contact an owner.
            </p>
          </>
        )}
      </div>
    </div>
  );
}