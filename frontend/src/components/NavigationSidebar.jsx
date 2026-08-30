import React, { useState, useEffect, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import API from '../api/client';
import { 
  Home, Calendar, Sparkles, GraduationCap, 
  Archive, Settings, ChevronDown, ChevronUp, 
  Menu, X, BookOpen, LogOut, FileText, Bot
} from 'lucide-react';

export default function NavigationSidebar({ isOpen, onToggle, onOpenSettings }) {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const [classrooms, setClassrooms] = useState([]);
  const [enrolledOpen, setEnrolledOpen] = useState(true);

  // Fetch enrolled classrooms for the sidebar list
  useEffect(() => {
    if (user && user.is_role_confirmed !== false) {
      API.get('/api/classroom/list')
        .then((res) => {
          if (Array.isArray(res.data)) {
            setClassrooms(res.data);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  // Color generator for circular letter badges
  const getBadgeColor = (str, index) => {
    const colors = [
      'bg-blue-600/30 text-blue-300 border-blue-500/40',
      'bg-indigo-600/30 text-indigo-300 border-indigo-500/40',
      'bg-purple-600/30 text-purple-300 border-purple-500/40',
      'bg-emerald-600/30 text-emerald-300 border-emerald-500/40',
      'bg-amber-600/30 text-amber-300 border-amber-500/40',
      'bg-cyan-600/30 text-cyan-300 border-cyan-500/40',
    ];
    return colors[index % colors.length];
  };

  const isActive = (path) => {
    if (path === '/dashboard' && location.pathname === '/dashboard') return true;
    if (path !== '/dashboard' && location.pathname.startsWith(path)) return true;
    return false;
  };

  if (!user || user.is_role_confirmed === false) return null;

  return (
    <>
      {/* Backdrop Overlay when Expanded */}
      <div
        onClick={onToggle}
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* -- EXPANDED SIDEBAR DRAWER (Google Classroom Style) -- */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 sm:w-80 bg-[#121620] text-gray-200 border-r border-gray-800 shadow-2xl flex flex-col justify-between transition-transform duration-300 ease-in-out transform select-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top: Header with Hamburger + Brand */}
        <div>
          <div className="h-[61px] px-4 flex items-center space-x-3 border-b border-gray-800/80 bg-[#0d111a]">
            <button
              onClick={onToggle}
              className="p-2 rounded-full hover:bg-gray-800 text-gray-300 hover:text-white transition cursor-pointer"
              title="Close menu"
            >
              <Menu className="w-5 h-5 text-gray-300" />
            </button>

            <Link to="/dashboard" onClick={onToggle} className="flex items-center space-x-2.5">
              <img src="/logo.png" alt="Logo" className="w-7 h-7 rounded-lg object-cover border border-indigo-500/40 shadow-sm" />
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-white tracking-tight">OmniOS</span>
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  PRO
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Items (Material 3 Style Pill Highlight) */}
          <div className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)]">
            {/* 1. Home / Classrooms */}
            <Link
              to="/dashboard"
              onClick={onToggle}
              className={`flex items-center space-x-4 px-4 py-2.5 rounded-r-full text-sm font-medium transition ${
                isActive('/dashboard')
                  ? 'bg-sky-500/20 text-sky-300 font-semibold'
                  : 'text-gray-300 hover:bg-gray-800/70 hover:text-white'
              }`}
            >
              <Home className={`w-5 h-5 ${isActive('/dashboard') ? 'text-sky-400' : 'text-gray-400'}`} />
              <span>Home</span>
            </Link>

            {/* 2. Daily Practice & Calendar */}
            <Link
              to="/student/daily-hub"
              onClick={onToggle}
              className={`flex items-center space-x-4 px-4 py-2.5 rounded-r-full text-sm font-medium transition ${
                isActive('/student/daily-hub')
                  ? 'bg-sky-500/20 text-sky-300 font-semibold'
                  : 'text-gray-300 hover:bg-gray-800/70 hover:text-white'
              }`}
            >
              <Calendar className={`w-5 h-5 ${isActive('/student/daily-hub') ? 'text-sky-400' : 'text-gray-400'}`} />
              <span>Calendar & Daily AI</span>
            </Link>

            {/* 3. OmniAI Studio (Gemini) */}
            <Link
              to="/notebooklm"
              onClick={onToggle}
              className={`flex items-center space-x-4 px-4 py-2.5 rounded-r-full text-sm font-medium transition ${
                isActive('/notebooklm')
                  ? 'bg-sky-500/20 text-sky-300 font-semibold'
                  : 'text-gray-300 hover:bg-gray-800/70 hover:text-white'
              }`}
            >
              <Sparkles className={`w-5 h-5 ${isActive('/notebooklm') ? 'text-indigo-400' : 'text-gray-400'}`} />
              <span>OmniAI (Gemini Studio)</span>
            </Link>

            {/* Divider */}
            <div className="py-2">
              <div className="border-t border-gray-800" />
            </div>

            {/* 4. Enrolled Section Header */}
            <div>
              <button
                type="button"
                onClick={() => setEnrolledOpen(!enrolledOpen)}
                className="w-full flex items-center justify-between px-4 py-2 rounded-r-full text-sm font-semibold text-gray-400 hover:text-white hover:bg-gray-800/50 transition cursor-pointer"
              >
                <div className="flex items-center space-x-3.5">
                  <GraduationCap className="w-5 h-5 text-gray-400" />
                  <span>Enrolled Classes</span>
                </div>
                {enrolledOpen ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>

              {/* Collapsible Classroom List with Circular Badges */}
              {enrolledOpen && (
                <div className="mt-1 space-y-0.5 pl-2">
                  {classrooms.length === 0 ? (
                    <div className="px-6 py-2 text-xs text-gray-500 italic">
                      No classrooms joined yet
                    </div>
                  ) : (
                    classrooms.map((c, idx) => {
                      const firstChar = c.name ? c.name.charAt(0).toUpperCase() : 'C';
                      const isCurrentClass = location.pathname === `/classroom/${c.id}`;

                      return (
                        <Link
                          key={c.id}
                          to={`/classroom/${c.id}`}
                          onClick={onToggle}
                          className={`flex items-center space-x-3 px-3 py-2 rounded-r-full text-xs transition ${
                            isCurrentClass
                              ? 'bg-sky-500/20 text-sky-200 font-semibold'
                              : 'text-gray-300 hover:bg-gray-800/70 hover:text-white'
                          }`}
                        >
                          {/* Circular Letter Badge */}
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border flex-shrink-0 ${getBadgeColor(c.name, idx)}`}>
                            {firstChar}
                          </div>
                          <div className="truncate min-w-0">
                            <span className="block truncate font-medium">{c.name}</span>
                            <span className="block text-[10px] text-gray-500 truncate">
                              {c.teacher_name ? `By ${c.teacher_name}` : c.description || 'OmniOS Class'}
                            </span>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="py-2">
              <div className="border-t border-gray-800" />
            </div>

            {/* 5. Document Reader / Archive */}
            <Link
              to="/quick-reader"
              onClick={onToggle}
              className={`flex items-center space-x-4 px-4 py-2.5 rounded-r-full text-sm font-medium transition ${
                isActive('/quick-reader')
                  ? 'bg-sky-500/20 text-sky-300 font-semibold'
                  : 'text-gray-300 hover:bg-gray-800/70 hover:text-white'
              }`}
            >
              <Archive className={`w-5 h-5 ${isActive('/quick-reader') ? 'text-sky-400' : 'text-gray-400'}`} />
              <span>Document & PDF Reader</span>
            </Link>

            {/* 6. Settings */}
            <button
              type="button"
              onClick={() => {
                onToggle();
                if (onOpenSettings) onOpenSettings();
              }}
              className="w-full flex items-center space-x-4 px-4 py-2.5 rounded-r-full text-sm font-medium text-gray-300 hover:bg-gray-800/70 hover:text-white transition cursor-pointer"
            >
              <Settings className="w-5 h-5 text-gray-400" />
              <span>Settings</span>
            </button>
          </div>
        </div>

        {/* Bottom User Area */}
        <div className="p-3 border-t border-gray-800 bg-[#0d111a]">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center space-x-2.5 truncate">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.full_name} className="w-8 h-8 rounded-full object-cover border border-indigo-500/40" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold text-xs">
                  {user.full_name ? user.full_name[0].toUpperCase() : 'U'}
                </div>
              )}
              <div className="truncate min-w-0">
                <span className="text-xs font-semibold text-white block truncate">{user.full_name}</span>
                <span className="text-[10px] text-gray-400 block truncate font-mono">{user.email}</span>
              </div>
            </div>

            <button
              onClick={() => {
                onToggle();
                logout();
              }}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
