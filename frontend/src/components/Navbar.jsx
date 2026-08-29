import React, { useContext, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { BookOpen, Sparkles, LogOut, User, PlusCircle, Flame, Bot } from 'lucide-react';
import API from '../api/client';

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (user) {
      API.get('/api/analytics/streak')
        .then(res => setStreak(res.data.current_streak || 0))
        .catch(() => {});
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-[#090d16]/80 backdrop-blur-xl border-b border-gray-800/80 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
      {/* Brand / Logo (Left) */}
      <div className="flex items-center space-x-6">
        <Link to="/" className="flex items-center space-x-2.5 text-indigo-400 hover:text-indigo-300 transition group">
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

            {/* Profile Badge */}
            <div className="flex items-center space-x-2 bg-gray-900/90 border border-gray-800 px-3 py-1.5 rounded-xl text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
              <span className="font-medium text-gray-200">{user.full_name}</span>
              <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-bold uppercase">
                {user.role}
              </span>
            </div>

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
  );
}
