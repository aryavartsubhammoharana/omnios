import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Background3D from './components/Background3D';

import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import ClassroomDetail from './pages/ClassroomDetail';
import NotebookLMStudio from './pages/NotebookLMStudio';
import QuickPDFReader from './pages/QuickPDFReader';
import QuizAttempt from './pages/QuizAttempt';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative selection:bg-indigo-500 selection:text-white">
          <Background3D />
          <Navbar />
          <main className="relative z-10">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/classroom/:id"
                element={
                  <ProtectedRoute>
                    <ClassroomDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notebooklm"
                element={
                  <ProtectedRoute>
                    <NotebookLMStudio />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/quick-reader"
                element={
                  <ProtectedRoute>
                    <QuickPDFReader />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/quiz/:id"
                element={
                  <ProtectedRoute>
                    <QuizAttempt />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}
