import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';
import { GoogleLoginButton } from '../components/GoogleLoginButton';

export default function Login() {
  const [error, setError] = useState('');
  const { user, loading, googleLogin } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#090d16]">
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

  return (
    <div className="min-h-screen w-screen bg-[#090d16] text-zinc-100 flex items-center justify-center p-6 relative overflow-hidden font-sans select-none">
      {/* Subtle ambient glowing orbs */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-indigo-600/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 translate-y-1/2 w-[420px] h-[420px] bg-violet-600/10 rounded-full blur-[110px] pointer-events-none" />

      {/* Center Minimalist Clean Login Card */}
      <div className="w-full max-w-[400px] p-8 sm:p-10 rounded-3xl bg-[#111113]/85 border border-white/10 backdrop-blur-2xl shadow-2xl space-y-6 relative z-10 animate-in fade-in zoom-in-95 duration-300">
        {/* Brand Icon */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 border border-white/10 p-2.5 flex items-center justify-center shadow-lg">
            <img src="/logo.png" alt="OmniOS" className="w-9 h-9 object-contain rounded-lg" />
          </div>
        </div>

        {/* Heading */}
        <div className="text-center space-y-1.5">
          <h1 className="text-2xl font-serif sm:text-[28px] font-normal tracking-tight text-zinc-100">
            Log into your account
          </h1>
          <p className="text-xs text-zinc-400">
            Continue with your Google account
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/50 text-xs text-red-300 text-center font-medium">
            {error}
          </div>
        )}

        {/* Google Sign-In Action */}
        <div className="pt-2">
          <div className="w-full flex justify-center">
            <GoogleLoginButton
              onCredentialReceived={handleGoogleCredential}
              buttonText="Continue with Google"
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
