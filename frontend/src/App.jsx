import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import Background3D from './components/Background3D';

import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import ClassroomDetail from './pages/ClassroomDetail';
import OmniAI from './pages/omniai';
import QuickPDFReader from './pages/QuickPDFReader';
import QuizAttempt from './pages/QuizAttempt';
import StudentDailyHub from './pages/StudentDailyHub';
import FocusVideoPlayer from './pages/FocusVideoPlayer';

function AppContent() {
  const location = useLocation();
  const isAuthRoute = location.pathname === '/login' || location.pathname === '/signup';

  return (
    <div className="min-h-screen bg-[#090d16] text-gray-100 font-sans relative selection:bg-indigo-500 selection:text-white">
      {!isAuthRoute && <Background3D />}
      {!isAuthRoute && <Navbar />}
      <main className={`relative z-10 ${!isAuthRoute ? 'md:pl-[68px]' : ''}`}>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/signup"
            element={<Navigate to="/login" replace />}
          />
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
            path="/omniai"
            element={
              <ProtectedRoute>
                <OmniAI />
              </ProtectedRoute>
            }
          />
          <Route
            path="/omniai/:chatId"
            element={
              <ProtectedRoute>
                <OmniAI />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notebooklm"
            element={<Navigate to="/omniai" replace />}
          />
          <Route
            path="/notebooklm/:chatId"
            element={<Navigate to="/omniai" replace />}
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
            path="/read-doc"
            element={
              <ProtectedRoute>
                <QuickPDFReader />
              </ProtectedRoute>
            }
          />
          <Route
            path="/read-pdf"
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
          <Route
            path="/student/daily-hub"
            element={
              <ProtectedRoute>
                <StudentDailyHub />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/focus-video/:videoId"
            element={
              <ProtectedRoute>
                <FocusVideoPlayer />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}
