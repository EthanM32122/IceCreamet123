import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const persistToken = (result) => {
    if (result?.access_token) {
      try {
        base44.auth.setToken(result.access_token, true);
        localStorage.setItem("base44_access_token", result.access_token);
        localStorage.setItem("token", result.access_token);
      } catch (_) {}
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const settings = await base44.entities.GameSettings.filter({ key: "registration_disabled" });
      if (settings.length > 0 && settings[0].value === "true") {
        setError("New account registration is currently disabled.");
        return;
      }
    } catch (_) {}

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const trimmed = email.trim();
    try {
      // Create account — no email verification code step
      const reg = await base44.auth.register({ email: trimmed, password });
      persistToken(reg);

      // If register already logged us in, go play
      if (reg?.access_token) {
        window.location.href = "/stats";
        return;
      }

      // Otherwise log in with the same email + password
      try {
        const login = await base44.auth.loginViaEmailPassword(trimmed, password);
        persistToken(login);
        window.location.href = "/stats";
        return;
      } catch (_) {
        // Account created; send them to login with the email filled
        navigate("/login", {
          replace: true,
          state: {
            registered: true,
            email: trimmed,
            message: "Account created! Log in with your email and password.",
          },
        });
        return;
      }
    } catch (err) {
      const msg = String(err?.message || err?.data?.message || "");
      // Some Base44 apps still force OTP at API level — fall back to login page
      if (/otp|verif|code|confirm/i.test(msg)) {
        try {
          const login = await base44.auth.loginViaEmailPassword(trimmed, password);
          persistToken(login);
          window.location.href = "/stats";
          return;
        } catch (_) {
          navigate("/login", {
            replace: true,
            state: {
              registered: true,
              email: trimmed,
              message: "Account saved. Log in with your email and password.",
            },
          });
          return;
        }
      }
      setError(msg || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    const returnTo = window.location.origin + "/stats";
    base44.auth.loginWithProvider("google", returnTo);
  };

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create your account"
      subtitle="Sign up with email and password — no code needed"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium mb-6"
        onClick={handleGoogle}
        type="button"
      >
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continue with Google
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-transparent px-3 text-white/80 backdrop-blur-sm">or</span>
        </div>
      </div>

      <div className="mb-4 p-3 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-center">
        <p className="font-display text-sm tracking-wide">⚠️ USE AN EMAIL YOU DO NOT USE</p>
        <p className="text-[11px] text-amber-200/70 mt-1">Protect yourself — use a throwaway email, not your real one.</p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
