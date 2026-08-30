import React, { useContext, useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import API from '../api/client';
import { 
  BookOpen, LogOut, Sparkles, Flame, User, Bot, 
  GraduationCap, Settings, Mail, X, Check, Loader2,
  Camera, Lock, KeyRound, Trash2, AlertTriangle, ArrowRight, ShieldAlert, Award, ShieldCheck, Menu
} from 'lucide-react';

export default function Navbar() {
  const { user, logout, confirmRole, updateProfile, changePassword, uploadAvatar, deleteAccount } = useContext(AuthContext);
  const navigate = useNavigate();
  const [streak, setStreak] = useState(1);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Mandatory Role Selection Modal State (Google Login First-Time Onboarding)
  const [mandatoryRole, setMandatoryRole] = useState('student');
  const [mandatoryClass, setMandatoryClass] = useState('Class 11 Science');
  const [savingRole, setSavingRole] = useState(false);
  const [roleError, setRoleError] = useState('');

  // Profile Settings Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editClass, setEditClass] = useState('Class 11 Science');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const fileInputRef = useRef(null);

  // Change Password State (Local Users Only)
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Delete Account State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

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

  const handleConfirmRoleSubmit = async (e) => {
    e.preventDefault();
    setSavingRole(true);
    setRoleError('');
    try {
      await confirmRole({
        role: mandatoryRole,
        student_class: mandatoryRole === 'student' ? mandatoryClass : null
      });
    } catch (err) {
      setRoleError(err.response?.data?.detail || 'Failed to confirm role.');
    } finally {
      setSavingRole(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setProfileError('');
    try {
      await uploadAvatar(file);
      setProfileSuccess('Profile picture updated successfully!');
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (err) {
      setProfileError('Failed to upload image. Please choose a valid PNG/JPEG file.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError('');
    try {
      await updateProfile({
        full_name: editName,
        student_class: editClass
      });
      setProfileSuccess('Profile details saved!');
      setTimeout(() => {
        setProfileSuccess('');
      }, 2000);
    } catch (err) {
      setProfileError('Failed to save profile changes.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setProfileError('');
    if (newPassword !== confirmNewPassword) {
      setProfileError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setProfileError('Password must be at least 6 characters long.');
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(oldPassword || null, newPassword);
      setProfileSuccess('Password changed successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (err) {
      setProfileError(err.response?.data?.detail || 'Failed to change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccountConfirm = async () => {
    setDeletingAccount(true);
    try {
      await deleteAccount();
      setShowProfileModal(false);
      setShowDeleteConfirm(false);
      navigate('/login');
    } catch (err) {
      setProfileError(err.response?.data?.detail || 'Failed to delete account.');
      setShowDeleteConfirm(false);
    } finally {
      setDeletingAccount(false);
    }
  };

  const isRolePending = user && user.is_role_confirmed === false;

  return (
    <>
      <nav className="h-[61px] bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/80 px-3 sm:px-6 flex items-center justify-between sticky top-0 z-40">
        {/* Brand Logo (Left) */}
        <div className="flex items-center space-x-3 sm:space-x-6 flex-shrink-0">
          <Link to="/dashboard" className="flex items-center space-x-2.5 group">
            <img 
              src="/logo.png" 
              alt="OmniOS Logo" 
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-cover shadow-lg shadow-indigo-600/30 border border-indigo-500/30 group-hover:scale-105 transition flex-shrink-0" 
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base sm:text-lg font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-400 tracking-tight whitespace-nowrap">
                  OmniOS
                </span>
                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  PRO
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-gray-400 font-medium tracking-tight whitespace-nowrap hidden xs:block">
                OmniAI + Classroom
              </p>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation Tabs (Center) */}
        {user && !isRolePending && (
          <div className="hidden lg:flex items-center bg-gray-900/90 border border-gray-800/80 rounded-xl p-1 gap-1 shadow-inner flex-shrink-0">
            <Link
              to="/dashboard"
              className="text-xs px-3 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800/60 font-medium transition flex items-center gap-1.5 whitespace-nowrap"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span>Classrooms</span>
            </Link>
            <Link
              to="/notebooklm"
              className="text-xs px-3 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800/60 font-medium transition flex items-center gap-1.5 whitespace-nowrap"
            >
              <Bot className="w-3.5 h-3.5 text-purple-400" />
              <span>OmniAI Studio</span>
            </Link>
            {user.role === 'student' && (
              <Link
                to="/student/daily-hub"
                className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-medium transition flex items-center gap-1.5 hover:bg-indigo-600/30 whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>🎯 Daily AI Practice & Videos</span>
              </Link>
            )}
          </div>
        )}

        {/* User Controls & Streak & Mobile Menu (Right) */}
        <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
          {user ? (
            <div className="flex items-center space-x-2 sm:space-x-2.5">
              {/* Gamified Streak Counter */}
              {!isRolePending && (
                <div 
                  title={`${streak} consecutive active study days`}
                  className="flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold shadow-inner whitespace-nowrap flex-shrink-0"
                >
                  <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-pulse" />
                  <span className="hidden sm:inline">{streak} {streak === 1 ? 'Day' : 'Days'} Streak</span>
                  <span className="sm:hidden">{streak}d</span>
                </div>
              )}

              {/* Profile Pill & Settings Trigger */}
              <button
                onClick={() => !isRolePending && setShowProfileModal(true)}
                disabled={isRolePending}
                className="flex items-center space-x-1.5 sm:space-x-2 bg-gray-900/90 hover:bg-gray-800 border border-gray-800 px-2 sm:px-3 py-1.5 rounded-xl text-xs transition group cursor-pointer shadow-inner disabled:opacity-50 flex-shrink-0"
                title="Edit Student Profile & Class"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.full_name} className="w-5 h-5 rounded-full object-cover border border-indigo-500/50 flex-shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                    {user.full_name ? user.full_name[0].toUpperCase() : 'U'}
                  </div>
                )}
                <span className="font-medium text-gray-200 group-hover:text-white max-w-[70px] sm:max-w-[110px] truncate whitespace-nowrap hidden xs:inline">
                  {user.full_name}
                </span>
                {user.student_class && (
                  <span className="text-[9px] bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.5 rounded font-mono hidden md:inline whitespace-nowrap">
                    {user.student_class}
                  </span>
                )}
                <span className="text-[9px] sm:text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-bold uppercase whitespace-nowrap">
                  {user.role}
                </span>
                <Settings className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-300 hidden sm:block" />
              </button>

              {/* Logout Button (Desktop / Tablet) */}
              <button
                onClick={handleLogout}
                className="hidden sm:flex p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-xl transition text-xs items-center gap-1 flex-shrink-0"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>

              {/* Mobile / Tablet Hamburger Menu Button */}
              {!isRolePending && (
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="lg:hidden p-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 hover:text-white hover:bg-gray-800 transition flex-shrink-0"
                  aria-label="Toggle navigation menu"
                >
                  {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-2 sm:space-x-2.5">
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

      {/* MOBILE / TABLET SLIDE-DOWN NAVIGATION MENU */}
      {mobileMenuOpen && user && !isRolePending && (
        <div className="lg:hidden bg-gray-950/95 backdrop-blur-xl border-b border-gray-800/80 px-4 py-3 space-y-2 sticky top-[61px] z-40 shadow-2xl animate-in slide-in-from-top-2 duration-200">
          <Link
            to="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center space-x-3 px-3.5 py-2.5 rounded-xl bg-gray-900/60 hover:bg-indigo-950 text-gray-200 hover:text-white border border-gray-800/80 transition text-xs font-medium"
          >
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span>Classrooms Hub</span>
          </Link>

          <Link
            to="/notebooklm"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center space-x-3 px-3.5 py-2.5 rounded-xl bg-gray-900/60 hover:bg-purple-950 text-gray-200 hover:text-white border border-gray-800/80 transition text-xs font-medium"
          >
            <Bot className="w-4 h-4 text-purple-400" />
            <span>OmniAI Studio</span>
          </Link>

          {user.role === 'student' && (
            <Link
              to="/student/daily-hub"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center space-x-3 px-3.5 py-2.5 rounded-xl bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 hover:text-white border border-indigo-800/60 transition text-xs font-medium"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>🎯 Daily AI Practice & Videos</span>
            </Link>
          )}

          <div className="pt-2 border-t border-gray-800 flex items-center justify-between gap-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setShowProfileModal(true);
              }}
              className="flex-1 flex items-center justify-center space-x-2 py-2 px-3 bg-gray-900 hover:bg-gray-800 rounded-xl text-xs text-gray-300 font-medium border border-gray-800 transition"
            >
              <Settings className="w-3.5 h-3.5 text-indigo-400" />
              <span>Profile Settings</span>
            </button>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="flex items-center justify-center space-x-1.5 py-2 px-3 bg-red-950/60 hover:bg-red-900 rounded-xl text-xs text-red-300 font-medium border border-red-800 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* Mandatory Non-Dismissible Role Selection Onboarding Modal (Google First Login) */}
      {isRolePending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="w-full max-w-lg glass-card p-6 sm:p-8 rounded-3xl border border-indigo-900/60 shadow-2xl space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-indigo-950 border border-indigo-700/60 rounded-2xl shadow-inner">
                <GraduationCap className="w-8 h-8 text-indigo-400" />
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Welcome to OmniOS, {user.full_name}!
              </h2>
              <p className="text-xs text-gray-300 max-w-md mx-auto leading-relaxed">
                Please select your permanent role to continue. Once selected and confirmed, your role <strong className="text-indigo-300">cannot be changed</strong>.
              </p>
            </div>

            {roleError && (
              <div className="p-3 bg-red-950/80 border border-red-800 text-red-300 text-xs rounded-xl text-center">
                {roleError}
              </div>
            )}

            <form onSubmit={handleConfirmRoleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Option 1: Student */}
                <div
                  onClick={() => setMandatoryRole('student')}
                  className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col items-center text-center space-y-2 ${
                    mandatoryRole === 'student'
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-600/20 ring-1 ring-indigo-500'
                      : 'bg-gray-900/80 border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                  }`}
                >
                  <div className="p-2.5 bg-indigo-950 rounded-xl text-indigo-400 border border-indigo-800">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-xs">I am a Student</span>
                  <p className="text-[10px] text-gray-400">Daily practice, video lectures & notes</p>
                </div>

                {/* Option 2: Teacher */}
                <div
                  onClick={() => setMandatoryRole('teacher')}
                  className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col items-center text-center space-y-2 ${
                    mandatoryRole === 'teacher'
                      ? 'bg-purple-600/20 border-purple-500 text-white shadow-lg shadow-purple-600/20 ring-1 ring-purple-500'
                      : 'bg-gray-900/80 border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                  }`}
                >
                  <div className="p-2.5 bg-purple-950 rounded-xl text-purple-400 border border-purple-800">
                    <Award className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-xs">I am a Teacher</span>
                  <p className="text-[10px] text-gray-400">Create classes, upload notes & manage quizzes</p>
                </div>
              </div>

              {mandatoryRole === 'student' && (
                <div className="bg-gray-900/60 p-4 rounded-2xl border border-gray-800 space-y-2">
                  <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Select Your Class / Grade</span>
                  </label>
                  <select
                    value={mandatoryClass}
                    onChange={(e) => setMandatoryClass(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 shadow-inner transition cursor-pointer"
                  >
                    <option value="Class 11 Science">Class 11 Science</option>
                    <option value="Class 12 Science">Class 12 Science</option>
                    <option value="Class 10 Board">Class 10 Board</option>
                    <option value="Class 9 Foundation">Class 9 Foundation</option>
                    <option value="JEE / NEET Advanced">JEE / NEET Advanced</option>
                    <option value="College / Engineering">College / Engineering</option>
                    <option value="General Science">General Science</option>
                  </select>
                  <p className="text-[10px] text-gray-500">
                    You can change your class later, but your student role will remain permanent.
                  </p>
                </div>
              )}

              <div className="bg-amber-950/40 border border-amber-900/60 p-3 rounded-xl flex items-start space-x-2 text-[11px] text-amber-300">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Important Security Notice:</strong> Once saved, you cannot switch between Student and Teacher. To change your role, you must delete your account.
                </span>
              </div>

              <button
                type="submit"
                disabled={savingRole}
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 transition disabled:opacity-50"
              >
                {savingRole ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                <span>{savingRole ? 'Saving Role & Initializing Studio...' : 'Confirm Role & Enter OmniOS'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Landscape Wide Student Profile Modal (Contained inside viewport) */}
      {showProfileModal && user && !isRolePending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-hidden">
          <div className="w-full max-w-4xl glass-card rounded-3xl border border-gray-800 shadow-2xl relative animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-800/80 flex items-center justify-between flex-shrink-0 bg-gray-950/60">
              <div className="flex items-center space-x-3.5">
                <div className="relative group">
                  {user.avatar_url ? (
                    <img 
                      src={user.avatar_url} 
                      alt={user.full_name} 
                      className="w-12 h-12 rounded-2xl object-cover border-2 border-indigo-500/50 shadow-md" 
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border-2 border-indigo-500/40 text-indigo-400 flex items-center justify-center font-bold text-lg">
                      {user.full_name ? user.full_name[0].toUpperCase() : 'U'}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="absolute -bottom-1 -right-1 p-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow transition"
                    title="Change Profile Photo"
                  >
                    {uploadingPhoto ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarChange}
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden"
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white leading-tight">{user.full_name}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      <span>{user.role}</span>
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-mono mt-0.5 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{user.email}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowProfileModal(false)}
                className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification Alerts */}
            {profileSuccess && (
              <div className="mx-6 mt-4 p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center space-x-2 flex-shrink-0">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div className="mx-6 mt-4 p-2.5 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs flex items-center space-x-2 flex-shrink-0">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            {/* Modal Body - Landscape 2 Columns with Smooth Scrolling */}
            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left Column: Profile Details */}
              <div className="md:col-span-7 space-y-4">
                <div className="flex items-center space-x-2 pb-1 border-b border-gray-800">
                  <User className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Account Details</h4>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1 font-mono">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition shadow-inner"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1 font-mono">
                      Email Address (Permanent)
                    </label>
                    <input
                      type="email"
                      value={user.email}
                      disabled
                      className="w-full bg-gray-900/50 border border-gray-800 rounded-xl px-3.5 py-2 text-xs text-gray-400 cursor-not-allowed shadow-inner"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1 font-mono">
                      Role (Permanently Locked 🔒)
                    </label>
                    <input
                      type="text"
                      value={user.role === 'student' ? 'Student' : 'Teacher'}
                      disabled
                      className="w-full bg-gray-900/50 border border-gray-800 rounded-xl px-3.5 py-2 text-xs text-gray-400 cursor-not-allowed shadow-inner font-bold uppercase"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      Role is locked for security. To switch roles, you must delete your account.
                    </p>
                  </div>

                  {user.role === 'student' && (
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1 font-mono flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Student Class / Grade (Dropdown)</span>
                      </label>
                      <select
                        value={editClass}
                        onChange={(e) => setEditClass(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition shadow-inner cursor-pointer"
                      >
                        <option value="Class 11 Science">Class 11 Science</option>
                        <option value="Class 12 Science">Class 12 Science</option>
                        <option value="Class 10 Board">Class 10 Board</option>
                        <option value="Class 9 Foundation">Class 9 Foundation</option>
                        <option value="JEE / NEET Advanced">JEE / NEET Advanced</option>
                        <option value="College / Engineering">College / Engineering</option>
                        <option value="General Science">General Science</option>
                      </select>
                    </div>
                  )}

                  <div className="pt-1 flex justify-start">
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition flex items-center space-x-1.5 disabled:opacity-50"
                    >
                      {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>{savingProfile ? 'Saving...' : 'Save Profile Changes'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Right Column: Authentication & Security / Danger Zone */}
              <div className="md:col-span-5 space-y-4">
                {user.auth_provider === 'google' ? (
                  /* Google OAuth Security Card (No Password Needed) */
                  <div className="bg-gradient-to-br from-indigo-950/40 to-gray-900/60 p-4 rounded-2xl border border-indigo-800/40 space-y-3 shadow-inner">
                    <div className="flex items-center space-x-2 pb-1 border-b border-gray-800">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Google Security</h4>
                    </div>

                    <div className="flex items-center space-x-3 bg-gray-900/80 p-3 rounded-xl border border-gray-800">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-bold text-gray-900 shadow">
                        G
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">Google Verified Sign-In</span>
                        <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                          <Check className="w-3 h-3" /> Passwordless OAuth 2.0
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-gray-300 leading-relaxed">
                      Your account is protected by <strong>Google Identity Services</strong>. You do not need or manage a server password. Sign in anytime directly with your Google account.
                    </p>
                  </div>
                ) : (
                  /* Change Password Card (Only for Local Email Accounts) */
                  <div className="bg-gray-900/60 p-4 rounded-2xl border border-gray-800 space-y-3">
                    <div className="flex items-center space-x-2 pb-1 border-b border-gray-800/80">
                      <KeyRound className="w-3.5 h-3.5 text-purple-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Change Password</h4>
                    </div>

                    <form onSubmit={handleChangePasswordSubmit} className="space-y-2.5">
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase font-mono mb-1">
                          Current Password
                        </label>
                        <input
                          type="password"
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 shadow-inner"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase font-mono mb-1">
                          New Password
                        </label>
                        <input
                          type="password"
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="At least 6 characters"
                          className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 shadow-inner"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase font-mono mb-1">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          required
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 shadow-inner"
                        />
                      </div>

                      <div className="pt-1 flex justify-end">
                        <button
                          type="submit"
                          disabled={savingPassword}
                          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center space-x-1.5"
                        >
                          {savingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                          <span>{savingPassword ? 'Updating...' : 'Update Password'}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Danger Zone: Delete Account */}
                <div className="bg-red-950/30 border border-red-900/50 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-red-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      <span>Danger Zone</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-3 py-1.5 bg-red-950/80 hover:bg-red-900 border border-red-800/80 text-red-300 text-xs font-semibold rounded-xl transition flex items-center space-x-1"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                      <span>Delete Account</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-tight">
                    Permanently purge your account, unenroll from classrooms, and delete all streaks.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-md glass-card p-6 rounded-3xl border border-red-900/80 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center space-x-3 text-red-400">
              <div className="p-2.5 bg-red-950 rounded-2xl border border-red-800">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Permanently Delete Account?</h3>
                <span className="text-xs text-red-300">This action cannot be undone.</span>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Deleting your account will permanently remove you from all enrolled classrooms, delete all your daily diagnostic quizzes, study streaks, and uploaded notes.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                disabled={deletingAccount}
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingAccount}
                onClick={handleDeleteAccountConfirm}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/30 transition flex items-center space-x-1.5 disabled:opacity-50"
              >
                {deletingAccount ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{deletingAccount ? 'Deleting...' : 'Yes, Delete My Account'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
