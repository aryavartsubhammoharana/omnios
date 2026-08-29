import React, { useContext, useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import API from '../api/client';
import { 
  BookOpen, LogOut, Sparkles, Flame, User, Bot, 
  GraduationCap, Settings, Mail, X, Check, Loader2,
  Camera, Lock, ShieldCheck, KeyRound, ChevronDown, ChevronUp,
  Trash2, AlertTriangle
} from 'lucide-react';

export default function Navbar() {
  const { user, logout, updateProfile, changePassword, uploadAvatar, deleteAccount } = useContext(AuthContext);
  const navigate = useNavigate();
  const [streak, setStreak] = useState(1);
  
  // Profile Settings Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editClass, setEditClass] = useState('Class 11 Science');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const fileInputRef = useRef(null);

  // Change Password State
  const [showPasswordSection, setShowPasswordSection] = useState(false);
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
      setShowPasswordSection(false);
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

  return (
    <>
      <nav className="h-[61px] bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
        {/* Brand Logo (Left) */}
        <div className="flex items-center space-x-6">
          <Link to="/dashboard" className="flex items-center space-x-2.5 group">
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

              {/* Profile Pill & Settings Trigger */}
              <button
                onClick={() => setShowProfileModal(true)}
                className="flex items-center space-x-2 bg-gray-900/90 hover:bg-gray-800 border border-gray-800 px-3 py-1.5 rounded-xl text-xs transition group cursor-pointer shadow-inner"
                title="Edit Student Profile & Class"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.full_name} className="w-5 h-5 rounded-full object-cover border border-indigo-500/50" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold text-[10px]">
                    {user.full_name ? user.full_name[0].toUpperCase() : 'U'}
                  </div>
                )}
                <span className="font-medium text-gray-200 group-hover:text-white max-w-[100px] truncate">{user.full_name}</span>
                {user.student_class && (
                  <span className="text-[9px] bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.5 rounded font-mono hidden sm:inline">
                    {user.student_class}
                  </span>
                )}
                <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-bold uppercase">
                  {user.role}
                </span>
                <Settings className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-300" />
              </button>

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

      {/* Comprehensive Student Profile Modal */}
      {showProfileModal && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-lg glass-card p-6 sm:p-8 rounded-3xl border border-gray-800 shadow-2xl relative animate-in fade-in zoom-in duration-200 my-8">
            <button
              onClick={() => setShowProfileModal(false)}
              className="absolute top-5 right-5 p-1.5 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Profile Header & Photo Upload */}
            <div className="flex items-center space-x-4 mb-6 border-b border-gray-800 pb-5">
              <div className="relative group">
                {user.avatar_url ? (
                  <img 
                    src={user.avatar_url} 
                    alt={user.full_name} 
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-500/50 shadow-md" 
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border-2 border-indigo-500/40 text-indigo-400 flex items-center justify-center font-bold text-2xl">
                    {user.full_name ? user.full_name[0].toUpperCase() : 'U'}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute -bottom-1.5 -right-1.5 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg transition"
                  title="Upload New Profile Photo"
                >
                  {uploadingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
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
                  <h3 className="text-lg font-bold text-white">{user.full_name}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {user.role}
                  </span>
                </div>
                <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-1 font-mono">
                  <Mail className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{user.email}</span>
                </p>
                <span className="text-[10px] text-gray-500 font-mono mt-0.5 block">
                  Auth Provider: {user.auth_provider === 'google' ? 'Google Account' : 'Server Account'}
                </span>
              </div>
            </div>

            {profileSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs flex items-center space-x-2">
                <X className="w-4 h-4 text-red-400 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            {/* Profile Edit Form */}
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5 font-mono">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition shadow-inner"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5 font-mono">
                  Email Address (Permanent)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    value={user.email}
                    disabled
                    className="w-full bg-gray-900/40 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-400 cursor-not-allowed shadow-inner"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5 font-mono flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Student Class / Grade (Dropdown)</span>
                </label>
                <select
                  value={editClass}
                  onChange={(e) => setEditClass(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition shadow-inner cursor-pointer"
                >
                  <option value="Class 11 Science">Class 11 Science</option>
                  <option value="Class 12 Science">Class 12 Science</option>
                  <option value="Class 10 Board">Class 10 Board</option>
                  <option value="Class 9 Foundation">Class 9 Foundation</option>
                  <option value="JEE / NEET Advanced">JEE / NEET Advanced</option>
                  <option value="College / Engineering">College / Engineering</option>
                  <option value="General Science">General Science</option>
                </select>
                <p className="text-[10px] text-gray-500 mt-1">
                  Your daily diagnostic tests and recommendations adapt directly to this class.
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{savingProfile ? 'Saving Details...' : 'Save Profile Changes'}</span>
                </button>
              </div>
            </form>

            {/* Change Password Collapsible Section */}
            <div className="mt-6 pt-5 border-t border-gray-800">
              <button
                type="button"
                onClick={() => setShowPasswordSection(!showPasswordSection)}
                className="w-full flex items-center justify-between text-xs font-semibold text-gray-300 hover:text-white py-1 transition"
              >
                <div className="flex items-center space-x-2">
                  <KeyRound className="w-4 h-4 text-purple-400" />
                  <span>Change Password</span>
                </div>
                {showPasswordSection ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>

              {showPasswordSection && (
                <form onSubmit={handleChangePasswordSubmit} className="mt-3.5 space-y-3 bg-gray-900/60 p-4 rounded-2xl border border-gray-800">
                  {user.auth_provider === 'local' && (
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase font-mono mb-1">
                        Current Password
                      </label>
                      <input
                        type="password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 shadow-inner"
                      />
                    </div>
                  )}

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
                      className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 shadow-inner"
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
                      className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 shadow-inner"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={savingPassword}
                      className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center space-x-1.5"
                    >
                      {savingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                      <span>{savingPassword ? 'Updating...' : 'Update Password'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Danger Zone: Delete Account */}
            <div className="mt-6 pt-5 border-t border-red-950/80">
              <div className="bg-red-950/30 border border-red-900/50 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-red-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                    <span>Delete Account</span>
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Permanently delete your profile and unenroll from all classrooms.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3.5 py-2 bg-red-950/80 hover:bg-red-900/80 border border-red-800/80 text-red-300 text-xs font-semibold rounded-xl transition flex items-center space-x-1.5 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span>Delete</span>
                </button>
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
