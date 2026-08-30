import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import { ThreadEffectCanvas } from '../components/ThreadEffectCanvas';
import { GoogleLoginButton } from '../components/GoogleLoginButton';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user, loading, login, googleLogin } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#111113]">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleGoogleCredential = async (credential) => {
    setError('');
    try {
      await googleLogin({
        credential,
        role: 'student'
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Google sign-in failed. Please try again.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#111113] text-zinc-100 flex flex-col md:flex-row overflow-hidden font-sans select-none">
      {/* -- Left Side: Interactive Thread / Tapestry Fabric Canvas -- */}
      <div className="hidden md:flex md:w-1/2 relative bg-[#080d09] overflow-hidden items-center justify-center">
        {/* Real-time Interactive Thread / Stitches Canvas */}
        <ThreadEffectCanvas />
        
        {/* Vignette overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#111113] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#111113]/60 via-transparent to-[#111113]/30 pointer-events-none" />

        {/* Floating branding pill on the canvas */}
        <div className="absolute bottom-8 left-8 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs text-zinc-300 pointer-events-none shadow-lg">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-medium tracking-tight">OmniOS — Academic AI Ecosystem</span>
        </div>
      </div>

      {/* -- Right Side: Minimalist Clean Login Form -- */}
      <div className="w-full md:w-1/2 min-h-screen flex flex-col justify-between p-6 sm:p-12 lg:p-16 bg-[#171719] relative z-10">
        <div />

        <div className="w-full max-w-[360px] mx-auto space-y-6">
          {/* Brand Icon */}
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 border border-white/10 p-2 flex items-center justify-center shadow-lg">
              <img src="/logo.png" alt="OmniOS" className="w-8 h-8 object-contain rounded-lg" />
            </div>
          </div>

          {/* Heading */}
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl font-serif sm:text-[28px] font-normal tracking-tight text-zinc-100">
              Log into your account
            </h1>
            <p className="text-xs text-zinc-400">
              Choose your preferred sign-in method
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/50 text-xs text-red-300 text-center font-medium">
              {error}
            </div>
          )}

          {/* Google Sign-In Action */}
          <div className="pt-1">
            <div className="w-full flex justify-center">
              <GoogleLoginButton
                onCredentialReceived={handleGoogleCredential}
                buttonText="Continue with Google"
                className="w-full"
              />
            </div>
          </div>

          {/* OR Divider Line */}
          <div className="relative flex items-center justify-center py-1">
            <div className="border-t border-zinc-800 w-full" />
            <span className="bg-[#171719] px-3 text-[10px] font-mono text-zinc-500 uppercase tracking-widest absolute">
              OR
            </span>
          </div>

          {/* Email + Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1 font-mono">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-[#111113] border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-inner"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1 font-mono">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#111113] border border-zinc-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-zinc-500 hover:text-zinc-300 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 text-white font-semibold text-xs py-3 rounded-xl transition duration-200 shadow-lg shadow-indigo-600/25 flex items-center justify-center space-x-2 mt-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              <span>{submitting ? 'Signing in...' : 'Sign In'}</span>
            </button>
          </form>

          {/* Switch to Signup */}
          <div className="text-center pt-2">
            <p className="text-xs text-zinc-400">
              Don't have an account?{' '}
              <Link to="/signup" className="text-indigo-400 hover:text-indigo-300 font-semibold hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-8">
          <p className="text-[11px] text-zinc-500 leading-relaxed max-w-sm mx-auto">
            By continuing you agree to our{' '}
            <span className="text-zinc-400 hover:underline cursor-pointer">terms of service</span> and{' '}
            <span className="text-zinc-400 hover:underline cursor-pointer">privacy policy</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
