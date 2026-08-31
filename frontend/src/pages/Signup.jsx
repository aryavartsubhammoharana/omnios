import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { GraduationCap, Loader2 } from 'lucide-react';
import { WaterWaveCanvas } from '../components/WaterWaveCanvas';
import { GoogleLoginButton } from '../components/GoogleLoginButton';

export default function Signup() {
  const [role, setRole] = useState('student');
  const [studentClass, setStudentClass] = useState('Class 11 Science');
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
        role: role,
        student_class: role === 'student' ? studentClass : null
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Google sign-up failed.');
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#111113] text-zinc-100 flex flex-col md:flex-row overflow-hidden font-sans select-none">
      {/* -- Left Side: Interactive Water Wave & Ripple Fluid Physics Canvas -- */}
      <div className="hidden md:flex md:w-1/2 relative bg-[#05070c] overflow-hidden items-center justify-center">
        <WaterWaveCanvas />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#111113] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#111113]/60 via-transparent to-[#111113]/30 pointer-events-none" />
        <div className="absolute bottom-8 left-8 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs text-zinc-300 pointer-events-none shadow-lg">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-medium tracking-tight">OmniOS — Academic AI Ecosystem</span>
        </div>
      </div>

      {/* -- Right Side: Minimalist Clean Sign Up -- */}
      <div className="w-full md:w-1/2 min-h-screen flex flex-col justify-between p-6 sm:p-12 lg:p-16 bg-[#171719] relative z-10">
        <div />

        <div className="w-full max-w-[420px] mx-auto space-y-5">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 border border-white/10 p-2 flex items-center justify-center shadow-lg">
              <img src="/logo.png" alt="OmniOS" className="w-8 h-8 object-contain rounded-lg" />
            </div>
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-2xl font-serif sm:text-[28px] font-normal tracking-tight text-zinc-100">
              Create an account
            </h1>
            <p className="text-xs text-zinc-400">
              Select your role and continue with Google
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/50 text-xs text-red-300 text-center font-medium">
              {error}
            </div>
          )}

          <div className="space-y-4 pt-2">
            {/* Row: Role Selector & Class Level */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5 font-mono">
                  Account Role
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#111113] rounded-xl border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setRole('student')}
                    className={`py-1.5 text-[11px] font-semibold rounded-lg transition duration-150 ${
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
                    className={`py-1.5 text-[11px] font-semibold rounded-lg transition duration-150 ${
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
                <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5 font-mono flex items-center gap-1">
                  <GraduationCap className="w-3 h-3 text-emerald-400" />
                  <span>{role === 'student' ? 'Class Level' : 'Department'}</span>
                </label>
                {role === 'student' ? (
                  <select
                    value={studentClass}
                    onChange={(e) => setStudentClass(e.target.value)}
                    className="w-full bg-[#111113] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition cursor-pointer"
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
                  <div className="w-full bg-[#111113] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-indigo-300 font-medium flex items-center">
                    Faculty & Teacher
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 w-full flex justify-center">
              <GoogleLoginButton
                onCredentialReceived={handleGoogleCredential}
                buttonText="Sign up with Google"
                textType="signup_with"
                className="w-full"
              />
            </div>
          </div>

          <div className="text-center pt-4">
            <p className="text-xs text-zinc-400">
              Already have an account?{' '}
              <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
        <div />
      </div>
    </div>
  );
}
