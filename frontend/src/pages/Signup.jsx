import React, { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { 
  Mail, Lock, Eye, EyeOff, User, GraduationCap, 
  Loader2, ShieldCheck, ArrowRight, CheckCircle2, Sparkles
} from 'lucide-react';
import ThreadFabricCanvas from '../components/ThreadFabricCanvas';
import MagneticGoogleButton from '../components/MagneticGoogleButton';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '208360710553-s8ccnmol8g9klrljcumtoda23gqsokl3.apps.googleusercontent.com';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

  // Left-pane cursor tracking & 3D tilt
  const leftPaneRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, normalizedX: 0, normalizedY: 0 });

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

  // Google Identity Services
  useEffect(() => {
    if (user || requiresOtp) return;
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
        const btnContainer = document.getElementById('googleSignUpBtnDiv');
        if (btnContainer) {
          window.google.accounts.id.renderButton(
            btnContainer,
            { theme: 'filled_black', size: 'large', width: '100%', shape: 'pill', text: 'signup_with' }
          );
        }
      }
    };
    document.body.appendChild(script);

    return () => {
      try {
        document.body.removeChild(script);
      } catch (e) {}
    };
  }, [user, role, studentClass, requiresOtp]);

  const handleLeftPaneMouseMove = (e) => {
    if (!leftPaneRef.current) return;
    const rect = leftPaneRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const normalizedX = (x / rect.width - 0.5) * 2;
    const normalizedY = (y / rect.height - 0.5) * 2;
    setMousePos({ x, y, normalizedX, normalizedY });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07090e]">
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
    <div className="h-screen w-full bg-[#080b11] text-gray-100 flex flex-col lg:flex-row select-none overflow-hidden">
      {/* =========================================================================
          LEFT SIDE: Interactive Thread & Fabric Physics Canvas + 1:1 Logo
          ========================================================================= */}
      <div
        ref={leftPaneRef}
        onMouseMove={handleLeftPaneMouseMove}
        className="relative lg:w-1/2 min-h-[300px] lg:h-screen bg-gradient-to-br from-[#0a0e1a] via-[#070a13] to-[#04060a] flex flex-col items-center justify-center p-6 sm:p-10 overflow-hidden border-b lg:border-b-0 lg:border-r border-gray-800/60"
      >
        {/* Dynamic Cursor Spotlight Effect */}
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300 opacity-70"
          style={{
            background: `radial-gradient(650px circle at ${mousePos.x}px ${mousePos.y}px, rgba(99, 102, 241, 0.2), rgba(56, 189, 248, 0.08) 35%, transparent 70%)`
          }}
        />

        {/* Ambient Glow Orbs */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-indigo-600/15 rounded-full blur-[100px] pointer-events-none animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-cyan-600/15 rounded-full blur-[100px] pointer-events-none animate-pulse-glow" />

        {/* Interactive Thread & Fabric Physics Canvas Animation */}
        <ThreadFabricCanvas containerRef={leftPaneRef} />

        {/* Centerpiece 3D Interactive Logo Container */}
        <div
          className="relative z-10 flex flex-col items-center text-center max-w-md transition-transform duration-200 ease-out"
          style={{
            transform: `perspective(1000px) rotateY(${mousePos.normalizedX * 10}deg) rotateX(${-mousePos.normalizedY * 10}deg)`
          }}
        >
          {/* 1:1 Project Logo Card with Glowing Borders */}
          <div className="relative group cursor-pointer mb-4">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 rounded-3xl blur-md opacity-75 group-hover:opacity-100 transition duration-500 group-hover:duration-200 animate-tilt"></div>
            <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-3xl p-1 bg-[#090d16] border border-indigo-500/40 shadow-2xl shadow-indigo-950/80 flex items-center justify-center overflow-hidden">
              <img
                src="/logo.png"
                alt="OmniOS Logo"
                className="w-full h-full object-cover rounded-[22px] transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-white/10 rounded-[22px] pointer-events-none" />
            </div>
          </div>

          {/* Badge & Branding Tagline */}
          <div className="inline-flex items-center space-x-2 px-3 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[11px] font-semibold tracking-wide uppercase mb-2 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
            <span>Join OmniOS Ecosystem</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Start Learning with AI
          </h2>
          <p className="text-xs text-gray-400 mt-1 font-normal leading-relaxed px-4 max-w-sm">
            Interactive classrooms, auto-summarized study notes, and diagnostic tests.
          </p>

          {/* Micro Feature Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3.5">
            <span className="px-2.5 py-0.5 text-[10px] font-medium rounded-lg bg-gray-900/80 border border-gray-800 text-gray-300 flex items-center gap-1.5 shadow-sm">
              <ShieldCheck className="w-3 h-3 text-emerald-400" /> Instant Google Sign-Up
            </span>
            <span className="px-2.5 py-0.5 text-[10px] font-medium rounded-lg bg-gray-900/80 border border-gray-800 text-gray-300 flex items-center gap-1.5 shadow-sm">
              <Sparkles className="w-3 h-3 text-indigo-400" /> OmniAI Notebook
            </span>
          </div>
        </div>

        {/* Bottom subtle cursor hint */}
        <div className="absolute bottom-3 text-[10px] text-gray-500 tracking-wider font-mono">
          [ Elastic thread & fabric physics simulation ]
        </div>
      </div>

      {/* =========================================================================
          RIGHT SIDE: Sleek Minimalist Zero-Scroll Registration Form
          ========================================================================= */}
      <div className="lg:w-1/2 h-full bg-[#0d111a] flex items-center justify-center p-4 sm:p-8 relative z-20 overflow-hidden">
        <div className="w-full max-w-[440px] space-y-4">
          {/* Header */}
          <div className="text-center sm:text-left space-y-1">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
              <img src="/logo.png" alt="Logo" className="w-7 h-7 rounded-lg object-cover border border-indigo-500/30 shadow" />
              <span className="text-sm font-bold text-white tracking-tight">OmniOS</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              {requiresOtp ? "Verify Email OTP" : "Create your account"}
            </h1>
            <p className="text-[11px] text-gray-400 font-normal">
              {requiresOtp 
                ? `Enter the 6-digit verification code sent to ${email}`
                : "Join Classroom & OmniAI Studio in seconds."}
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-2.5 bg-red-950/60 border border-red-800/80 text-red-300 text-xs rounded-xl text-center leading-tight">
              {error}
            </div>
          )}

          {/* OTP Sent Notice */}
          {otpMessage && requiresOtp && (
            <div className="p-2.5 bg-indigo-950/60 border border-indigo-800/80 text-indigo-300 text-xs rounded-xl text-center flex items-center justify-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{otpMessage}</span>
            </div>
          )}

          {requiresOtp ? (
            /* OTP Verification Screen */
            <form onSubmit={handleVerifyOtp} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-gray-300 uppercase tracking-wider mb-1.5 font-mono text-center">
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full bg-[#131826] border border-gray-800 rounded-xl py-3 text-center text-2xl font-mono tracking-[0.4em] text-indigo-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-inner"
                />
              </div>

              <button
                type="submit"
                disabled={verifyingOtp || otpCode.length < 6}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 text-white font-semibold text-xs py-3 rounded-xl transition duration-200 shadow-lg shadow-indigo-600/25 flex items-center justify-center space-x-2"
              >
                {verifyingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>{verifyingOtp ? 'Verifying...' : 'Verify Code & Complete Sign Up'}</span>
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setRequiresOtp(false)}
                  className="text-gray-400 hover:text-white transition font-medium text-[11px]"
                >
                  ← Change email
                </button>

                <button
                  type="button"
                  disabled={resendingOtp || resendCooldown > 0}
                  onClick={handleResendOtp}
                  className="text-indigo-400 hover:text-indigo-300 disabled:text-gray-600 font-semibold transition text-[11px]"
                >
                  {resendingOtp 
                    ? 'Sending...' 
                    : resendCooldown > 0 
                      ? `Resend in ${resendCooldown}s` 
                      : 'Resend Code'}
                </button>
              </div>
            </form>
          ) : (
            /* Zero-Scroll Compact Sign-Up Form */
            <div className="space-y-3">
              {/* 3D Magnetic Spotlight & Dynamic Border Sheen Card */}
              <MagneticGoogleButton>
                <div className="w-full min-h-[40px] flex items-center justify-center">
                  <div id="googleSignUpBtnDiv" className="w-full flex justify-center"></div>
                </div>

                {loadingGoogle && (
                  <div className="flex items-center justify-center space-x-2 text-[11px] text-indigo-400 py-0.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Setting up your account with Google...</span>
                  </div>
                )}
              </MagneticGoogleButton>

              {/* OR Divider Line */}
              <div className="relative flex items-center justify-center py-1">
                <div className="border-t border-gray-800 w-full" />
                <span className="bg-[#0d111a] px-3 text-[10px] font-mono text-gray-500 uppercase tracking-widest absolute">
                  OR
                </span>
              </div>

              {/* Server Registration Form (Compact Multi-Column Grid) */}
              <form onSubmit={handleSubmit} className="space-y-2.5">
                {/* Row 1: Full Name & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-300 uppercase tracking-wider mb-1 font-mono">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Subham Kumar"
                        className="w-full bg-[#131826] border border-gray-800/90 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-inner"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-gray-300 uppercase tracking-wider mb-1 font-mono">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full bg-[#131826] border border-gray-800/90 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-inner"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 2: Password & Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-300 uppercase tracking-wider mb-1 font-mono">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#131826] border border-gray-800/90 rounded-xl pl-8 pr-8 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-gray-500 hover:text-gray-300 transition"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-gray-300 uppercase tracking-wider mb-1 font-mono">
                      Confirm
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#131826] border border-gray-800/90 rounded-xl pl-8 pr-8 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2.5 top-2.5 text-gray-500 hover:text-gray-300 transition"
                      >
                        {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Row 3: Role Selector & Class Dropdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-300 uppercase tracking-wider mb-1 font-mono">
                      Account Role
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#131826] rounded-xl border border-gray-800/90">
                      <button
                        type="button"
                        onClick={() => setRole('student')}
                        className={`py-1 text-[11px] font-semibold rounded-lg transition duration-150 ${
                          role === 'student'
                            ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-sm shadow-indigo-600/30'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Student
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('teacher')}
                        className={`py-1 text-[11px] font-semibold rounded-lg transition duration-150 ${
                          role === 'teacher'
                            ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-sm shadow-indigo-600/30'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Teacher
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-gray-300 uppercase tracking-wider mb-1 font-mono flex items-center gap-1">
                      <GraduationCap className="w-3 h-3 text-emerald-400" />
                      <span>{role === 'student' ? 'Class Level' : 'Department'}</span>
                    </label>
                    {role === 'student' ? (
                      <select
                        value={studentClass}
                        onChange={(e) => setStudentClass(e.target.value)}
                        className="w-full bg-[#131826] border border-gray-800/90 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition cursor-pointer"
                      >
                        <option value="Class 11 Science">Class 11 Science</option>
                        <option value="Class 12 Science">Class 12 Science</option>
                        <option value="Class 10 Board">Class 10 Board</option>
                        <option value="Class 9 Foundation">Class 9 Foundation</option>
                        <option value="JEE / NEET Advanced">JEE / NEET</option>
                        <option value="College / Engineering">College / Engg</option>
                        <option value="General Science">General Science</option>
                      </select>
                    ) : (
                      <div className="w-full bg-[#131826] border border-gray-800/90 rounded-xl px-3 py-1.5 text-xs text-indigo-300 font-medium flex items-center">
                        Faculty & Teacher
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 text-white font-semibold text-xs py-2.5 rounded-xl transition duration-200 shadow-lg shadow-indigo-600/25 flex items-center justify-center space-x-2 mt-1"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  <span>{submitting ? 'Sending OTP...' : 'Continue to Verification'}</span>
                </button>
              </form>
            </div>
          )}

          {/* Log In & Terms Footer Links */}
          <div className="space-y-1.5 text-center pt-1">
            <p className="text-xs text-gray-400">
              Already have an account?{' '}
              <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold hover:underline">
                Log in
              </Link>
            </p>

            <p className="text-[9px] text-gray-600 leading-tight max-w-xs mx-auto">
              By registering you agree to our{' '}
              <span className="text-gray-500 hover:underline cursor-pointer">terms of service</span> and{' '}
              <span className="text-gray-500 hover:underline cursor-pointer">privacy policy</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
