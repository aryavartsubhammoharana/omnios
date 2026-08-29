import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import API from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { Plus, LogIn, BookOpen, Users, Sparkles, FileText, ArrowRight } from 'lucide-react';

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const [classrooms, setClassrooms] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [className, setClassName] = useState('');
  const [classDesc, setClassDesc] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');

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

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header Banner */}
      <div className="flex items-center justify-between bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 p-6 rounded-2xl border border-indigo-900/40 shadow-xl mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>Welcome back, {user?.full_name}</span>
            <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-full capitalize">
              {user?.role}
            </span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Google Classroom Management & DLM Notebook
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {user?.role === 'teacher' ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition shadow-lg shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Create Classroom</span>
            </button>
          ) : (
            <button
              onClick={() => setShowJoinModal(true)}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition shadow-lg shadow-indigo-600/20"
            >
              <LogIn className="w-4 h-4" />
              <span>Join Class by Code</span>
            </button>
          )}

          <Link
            to="/notebooklm"
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-800/60 text-sm font-semibold px-4 py-2 rounded-xl transition"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>Open DLM Notebook</span>
          </Link>
        </div>
      </div>

      {/* Classrooms Grid */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center space-x-2">
          <BookOpen className="w-5 h-5 text-indigo-400" />
          <span>Your Enrolled Classrooms</span>
        </h2>

        {classrooms.length === 0 ? (
          <div className="bg-slate-800/40 border border-dashed border-slate-700 rounded-2xl p-12 text-center">
            <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-slate-300 font-semibold">No Classrooms Available</h3>
            <p className="text-slate-500 text-sm mt-1 mb-4">
              {user?.role === 'teacher'
                ? 'Create your first classroom to share study notes and quizzes.'
                : 'Join a classroom using the 5-character code provided by your teacher.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classrooms.map((c) => (
              <div
                key={c.id}
                className="bg-slate-800/60 border border-slate-700 hover:border-indigo-500/50 rounded-2xl p-5 flex flex-col justify-between transition group shadow-lg"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs bg-slate-900 text-indigo-400 font-mono px-2.5 py-1 rounded-md border border-slate-700">
                      Code: {c.code}
                    </span>
                    <span className="text-xs text-slate-400">{c.teacher_name}</span>
                  </div>

                  <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition">
                    {c.name}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2 mt-1 mb-4">
                    {c.description || 'Classroom for lecture notes, AI study tools & practice quizzes.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-700/60 flex items-center justify-between">
                  <Link
                    to={`/classroom/${c.id}`}
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
                  >
                    <span>View Classroom Feed</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <Link
                    to={`/notebooklm?classroom_id=${c.id}`}
                    className="text-xs text-slate-400 hover:text-white flex items-center space-x-1 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700"
                  >
                    <Sparkles className="w-3 h-3 text-indigo-400" />
                    <span>DLM Notebook</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Classroom Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Create New Classroom</h3>
            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
            <form onSubmit={handleCreateClass} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Classroom Name</label>
                <input
                  type="text"
                  required
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="e.g. Physics 101 - Quantum Mechanics"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Description (Optional)</label>
                <textarea
                  rows="3"
                  value={classDesc}
                  onChange={(e) => setClassDesc(e.target.value)}
                  placeholder="Brief description of subject and modules..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Classroom Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Join Classroom by Code</h3>
            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
            <form onSubmit={handleJoinClass} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Enter 6-character Class Code</label>
                <input
                  type="text"
                  required
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. AI101X"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono tracking-widest text-indigo-300 uppercase focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
                >
                  Join Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
