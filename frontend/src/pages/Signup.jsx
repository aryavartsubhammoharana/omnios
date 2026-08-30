import React, { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { 
  Mail, Lock, Eye, EyeOff, User, GraduationCap, 
  Loader2, ShieldCheck, ArrowRight, CheckCircle2, Sparkles, BookOpen, KeyRound
} from 'lucide-react';

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
  const canvasRef = useRef(null);
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

  // Interactive Neural Particle Canvas on Left Pane
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.clientWidth || 600;
      canvas.height = canvas.parentElement?.clientHeight || 800;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Particle nodes
    const particleCount = 45;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8,
      radius: Math.random() * 2 + 1.2,
      baseAlpha: Math.random() * 0.5 + 0.3
    }));

    let targetMouse = { x: canvas.width / 2, y: canvas.height / 2, active: false };

    const handleMouseMove = (e) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      targetMouse.x = e.clientX - rect.left;
      targetMouse.y = e.clientY - rect.top;
      targetMouse.active = true;
    };

    const handleMouseLeave = () => {
      targetMouse.active = false;
    };

    const container = leftPaneRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseleave', handleMouseLeave);
    }

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        p1.x += p1.vx;
        p1.y += p1.vy;

        if (p1.x < 0 || p1.x > canvas.width) p1.vx *= -1;
        if (p1.y < 0 || p1.y > canvas.height) p1.vy *= -1;

        ctx.beginPath();
        ctx.arc(p1.x, p1.y, p1.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(129, 140, 248, 0.7)';
        ctx.shadowColor = '#6366f1';
        ctx.shadowBlur = 8;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(99, 102, 241, ${0.22 * (1 - dist / 110)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }

        if (targetMouse.active) {
          const dx = p1.x - targetMouse.x;
          const dy = p1.y - targetMouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 160) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(targetMouse.x, targetMouse.y);
            ctx.strokeStyle = `rgba(56, 189, 248, ${0.45 * (1 - dist / 160)})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseleave', handleMouseLeave);
      }
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

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
    <div className="min-h-screen w-full bg-[#080b11] text-gray-100 flex flex-col lg:flex-row select-none overflow-hidden">
      {/* =========================================================================
          LEFT SIDE: Interactive 1:1 Logo + Neural Cursor Reactive Showcase
          ========================================================================= */}
      <div
        ref={leftPaneRef}
        onMouseMove={handleLeftPaneMouseMove}
        className="relative lg:w-1/2 min-h-[380px] lg:min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#070a13] to-[#04060a] flex flex-col items-center justify-center p-8 sm:p-12 overflow-hidden border-b lg:border-b-0 lg:border-r border-gray-800/60"
      >
        {/* Dynamic Cursor Spotlight Effect */}
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300 opacity-70"
          style={{
            background: `radial-gradient(650px circle at ${mousePos.x}px ${mousePos.y}px, rgba(99, 102, 241, 0.18), rgba(56, 189, 248, 0.08) 35%, transparent 70%)`
          }}
        />

        {/* Ambient Glow Orbs */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-indigo-600/15 rounded-full blur-[100px] pointer-events-none animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-cyan-600/15 rounded-full blur-[100px] pointer-events-none animate-pulse-glow" />

        {/* Neural Network Interactive Canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />

        {/* Centerpiece 3D Interactive Logo Container */}
        <div
          className="relative z-10 flex flex-col items-center text-center max-w-md transition-transform duration-200 ease-out"
          style={{
            transform: `perspective(1000px) rotateY(${mousePos.normalizedX * 12}deg) rotateX(${-mousePos.normalizedY * 12}deg)`
          }}
        >
          {/* 1:1 Project Logo Card with Glowing Borders */}
          <div className="relative group cursor-pointer mb-6">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 rounded-3xl blur-md opacity-75 group-hover:opacity-100 transition duration-500 group-hover:duration-200 animate-tilt"></div>
            <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-3xl p-1 bg-[#090d16] border border-indigo-500/40 shadow-2xl shadow-indigo-950/80 flex items-center justify-center overflow-hidden">
              <img
                src="/logo.png"
                alt="OmniOS Logo"
                className="w-full h-full object-cover rounded-[22px] transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-white/10 rounded-[22px] pointer-events-none" />
            </div>
          </div>

          {/* Badge & Branding Tagline */}
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold tracking-wide uppercase mb-3 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
            <span>Join OmniOS Ecosystem</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Start Learning with AI
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-2 font-normal leading-relaxed px-4">
            Create an account to access interactive classrooms, auto-summarized study notes, and diagnostic tests.
          </p>

          {/* Micro Feature Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
            <span className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-gray-900/80 border border-gray-800 text-gray-300 flex items-center gap-1.5 shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Instant Google Sign-Up
            </span>
            <span className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-gray-900/80 border border-gray-800 text-gray-300 flex items-center gap-1.5 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> OmniAI Notebook
            </span>
          </div>
        </div>

        {/* Bottom subtle cursor hint */}
        <div className="absolute bottom-4 text-[10px] text-gray-500 tracking-wider font-mono">
          [ Move cursor to interact with neural grid ]
        </div>
      </div>

      {/* =========================================================================
          RIGHT SIDE: Sleek Minimalist Registration / OTP Form
          ========================================================================= */}
      <div className="lg:w-1/2 min-h-screen bg-[#0d111a] flex items-center justify-center p-6 sm:p-12 relative z-20 overflow-y-auto">
        <div className="w-full max-w-[440px] space-y-6 py-6">
          {/* Header */}
          <div className="text-center sm:text-left space-y-2">
            <div className="flex items-center justify-center sm:justify-start gap-2.5 mb-2">
              <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-xl object-cover border border-indigo-500/30 shadow" />
              <span className="text-base font-bold text-white tracking-tight">OmniOS</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {requiresOtp ? "Verify Email OTP" : "Create your account"}
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 font-normal">
              {requiresOtp 
                ? `Enter the 6-digit verification code sent to ${email}`
                : "Join Classroom & OmniAI Studio in seconds."}
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-red-950/60 border border-red-800/80 text-red-300 text-xs rounded-2xl text-center leading-relaxed">
              {error}
            </div>
          )}

          {/* OTP Sent Notice */}
          {otpMessage && requiresOtp && (
            <div className="p-3 bg-indigo-950/60 border border-indigo-800/80 text-indigo-300 text-xs rounded-2xl text-center flex items-center justify-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{otpMessage}</span>
            </div>
          )}

          {requiresOtp ? (
            /* OTP Verification Screen */
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-gray-300 uppercase tracking-wider mb-2 font-mono text-center">
                  6-Digit Verification Code
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
                    className="w-full bg-[#131826] border border-gray-800 rounded-2xl py-3.5 text-center text-2xl font-mono tracking-[0.4em] text-indigo-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-inner"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={verifyingOtp || otpCode.length < 6}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 text-white font-semibold text-xs py-3.5 rounded-2xl transition duration-200 shadow-lg shadow-indigo-600/25 flex items-center justify-center space-x-2"
              >
                {verifyingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>{verifyingOtp ? 'Verifying...' : 'Verify Code & Complete Sign Up'}</span>
              </button>

              <div className="flex items-center justify-between text-xs pt-2">
                <button
                  type="button"
                  onClick={() => setRequiresOtp(false)}
                  className="text-gray-400 hover:text-white transition font-medium"
                >
                  ← Change email address
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
                      : 'Resend Code'}
                </button>
              </div>
            </form>
          ) : (
            /* Normal Sign-Up Form */
            <div className="space-y-4">
              {/* Google Sign-Up */}
              <div className="space-y-2">
                <div className="w-full min-h-[44px] flex items-center justify-center">
                  <div id="googleSignUpBtnDiv" className="w-full flex justify-center"></div>
                </div>

                {loadingGoogle && (
                  <div className="flex items-center justify-center space-x-2 text-xs text-indigo-400 py-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Setting up your account with Google...</span>
                  </div>
                )}
              </div>

              {/* OR Divider Line */}
              <div className="relative flex items-center justify-center py-2">
                <div className="border-t border-gray-800 w-full" />
                <span className="bg-[#0d111a] px-4 text-[11px] font-mono text-gray-500 uppercase tracking-widest absolute">
                  OR
                </span>
              </div>

              {/* Server Registration Form */}
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-medium text-gray-300 uppercase tracking-wider mb-1.5 font-mono">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Subham Kumar"
                      className="w-full bg-[#131826] border border-gray-800/90 rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-inner"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-300 uppercase tracking-wider mb-1.5 font-mono">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full bg-[#131826] border border-gray-800/90 rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-inner"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-300 uppercase tracking-wider mb-1.5 font-mono">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#131826] border border-gray-800/90 rounded-2xl pl-10 pr-10 py-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3.5 text-gray-500 hover:text-gray-300 transition"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-300 uppercase tracking-wider mb-1.5 font-mono">
                      Confirm
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#131826] border border-gray-800/90 rounded-2xl pl-10 pr-10 py-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-3.5 text-gray-500 hover:text-gray-300 transition"
                      >
                        {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-300 uppercase tracking-wider mb-1.5 font-mono">
                    Account Role
                  </label>
                  <div className="grid grid-cols-2 gap-2.5 p-1 bg-[#131826] rounded-2xl border border-gray-800/90">
                    <button
                      type="button"
                      onClick={() => setRole('student')}
                      className={`py-2 text-xs font-semibold rounded-xl transition duration-150 ${
                        role === 'student'
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/30'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Student
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('teacher')}
                      className={`py-2 text-xs font-semibold rounded-xl transition duration-150 ${
                        role === 'teacher'
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/30'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Teacher
                    </button>
                  </div>
                </div>

                {role === 'student' && (
                  <div>
                    <label className="block text-[11px] font-medium text-gray-300 uppercase tracking-wider mb-1.5 font-mono flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Class / Grade Level</span>
                    </label>
                    <select
                      value={studentClass}
                      onChange={(e) => setStudentClass(e.target.value)}
                      className="w-full bg-[#131826] border border-gray-800/90 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition cursor-pointer"
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

                {/* Submit Button (Pill Styled) */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 text-white font-semibold text-xs py-3.5 rounded-2xl transition duration-200 shadow-lg shadow-indigo-600/25 flex items-center justify-center space-x-2 mt-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  <span>{submitting ? 'Sending 6-Digit OTP...' : 'Continue to Verification'}</span>
                </button>
              </form>
            </div>
          )}

          {/* Log In & Terms Footer Links */}
          <div className="space-y-3 text-center pt-2">
            <p className="text-xs text-gray-400">
              Already have an account?{' '}
              <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold hover:underline">
                Log in
              </Link>
            </p>

            <p className="text-[10px] text-gray-600 leading-relaxed max-w-xs mx-auto">
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
