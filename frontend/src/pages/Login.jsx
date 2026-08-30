import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { BookOpen, KeyRound, Mail, Loader2, ArrowRight } from 'lucide-react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '208360710553-s8ccnmol8g9klrljcumtoda23gqsokl3.apps.googleusercontent.com';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { user, loading, login, googleLogin } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredentialResponse,
          auto_select: false
        });
        window.google.accounts.id.renderButton(
          document.getElementById('googleSignInBtnDiv'),
          { theme: 'filled_black', size: 'large', width: '100%', shape: 'pill' }
        );
      }
    };
    document.body.appendChild(script);

    return () => {
      try {
        document.body.removeChild(script);
      } catch (e) {}
    };
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center bg-[#090d16]">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleGoogleCredentialResponse = async (response) => {
    if (!response.credential) return;
    setLoadingGoogle(true);
    setError('');
    try {
      await googleLogin({
        credential: response.credential,
        role: 'student'
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Google sign-in failed. Please try again.');
    } finally {
      setLoadingGoogle(false);
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
      setError(err.response?.data?.detail || 'Login failed. Please check credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center bg-[#090d16] px-4 relative overflow-hidden py-8">
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow"></div>
      <div className="fixed bottom-10 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow"></div>

      <div className="w-full max-w-md glass-card p-8 rounded-3xl border border-gray-800/80 shadow-2xl relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex p-1 bg-indigo-950/80 border border-indigo-500/40 rounded-2xl mb-3 shadow-lg shadow-indigo-600/20">
            <img src="/logo.png" alt="OmniOS Logo" className="w-12 h-12 rounded-xl object-cover" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Sign In to OmniOS</h1>
          <p className="text-xs text-gray-400 mt-1">Classroom & OmniAI Studio</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-xl text-center">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center min-h-[44px]">
            <div id="googleSignInBtnDiv" className="w-full flex justify-center"></div>
            {loadingGoogle && (
              <div className="flex items-center space-x-2 text-xs text-indigo-400 mt-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Signing in with Google...</span>
              </div>
            )}
          </div>

          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-gray-800 w-full"></div>
            <span className="bg-[#0e131f] px-3 text-[10px] uppercase font-mono text-gray-500 absolute">
              or continue with email
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5 font-mono">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-gray-900/90 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 shadow-inner transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5 font-mono">
                Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-gray-900/90 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 shadow-inner transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs py-3 rounded-xl transition duration-200 shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              <span>{submitting ? 'Signing in...' : 'Sign In'}</span>
            </button>
          </form>
        </div>

        <div className="mt-6 pt-5 border-t border-gray-800/80 text-center">
          <p className="text-xs text-gray-400">
            Don't have an account?{' '}
            <Link to="/signup" className="text-indigo-400 hover:underline font-semibold">
              Sign up here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
