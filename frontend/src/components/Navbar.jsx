import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { BookOpen, Sparkles, LogOut, User, PlusCircle } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-slate-900 border-b border-slate-800 px-6 py-3.5 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center space-x-6">
        <Link to="/" className="flex items-center space-x-2 text-xl font-bold text-indigo-400 hover:text-indigo-300">
          <BookOpen className="w-6 h-6 text-indigo-500" />
          <span>NoteAI</span>
          <span className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-700 px-2 py-0.5 rounded-full font-normal">
            NotebookLM + Classroom
          </span>
        </Link>

        {user && (
          <div className="flex items-center space-x-4 ml-6 text-sm">
            <Link to="/dashboard" className="text-slate-300 hover:text-white transition">
              Dashboard
            </Link>
            <Link to="/notebooklm" className="flex items-center space-x-1.5 text-indigo-400 hover:text-indigo-300 font-medium transition">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>NotebookLM Studio</span>
            </Link>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-4">
        {user ? (
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-200">{user.full_name}</span>
              <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded uppercase font-mono">
                {user.role}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1 text-slate-400 hover:text-red-400 transition text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-3">
            <Link to="/login" className="text-sm font-medium text-slate-300 hover:text-white px-3 py-1.5">
              Login
            </Link>
            <Link to="/signup" className="text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg transition">
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
