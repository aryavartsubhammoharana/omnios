import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { BookOpen, KeyRound, Mail } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please check credentials.');
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md bg-slate-800/80 border border-slate-700 p-8 rounded-2xl shadow-xl">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-indigo-950 border border-indigo-700/50 rounded-2xl mb-3">
            <BookOpen className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome back to NoteAI</h1>
          <p className="text-sm text-slate-400 mt-1">Classroom & DLM Notebook</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-lg text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@noteai.com or student@noteai.com"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <KeyRound className="w-5 h-5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg transition duration-200 shadow-lg shadow-indigo-600/20"
          >
            Sign In
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-700/60 text-center">
          <p className="text-xs text-slate-400">
            Demo Credentials:
            <br />
            Teacher: <code className="text-indigo-300">teacher@noteai.com</code> / <code className="text-indigo-300">password123</code>
            <br />
            Student: <code className="text-indigo-300">student@noteai.com</code> / <code className="text-indigo-300">password123</code>
          </p>
          <p className="text-xs text-slate-400 mt-4">
            Don't have an account?{' '}
            <Link to="/signup" className="text-indigo-400 hover:underline font-semibold">
              Sign up here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
