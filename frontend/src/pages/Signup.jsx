import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { 
  Mail, Lock, Eye, EyeOff, User, GraduationCap, 
  Loader2, ShieldCheck, ArrowRight, CheckCircle2 
} from 'lucide-react';
import { WaterWaveCanvas } from '../components/WaterWaveCanvas';
import { GoogleLoginButton } from '../components/GoogleLoginButton';

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
        role: role,
        student_class: role === 'student' ? studentClass : null
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Google sign-up failed.');
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

      {/* -- Right Side: Minimalist Clean Registration Form (Zero Scroll) -- */}
      <div className="w-full md:w-1/2 min-h-screen flex flex-col justify-between p-6 sm:p-10 lg:p-12 bg-[#171719] relative z-10 overflow-hidden">
        <div />

        <div className="w-full max-w-[400px] mx-auto space-y-4">
          {/* Brand Icon */}
          <div className="flex justify-center">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 border border-white/10 p-2 flex items-center justify-center shadow-lg">
              <img src="/logo.png" alt="OmniOS" className="w-7 h-7 object-contain rounded-lg" />
            </div>
          </div>

          {/* Heading */}
          <div className="text-center space-y-1">
            <h1 className="text-xl sm:text-2xl font-serif font-normal tracking-tight text-zinc-100">
              {requiresOtp ? "Verify Email OTP" : "Create your account"}
            </h1>
            <p className="text-[11px] text-zinc-400">
              {requiresOtp 
                ? `Enter the 6-digit verification code sent to ${email}`
                : "Join Classroom & OmniAI Studio in seconds."}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-800/50 text-xs text-red-300 text-center font-medium">
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
                <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5 font-mono text-center">
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder=""
                  className="w-full bg-[#111113] border border-zinc-800 rounded-xl py-2.5 text-center text-2xl font-mono tracking-[0.4em] text-indigo-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-inner"
                />
              </div>

              <button
                type="submit"
                disabled={verifyingOtp || otpCode.length < 6}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 text-white font-semibold text-xs py-2.5 rounded-xl transition duration-200 shadow-lg shadow-indigo-600/25 flex items-center justify-center space-x-2"
              >
                {verifyingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>{verifyingOtp ? 'Verifying...' : 'Verify Code & Complete Sign Up'}</span>
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setRequiresOtp(false)}
                  className="text-zinc-400 hover:text-white transition font-medium text-[11px]"
                >
                  ? Change email
                </button>

                <button
                  type="button"
                  disabled={resendingOtp || resendCooldown > 0}
                  onClick={handleResendOtp}
                  className="text-indigo-400 hover:text-indigo-300 disabled:text-zinc-600 font-semibold transition text-[11px]"
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
              {/* Google Sign-Up with Spectrum Spotlight Card */}
              <div className="w-full flex justify-center">
                <GoogleLoginButton
                  onCredentialReceived={handleGoogleCredential}
                  buttonText="Sign up with Google"
                  textType="signup_with"
                  className="w-full"
                />
              </div>

              {/* OR Divider Line */}
              <div className="relative flex items-center justify-center py-1">
                <div className="border-t border-zinc-800 w-full" />
                <span className="bg-[#171719] px-3 text-[10px] font-mono text-zinc-500 uppercase tracking-widest absolute">
                  OR
                </span>
              </div>

              {/* Compact Multi-Column Form */}
              <form onSubmit={handleSubmit} className="space-y-2.5">
                {/* Row 1: Full Name & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1 font-mono">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Subham Kumar"
                        className="w-full bg-[#111113] border border-zinc-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-inner"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1 font-mono">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full bg-[#111113] border border-zinc-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-inner"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 2: Password & Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1 font-mono">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder=""
                        className="w-full bg-[#111113] border border-zinc-800 rounded-xl pl-8 pr-8 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300 transition"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1 font-mono">
                      Confirm
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder=""
                        className="w-full bg-[#111113] border border-zinc-800 rounded-xl pl-8 pr-8 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300 transition"
                      >
                        {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Row 3: Role Selector & Class Level */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1 font-mono">
                      Account Role
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#111113] rounded-xl border border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setRole('student')}
                        className={`py-1 text-[11px] font-semibold rounded-lg transition duration-150 ${
                          role === 'student'
                            ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-sm shadow-indigo-600/30'
                            : 'text-zinc-400 hover:text-white'
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
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        Teacher
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1 font-mono flex items-center gap-1">
                      <GraduationCap className="w-3 h-3 text-emerald-400" />
                      <span>{role === 'student' ? 'Class Level' : 'Department'}</span>
                    </label>
                    {role === 'student' ? (
                      <select
                        value={studentClass}
                        onChange={(e) => setStudentClass(e.target.value)}
                        className="w-full bg-[#111113] border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition cursor-pointer"
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
                      <div className="w-full bg-[#111113] border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-indigo-300 font-medium flex items-center">
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

          {/* Switch to Login */}
          <div className="text-center pt-1">
            <p className="text-xs text-zinc-400">
              Already have an account?{' '}
              <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-4">
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
