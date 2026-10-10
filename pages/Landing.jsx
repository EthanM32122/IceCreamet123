import React from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { UserRound, UserPlus, IceCream } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

const LANDING_IMG = 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/8961aa911_image.png';
const PATTERN = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24'%3E%3Cpath fill='white' d='M12 2a4 4 0 0 1 4 4v.5a1 1 0 0 1-.3.7L12 14 8.3 7.2a1 1 0 0 1-.3-.7V6a4 4 0 0 1 4-4z'/%3E%3Cpath fill='white' d='M8.5 14h7l-3.5 8z'/%3E%3C/svg%3E";

export default function Landing() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const navigate = useNavigate();

  if (!isLoadingAuth && isAuthenticated) {
    return <Navigate to="/stats" replace />;
  }

  return (
    <div className="min-h-screen flex">
      {/* Left content panel */}
      <div className="w-full md:w-1/2 flex flex-col justify-center px-8 sm:px-16 relative overflow-hidden" style={{ backgroundColor: '#0c4a30' }}>
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: `url("${PATTERN}")`, backgroundSize: '56px 56px' }}
        />
        <div className="relative max-w-md mx-auto w-full">
          <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/2724130c5_file_00000000f0cc81f689edd7e643506d5b-removebg-preview.png" alt="ICECREAMET" className="h-24 w-auto object-contain mb-3 drop-shadow-lg" />
          <h1 className="text-5xl sm:text-6xl font-display text-white tracking-wide leading-none">ICECREAMET</h1>
          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-white/30" />
            <IceCream className="text-white/80" size={20} />
            <div className="h-px flex-1 bg-white/30" />
          </div>
          <p className="text-white/90 text-lg">a blooket private server</p>
          <p className="text-white/60 text-sm mt-1">created by icecreamy</p>

          <div className="flex flex-col gap-3 mt-10 max-w-xs">
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-3 px-6 py-3.5 rounded-full font-display text-[#0c4a30] shadow-lg hover:scale-[1.02] transition-transform"
              style={{ backgroundColor: '#93d4ad' }}
            >
              <span className="w-8 h-8 rounded-full bg-[#0c4a30]/15 flex items-center justify-center">
                <UserRound size={18} className="text-[#0c4a30]" />
              </span>
              LOGIN
            </button>
            <button
              onClick={() => navigate('/register')}
              className="flex items-center gap-3 px-6 py-3.5 rounded-full font-display text-[#0c4a30] bg-white shadow-lg hover:scale-[1.02] transition-transform"
            >
              <span className="w-8 h-8 rounded-full bg-[#0c4a30]/10 flex items-center justify-center">
                <UserPlus size={18} className="text-[#0c4a30]" />
              </span>
              REGISTER
            </button>
          </div>
        </div>
      </div>

      {/* Right imagery panel */}
      <div className="hidden md:block w-1/2 relative" style={{ backgroundColor: '#93d4ad' }}>
        <img src={LANDING_IMG} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: 'right center' }} />
      </div>
    </div>
  );
}