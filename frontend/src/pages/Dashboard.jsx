import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import API from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { Plus, LogIn, BookOpen, Users, Sparkles, FileText, ArrowRight, Copy, Check, School, ShieldCheck, Flame } from 'lucide-react';
import useLiveSync from '../utils/useLiveSync';

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const [classrooms, setClassrooms] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [className, setClassName] = useState('');
  const [classDesc, setClassDesc] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);

  const fetchClassrooms = async () => {
    try {
      const res = await API.get('/api/classroom/list');
      setClassrooms(res.data);
    } catch (err) {
      console.error("Error loading classrooms", err);
    }
  };

  useEffect(() => {
    fetchClassrooms();
  }, []);

  // Silent non-disruptive background sync
  useLiveSync(fetchClassrooms, 8000);

  const handleCreateClass = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await API.post('/api/classroom/create', { name: className, description: classDesc });
      setClassName('');
      setClassDesc('');
      setShowCreateModal(false);
      fetchClassrooms();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create classroom');
    }
  };

  const handleJoinClass = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await API.post('/api/classroom/join', { code: joinCode });
      setJoinCode('');
      setShowJoinModal(false);
      fetchClassrooms();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to join classroom');
    }
  };

  const handleCopyCode = (code, e) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="min-h-[calc(100vh-65px)] bg-[#090d16] text-gray-100 py-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Ambient Glow Orbs */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow"></div>
      <div className="fixed bottom-10 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow"></div>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* TOP DISTRIBUTED HERO BANNER */}
        <div className="glass-card rounded-2xl p-6 border border-gray-800/80 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          {/* Left: User Welcome & Title */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                <span>Welcome back, {user?.full_name}</span>
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {user?.role}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-400 font-medium">
              Manage courses, study notes, and explore OmniAI Studio.
            </p>
          </div>

          {/* Center / Quick Stats Pill */}
          <div className="hidden lg:flex items-center gap-4 bg-gray-900/80 border border-gray-800 rounded-2xl px-5 py-2.5 shadow-inner">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Active Classes</p>
              <p className="text-lg font-extrabold text-indigo-400">{classrooms.length}</p>
            </div>
            <div className="w-px h-8 bg-gray-800"></div>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">AI Knowledge</p>
              <p className="text-lg font-extrabold text-emerald-400">Dual RAG</p>
            </div>
            <div className="w-px h-8 bg-gray-800"></div>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Extractors</p>
              <p className="text-lg font-extrabold text-purple-400">Multi-Format</p>
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-3 shrink-0">
            {user?.role === 'teacher' ? (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition hover:scale-[1.02] active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Create Classroom</span>
              </button>
            ) : (
              <button
                onClick={() => setShowJoinModal(true)}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition hover:scale-[1.02] active:scale-95"
              >
                <LogIn className="w-4 h-4" />
                <span>Join with 5-Char Code</span>
              </button>
            )}

            <Link
              to="/notebooklm"
              className="px-4 py-2.5 rounded-xl bg-gray-800/90 hover:bg-gray-700/90 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-2 transition shadow-md"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>OmniAI</span>
            </Link>
          </div>
        </div>

        {/* SECTION: CLASSROOMS GRID */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-800/80">
            <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <School className="w-5 h-5 text-indigo-400" />
              <span>Your Enrolled Classrooms</span>
              <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full font-mono">
                {classrooms.length}
              </span>
            </h2>
            <span className="text-xs text-gray-400">
              Each classroom features an isolated Vector DB & live stream
            </span>
          </div>

          {classrooms.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center border-dashed border-2 border-gray-800 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <BookOpen className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-gray-200">No Classrooms Found</h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                {user?.role === 'teacher'
                  ? 'Click "Create Classroom" above to create your first class and share the 5-character code with your students.'
                  : 'Click "Join with 5-Char Code" to enter a classroom using the code provided by your teacher.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {classrooms.map((c) => (
                <div
                  key={c.id}
                  className="glass-card rounded-2xl p-5 flex flex-col justify-between border border-gray-800/90 hover:border-indigo-500/50 hover:shadow-xl transition-all duration-200 group relative"
                >
                  {/* Card Header (Corners: Code on left, Teacher/Role on right) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      {/* 5-Char Code Badge with 1-Click Copy */}
                      <button
                        onClick={(e) => handleCopyCode(c.code, e)}
                        title="Click to copy unique classroom code"
                        className="flex items-center gap-1.5 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-800/80 px-2.5 py-1 rounded-lg text-xs font-mono font-bold text-indigo-300 transition"
                      >
                        <span>Code: {c.code}</span>
                        {copiedCode === c.code ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-indigo-400/80" />
                        )}
                      </button>

                      <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-gray-500" />
                        <span>{c.teacher_name || 'Teacher'}</span>
                      </span>
                    </div>

                    {/* Classroom Name & Description */}
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition tracking-tight">
                        {c.name}
                      </h3>
                      <p className="text-xs text-gray-400 line-clamp-2 mt-1 leading-relaxed">
                        {c.description || 'Classroom for lecture materials, study notes, and AI quizzes.'}
                      </p>
                    </div>
                  </div>

                  {/* Card Footer (Corners: View Stream on left, DLM Notebook on right) */}
                  <div className="pt-4 mt-4 border-t border-gray-800/80 flex items-center justify-between gap-2">
                    <Link
                      to={`/classroom/${c.id}`}
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
                    >
                      <span>Open Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                    </Link>

                    <Link
                      to={`/notebooklm?classroom_id=${c.id}`}
                      title="Open OmniAI workspace for this classroom"
                      className="text-xs text-gray-300 hover:text-white flex items-center gap-1.5 bg-gray-900/90 hover:bg-indigo-950/60 px-3 py-1.5 rounded-xl border border-gray-700/80 hover:border-indigo-500/40 transition shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      <span>OmniAI</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CREATE CLASSROOM MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-card rounded-2xl max-w-md w-full p-6 border border-gray-800 shadow-2xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                <span>Create New Classroom</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                A unique 5-character access code will be generated automatically.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateClass} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Classroom Name *</label>
                <input
                  type="text"
                  required
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="e.g. Physics 101 — Mechanics & Oscillations"
                  className="w-full glass-input rounded-xl px-3.5 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Course Description (Optional)</label>
                <textarea
                  rows="3"
                  value={classDesc}
                  onChange={(e) => setClassDesc(e.target.value)}
                  placeholder="Summary of topics, modules, and schedule..."
                  className="w-full glass-input rounded-xl px-3.5 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition"
                >
                  Create Classroom
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JOIN CLASSROOM MODAL */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-card rounded-2xl max-w-md w-full p-6 border border-gray-800 shadow-2xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <LogIn className="w-5 h-5 text-indigo-400" />
                <span>Join Classroom by Code</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Enter the 5-character alphanumeric code provided by your teacher.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleJoinClass} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">5-Character Access Code *</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. K9X2P"
                  className="w-full glass-input rounded-xl px-4 py-2.5 text-center text-sm font-mono tracking-widest text-indigo-300 uppercase"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition"
                >
                  Join Classroom
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
