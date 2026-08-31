import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';
import { WaterWaveCanvas } from '../components/WaterWaveCanvas';
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


  return (
    <div className="min-h-screen w-screen bg-[#111113] text-zinc-100 flex flex-col md:flex-row overflow-hidden font-sans select-none">
      {/* -- Left Side: Interactive Water Wave & Ripple Fluid Physics Canvas -- */}
      <div className="hidden md:flex md:w-1/2 relative bg-[#05070c] overflow-hidden items-center justify-center">
        {/* Real-time Interactive Liquid Water Wave Canvas */}
        <WaterWaveCanvas />
        
        {/* Vignette overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#111113] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#111113]/60 via-transparent to-[#111113]/30 pointer-events-none" />

        {/* Floating branding pill on the canvas */}
        <div className="absolute bottom-8 left-8 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs text-zinc-300 pointer-events-none shadow-lg">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-medium tracking-tight">OmniOS  Academic AI Ecosystem</span>
        </div>
      </div>

      {/* -- Right Side: Minimalist Clean Login Form -- */}
      <div className="w-full md:w-1/2 min-h-screen flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16 bg-[#171719] relative z-10">
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
      </div>
    </div>
  );
}
