import React from "react";
import BlookJumpers from "./BlookJumpers";

const AUTH_BG = "https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/78f41779e_Screenshot_20260930-2137052.jpg";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8 bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url("${AUTH_BG}")` }}
    >
      <BlookJumpers />
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
          <h1 className="text-4xl font-display text-white tracking-tight" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.7)" }}>{title}</h1>
          {subtitle && <p className="text-white/90 mt-2 font-display" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}>{subtitle}</p>}
        </div>
        <div className="rounded-2xl border border-white/30 shadow-xl p-8 backdrop-blur-md bg-white/15">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm mt-6 text-white font-display drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">{footer}</p>
        )}
      </div>
    </div>
  );
}