import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import API from '../api/client';
import { 
  BookOpen, LogOut, Sparkles, Flame, User, Bot, 
  GraduationCap, Settings, Mail, X, Check, Loader2 
} from 'lucide-react';

export default function Navbar() {
  const { user, logout, updateProfile } = useContext(AuthContext);
  const navigate = useNavigate();
  const [streak, setStreak] = useState(1);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editClass, setEditClass] = useState('Class 11 Science');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setEditName(user.full_name || '');
      setEditClass(user.student_class || 'Class 11 Science');
      API.get('/api/analytics/my-streak')
        .then((res) => {
          if (res.data?.current_streak !== undefined) {
            setStreak(res.data.current_streak);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile({
        full_name: editName,
        student_class: editClass
      });
      setProfileSuccess(true);
      setTimeout(() => {
        setProfileSuccess(false);
        setShowProfileModal(false);
      }, 1200);
    } catch (err) {
      console.error('Error updating profile', err);
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <>
      <nav className="h-[61px] bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
        {/* Brand Logo (Left) */}
        <div className="flex items-center space-x-6">
          <Link to="/dashboard" className="flex items-center space-x-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-600/20 group-hover:scale-105 transition">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-400 tracking-tight">
                  NoteAI
                </span>
                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  PRO
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-medium tracking-tight">DLMNotebook + Classroom</p>
            </div>
          </Link>
        </div>

        {/* Navigation Tabs (Center) */}
        {user && (
          <div className="hidden md:flex items-center bg-gray-900/90 border border-gray-800/80 rounded-xl p-1 gap-1 shadow-inner">
            <Link
              to="/dashboard"
              className="text-xs px-3.5 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800/60 font-medium transition flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span>Classrooms</span>
            </Link>
            <Link
              to="/notebooklm"
              className="text-xs px-3.5 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800/60 font-medium transition flex items-center gap-1.5"
            >
              <Bot className="w-3.5 h-3.5 text-purple-400" />
              <span>DLM Notebook</span>
            </Link>
            {user.role === 'student' && (
              <Link
                to="/student/daily-hub"
                className="text-xs px-3.5 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-medium transition flex items-center gap-1.5 hover:bg-indigo-600/30"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>🎯 Daily AI Practice & Videos</span>
              </Link>
            )}
          </div>
        )}

        {/* User Controls & Streak (Right) */}
        <div className="flex items-center space-x-3">
          {user ? (
            <div className="flex items-center space-x-2.5">
              {/* Gamified Streak Counter */}
              <div 
                title={`${streak} consecutive active study days`}
                className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold shadow-inner"
              >
                <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-pulse" />
                <span>{streak} {streak === 1 ? 'Day' : 'Days'} Streak</span>
              </div>

              {/* Profile Badge & Settings Trigger */}
              <button
                onClick={() => setShowProfileModal(true)}
                className="flex items-center space-x-2 bg-gray-900/90 hover:bg-gray-800 border border-gray-800 px-3 py-1.5 rounded-xl text-xs transition group cursor-pointer shadow-inner"
                title="Edit Student Profile & Class"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.full_name} className="w-5 h-5 rounded-full object-cover border border-indigo-500/50" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold text-[10px]">
                    {user.full_name ? user.full_name[0].toUpperCase() : 'U'}
                  </div>
                )}
                <span className="font-medium text-gray-200 group-hover:text-white max-w-[100px] truncate">{user.full_name}</span>
                {user.student_class && (
                  <span className="text-[9px] bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.5 rounded font-mono hidden sm:inline">
                    {user.student_class}
                  </span>
                )}
                <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-bold uppercase">
                  {user.role}
                </span>
                <Settings className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-300" />
              </button>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-xl transition text-xs flex items-center gap-1"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2.5">
              <Link to="/login" className="text-xs font-medium text-gray-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">
                Login
              </Link>
              <Link to="/signup" className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-xl shadow-lg shadow-indigo-600/20 transition">
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Student Profile Settings Modal */}
      {showProfileModal && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md glass-card p-6 sm:p-8 rounded-3xl border border-gray-800 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowProfileModal(false)}
              className="absolute top-5 right-5 p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-3 mb-6 border-b border-gray-800 pb-4">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.full_name} className="w-12 h-12 rounded-2xl object-cover border border-indigo-500/50 shadow" />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center font-bold text-lg">
                  {user.full_name ? user.full_name[0].toUpperCase() : 'U'}
                </div>
              )}
              <div>
                <h3 className="text-base font-bold text-white">{user.role === 'student' ? 'Student Profile' : 'User Profile'}</h3>
                <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                  <Mail className="w-3 h-3 text-indigo-400" />
                  <span>{user.email}</span>
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5 font-mono">
                  Full Name (Google / Profile)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition shadow-inner"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5 font-mono flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Student Class / Grade</span>
                </label>
                <select
                  value={editClass}
                  onChange={(e) => setEditClass(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition shadow-inner cursor-pointer"
                >
                  <option value="Class 11 Science">Class 11 Science</option>
                  <option value="Class 12 Science">Class 12 Science</option>
                  <option value="Class 10 Board">Class 10 Board</option>
                  <option value="Class 9 Foundation">Class 9 Foundation</option>
                  <option value="JEE / NEET Advanced">JEE / NEET Advanced</option>
                  <option value="College / Engineering">College / Engineering</option>
                  <option value="General Science">General Science</option>
                </select>
                <p className="text-[10px] text-gray-500 mt-1">
                  AI uses your class to tailor daily diagnostic tests and recommended lecture videos.
                </p>
              </div>

              {profileSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center space-x-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Profile & Class updated successfully!</span>
                </div>
              )}

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{savingProfile ? 'Saving...' : 'Save Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
