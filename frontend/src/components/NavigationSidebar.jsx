import React, { useState, useEffect, useContext, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import API from '../api/client';
import { 
  Home, Target, Sparkles, GraduationCap, 
  Archive, Settings, ChevronDown, ChevronUp, 
  Menu, X, BookOpen, LogOut, FileText, Bot
} from 'lucide-react';

export default function NavigationSidebar({ isPinned, onTogglePin, onOpenSettings }) {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState([]);
  const [enrolledOpen, setEnrolledOpen] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef(null);

  // Expanded state is active if either pinned by clicking hamburger OR hovered by cursor
  const isExpanded = isPinned || isHovered;

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
  const getBadgeColor = (index) => {
    const colors = [
      'bg-sky-600/30 text-sky-300 border-sky-500/40',
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

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 180);
  };

  if (!user || user.is_role_confirmed === false) return null;

  return (
    <>
      {/* -- BACKDROP OVERLAY (Only visible when Expanded on mobile/drawer mode) -- */}
      {isExpanded && isPinned && (
        <div
          onClick={onTogglePin}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 lg:hidden"
        />
      )}

      {/* -- PERSISTENT LEFT SIDEBAR CONTAINER (Collapsed Rail <-> Expanded Mode) -- */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`fixed inset-y-0 left-0 z-50 bg-[#0d111a] border-r border-gray-800/80 shadow-2xl flex flex-col justify-between transition-all duration-300 ease-out select-none ${
          isExpanded ? 'w-72 sm:w-80 shadow-black/80' : 'w-[68px]'
        }`}
      >
        {/* -- TOP SECTION -- */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Header Row: Hamburger Button + Logo */}
          <div className="h-[61px] px-3.5 flex items-center border-b border-gray-800/80 bg-[#090d16] flex-shrink-0">
            <button
              onClick={onTogglePin}
              className="p-2 rounded-xl hover:bg-gray-800 text-gray-300 hover:text-white transition cursor-pointer flex-shrink-0 group"
              title="Main menu (Click to toggle pin)"
            >
              <Menu className="w-5 h-5 text-gray-300 group-hover:scale-110 transition-transform" />
            </button>

            {/* Logo and App Title (Visible when expanded) */}
            <div className={`flex items-center space-x-2.5 ml-3 transition-opacity duration-200 overflow-hidden ${
              isExpanded ? 'opacity-100 flex-1' : 'opacity-0 w-0 pointer-events-none'
            }`}>
              <img src="/logo.png" alt="Logo" className="w-7 h-7 rounded-lg object-cover border border-indigo-500/40 shadow-sm flex-shrink-0" />
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-base font-bold text-white tracking-tight">OmniOS</span>
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  PRO
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Items List */}
          <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1 custom-scrollbar">
            {/* 1. Home / Classrooms */}
            <Link
              to="/dashboard"
              title="Home (Classrooms)"
              className={`flex items-center rounded-r-full text-sm font-medium transition group ${
                isExpanded ? 'px-3.5 py-2.5 space-x-3.5' : 'justify-center p-2.5 rounded-2xl mx-auto w-11 h-11'
              } ${
                isActive('/dashboard')
                  ? 'bg-sky-500/20 text-sky-300 font-semibold'
                  : 'text-gray-400 hover:bg-gray-800/60 hover:text-white'
              }`}
            >
              <div className={`flex items-center justify-center flex-shrink-0 ${
                !isExpanded && isActive('/dashboard') ? 'w-10 h-7 rounded-full bg-sky-500/25 text-sky-300 flex items-center justify-center' : ''
              }`}>
                <Home className={`w-5 h-5 ${isActive('/dashboard') ? 'text-sky-400' : 'text-gray-400 group-hover:text-white'}`} />
              </div>
              {isExpanded && <span className="truncate">Home</span>}
            </Link>

            {/* 2. Daily AI Practice & Videos */}
            {user.role === 'student' && (
              <Link
                to="/student/daily-hub"
                title="Daily AI Practice & Focus Videos"
                className={`flex items-center rounded-r-full text-sm font-medium transition group ${
                  isExpanded ? 'px-3.5 py-2.5 space-x-3.5' : 'justify-center p-2.5 rounded-2xl mx-auto w-11 h-11'
                } ${
                  isActive('/student/daily-hub')
                    ? 'bg-sky-500/20 text-sky-300 font-semibold'
                    : 'text-gray-400 hover:bg-gray-800/60 hover:text-white'
                }`}
              >
                <div className={`flex items-center justify-center flex-shrink-0 ${
                  !isExpanded && isActive('/student/daily-hub') ? 'w-10 h-7 rounded-full bg-sky-500/25 text-sky-300 flex items-center justify-center' : ''
                }`}>
                  <Target className={`w-5 h-5 ${isActive('/student/daily-hub') ? 'text-sky-400' : 'text-gray-400 group-hover:text-white'}`} />
                </div>
                {isExpanded && <span className="truncate">Daily AI Practice & Videos</span>}
              </Link>
            )}

            {/* 3. Gemini / OmniAI Studio */}
            <Link
              to="/notebooklm"
              title="OmniAI Studio (Gemini)"
              className={`flex items-center rounded-r-full text-sm font-medium transition group ${
                isExpanded ? 'px-3.5 py-2.5 space-x-3.5' : 'justify-center p-2.5 rounded-2xl mx-auto w-11 h-11'
              } ${
                isActive('/notebooklm')
                  ? 'bg-sky-500/20 text-sky-300 font-semibold'
                  : 'text-gray-400 hover:bg-gray-800/60 hover:text-white'
              }`}
            >
              <div className={`flex items-center justify-center flex-shrink-0 ${
                !isExpanded && isActive('/notebooklm') ? 'w-10 h-7 rounded-full bg-sky-500/25 text-sky-300 flex items-center justify-center' : ''
              }`}>
                <Sparkles className={`w-5 h-5 ${isActive('/notebooklm') ? 'text-indigo-400' : 'text-gray-400 group-hover:text-white'}`} />
              </div>
              {isExpanded && <span className="truncate">OmniAI (Gemini Studio)</span>}
            </Link>

            {/* Divider */}
            <div className="py-1.5 px-2">
              <div className="border-t border-gray-800/80" />
            </div>

            {/* 4. Enrolled Classes (Education Topi / GraduationCap) */}
            <div>
              {/* Topi Header Button */}
              <button
                type="button"
                onClick={() => setEnrolledOpen(!enrolledOpen)}
                title="Enrolled Classes"
                className={`w-full flex items-center rounded-r-full text-sm font-semibold text-gray-400 hover:text-white hover:bg-gray-800/50 transition cursor-pointer ${
                  isExpanded ? 'px-3.5 py-2 justify-between' : 'justify-center p-2.5 rounded-2xl mx-auto w-11 h-11'
                }`}
              >
                <div className="flex items-center space-x-3.5">
                  <GraduationCap className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  {isExpanded && <span>Enrolled</span>}
                </div>
                {isExpanded && (
                  enrolledOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>

              {/* Collapsible Classroom List */}
              {isExpanded && enrolledOpen && (
                <div className="mt-1 space-y-0.5 pl-2 animate-in fade-in duration-200">
                  {classrooms.length === 0 ? (
                    <div className="px-5 py-2 text-xs text-gray-500 italic">
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
                          title={c.name}
                          className={`flex items-center space-x-3 px-3 py-2 rounded-r-full text-xs transition ${
                            isCurrentClass
                              ? 'bg-sky-500/20 text-sky-200 font-semibold'
                              : 'text-gray-300 hover:bg-gray-800/70 hover:text-white'
                          }`}
                        >
                          {/* Circular Letter Badge */}
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border flex-shrink-0 ${getBadgeColor(idx)}`}>
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

              {/* When Collapsed: Display mini circular badges for first few classes */}
              {!isExpanded && classrooms.length > 0 && (
                <div className="space-y-1.5 mt-1.5 flex flex-col items-center">
                  {classrooms.slice(0, 4).map((c, idx) => {
                    const firstChar = c.name ? c.name.charAt(0).toUpperCase() : 'C';
                    const isCurrentClass = location.pathname === `/classroom/${c.id}`;
                    return (
                      <Link
                        key={c.id}
                        to={`/classroom/${c.id}`}
                        title={c.name}
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border transition hover:scale-110 ${getBadgeColor(idx)} ${
                          isCurrentClass ? 'ring-2 ring-sky-400' : ''
                        }`}
                      >
                        {firstChar}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="py-1.5 px-2">
              <div className="border-t border-gray-800/80" />
            </div>

            {/* 5. Document & PDF Reader */}
            <Link
              to="/quick-reader"
              title="Document & PDF Reader"
              className={`flex items-center rounded-r-full text-sm font-medium transition group ${
                isExpanded ? 'px-3.5 py-2.5 space-x-3.5' : 'justify-center p-2.5 rounded-2xl mx-auto w-11 h-11'
              } ${
                isActive('/quick-reader')
                  ? 'bg-sky-500/20 text-sky-300 font-semibold'
                  : 'text-gray-400 hover:bg-gray-800/60 hover:text-white'
              }`}
            >
              <div className={`flex items-center justify-center flex-shrink-0 ${
                !isExpanded && isActive('/quick-reader') ? 'w-10 h-7 rounded-full bg-sky-500/25 text-sky-300 flex items-center justify-center' : ''
              }`}>
                <Archive className={`w-5 h-5 ${isActive('/quick-reader') ? 'text-sky-400' : 'text-gray-400 group-hover:text-white'}`} />
              </div>
              {isExpanded && <span className="truncate">Document & PDF Reader</span>}
            </Link>
          </div>
        </div>

        {/* -- BOTTOM SECTION: SETTINGS & LOGOUT -- */}
        <div className="p-2 border-t border-gray-800/80 bg-[#090d16] flex-shrink-0">
          {/* Settings Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            title="Settings & Profile"
            className={`w-full flex items-center rounded-r-full text-sm font-medium text-gray-400 hover:bg-gray-800/70 hover:text-white transition cursor-pointer ${
              isExpanded ? 'px-3.5 py-2 space-x-3.5' : 'justify-center p-2 rounded-2xl mx-auto w-11 h-11'
            }`}
          >
            <Settings className="w-5 h-5 text-gray-400 flex-shrink-0" />
            {isExpanded && <span className="truncate">Settings</span>}
          </button>

          {/* User Profile & Logout (when expanded) vs Mini Profile Avatar (when collapsed) */}
          {isExpanded ? (
            <div className="mt-2 pt-2 border-t border-gray-800/60 flex items-center justify-between px-2">
              <div 
                onClick={onOpenSettings}
                className="flex items-center space-x-2.5 truncate cursor-pointer hover:opacity-90 transition group"
                title="Open Profile & Settings"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.full_name} className="w-8 h-8 rounded-full object-cover border border-indigo-500/40 group-hover:border-indigo-400 flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow border border-indigo-400/40">
                    {user.full_name ? user.full_name[0].toUpperCase() : 'U'}
                  </div>
                )}
                <div className="truncate min-w-0">
                  <span className="text-xs font-semibold text-white block truncate group-hover:text-indigo-300 transition">{user.full_name}</span>
                  <span className="text-[9px] text-gray-400 block truncate font-mono">{user.email}</span>
                </div>
              </div>

              <button
                onClick={logout}
                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition flex-shrink-0 cursor-pointer"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* Mini User Profile Avatar when collapsed (Click opens Settings/Profile) */
            <button
              type="button"
              onClick={onOpenSettings}
              title={`${user.full_name} (${user.email}) - Settings`}
              className="w-11 h-11 rounded-2xl mx-auto flex items-center justify-center hover:bg-gray-800/70 transition cursor-pointer mt-1 group"
            >
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name}
                  className="w-8 h-8 rounded-full object-cover border-2 border-indigo-500/50 group-hover:border-indigo-400 shadow-sm transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-sm border border-indigo-400/40 group-hover:scale-105 transition">
                  {user.full_name ? user.full_name[0].toUpperCase() : 'U'}
                </div>
              )}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
