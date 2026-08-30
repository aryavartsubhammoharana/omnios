import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { BookOpen, KeyRound, Mail, User, GraduationCap, Loader2, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '208360710553-s8ccnmol8g9klrljcumtoda23gqsokl3.apps.googleusercontent.com';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('student');
  const [studentClass, setStudentClass] = useState('Class 11 Science');
  const [error, setError] = useState('');
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [requiresOtp, setRequiresOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpMessage, setOtpMessage] = useState('');

  const { user, loading, signup, verifyOtp, resendOtp, googleLogin } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    let timer = null;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCooldown]);

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
          document.getElementById('googleSignUpBtnDiv'),
          { theme: 'filled_black', size: 'large', width: '100%', shape: 'pill', text: 'signup_with' }
        );
      }
    };
    document.body.appendChild(script);

    return () => {
      try {
        document.body.removeChild(script);
      } catch (e) {}
    };
  }, [user, role, studentClass]);

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
        role: role,
        student_class: role === 'student' ? studentClass : null
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Google sign-up failed.');
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await signup(
        email.trim(),
        password,
        fullName.trim(),
        role,
        role === 'student' ? studentClass : null
      );
      if (res.requires_otp) {
        setRequiresOtp(true);
        setOtpMessage(res.message);
        setResendCooldown(60);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode.trim() || verifyingOtp) return;
    setVerifyingOtp(true);
    setError('');
    try {
      await verifyOtp(email.trim(), otpCode.trim());
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid or expired OTP. Please try again.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendingOtp || resendCooldown > 0) return;
    setResendingOtp(true);
    setError('');
    try {
      const res = await resendOtp(email.trim());
      setOtpMessage(res.message);
      setResendCooldown(60);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resend OTP.');
    } finally {
      setResendingOtp(false);
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
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            {requiresOtp ? "Verify Email OTP" : "Create OmniOS Account"}
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            {requiresOtp ? `Enter the 6-digit code sent to ${email}` : "Join Classroom & OmniAI Studio"}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-xl text-center">
            {error}
          </div>
        )}

        {otpMessage && requiresOtp && (
          <div className="mb-4 p-3 bg-indigo-950/60 border border-indigo-800 text-indigo-300 text-xs rounded-xl text-center flex items-center justify-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{otpMessage}</span>
          </div>
        )}

        {requiresOtp ? (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5 font-mono text-center">
                Enter 6-Digit Verification Code
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 text-center text-xl font-mono tracking-widest text-indigo-300 focus:outline-none focus:border-indigo-500 shadow-inner"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={verifyingOtp || otpCode.length < 6}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs py-3 rounded-xl transition duration-200 shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2"
            >
              {verifyingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              <span>{verifyingOtp ? 'Verifying...' : 'Verify Code & Sign In'}</span>
            </button>

            <div className="flex items-center justify-between text-xs pt-2">
              <button
                type="button"
                onClick={() => setRequiresOtp(false)}
                className="text-gray-400 hover:text-white transition"
              >
                ← Back to edit email
              </button>

              <button
                type="button"
                disabled={resendingOtp || resendCooldown > 0}
                onClick={handleResendOtp}
                className="text-indigo-400 hover:text-indigo-300 disabled:text-gray-600 font-semibold transition"
              >
                {resendingOtp 
                  ? 'Sending...' 
                  : resendCooldown > 0 
                    ? `Resend in ${resendCooldown}s` 
                    : 'Resend OTP'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center min-h-[44px]">
              <div id="googleSignUpBtnDiv" className="w-full flex justify-center"></div>
              {loadingGoogle && (
                <div className="flex items-center space-x-2 text-xs text-indigo-400 mt-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating account with Google (No OTP required)...</span>
                </div>
              )}
            </div>

            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-gray-800 w-full"></div>
              <span className="bg-[#0e131f] px-3 text-[10px] uppercase font-mono text-gray-500 absolute">
                or register on server
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5 font-mono">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Subham Kumar"
                    className="w-full bg-gray-900/90 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 shadow-inner transition"
                  />
                </div>
              </div>

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
                    placeholder="student@example.com"
                    className="w-full bg-gray-900/90 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 shadow-inner transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5 font-mono">
                    Password
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-gray-900/90 border border-gray-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 shadow-inner transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5 font-mono">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-gray-900/90 border border-gray-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 shadow-inner transition"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5 font-mono">
                  Select Role
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('student')}
                    className={`py-2 text-xs font-bold rounded-xl border transition ${
                      role === 'student'
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                        : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('teacher')}
                    className={`py-2 text-xs font-bold rounded-xl border transition ${
                      role === 'teacher'
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                        : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    Teacher
                  </button>
                </div>
              </div>

              {role === 'student' && (
                <div>
                  <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5 font-mono flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Student Class / Grade</span>
                  </label>
                  <select
                    value={studentClass}
                    onChange={(e) => setStudentClass(e.target.value)}
                    className="w-full bg-gray-900/90 border border-gray-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 shadow-inner transition cursor-pointer"
                  >
                    <option value="Class 11 Science">Class 11 Science</option>
                    <option value="Class 12 Science">Class 12 Science</option>
                    <option value="Class 10 Board">Class 10 Board</option>
                    <option value="Class 9 Foundation">Class 9 Foundation</option>
                    <option value="JEE / NEET Advanced">JEE / NEET Advanced</option>
                    <option value="College / Engineering">College / Engineering</option>
                    <option value="General Science">General Science</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs py-3 rounded-xl transition duration-200 shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                <span>{submitting ? 'Creating Account & Sending OTP...' : 'Create Account & Send OTP'}</span>
              </button>
            </form>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-gray-800/80 text-center">
          <p className="text-xs text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-400 hover:underline font-semibold">
              Log in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
