import React, { createContext, useState, useEffect } from 'react';
import API from '../api/client';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = async () => {
    const token = localStorage.getItem('noteai_token');
    if (token) {
      try {
        const res = await API.get('/api/auth/me');
        setUser(res.data);
      } catch (err) {
        localStorage.removeItem('noteai_token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (email, password) => {
    const res = await API.post('/api/auth/login', { email, password });
    localStorage.setItem('noteai_token', res.data.access_token);
    setUser(res.data.user);
    return res.data.user;
  };

  const signup = async (email, password, full_name, role, student_class) => {
    const res = await API.post('/api/auth/signup', { email, password, full_name, role, student_class });
    return res.data;
  };

  const verifyOtp = async (email, otp) => {
    const res = await API.post('/api/auth/verify-otp', { email, otp });
    localStorage.setItem('noteai_token', res.data.access_token);
    setUser(res.data.user);
    return res.data.user;
  };

  const resendOtp = async (email) => {
    const res = await API.post('/api/auth/resend-otp', { email });
    return res.data;
  };

  const googleLogin = async ({ credential, access_token, role = 'student', student_class = null }) => {
    const res = await API.post('/api/auth/google', { credential, access_token, role, student_class });
    localStorage.setItem('noteai_token', res.data.access_token);
    setUser(res.data.user);
    return res.data.user;
  };

  const confirmRole = async ({ role, student_class = null }) => {
    const res = await API.put('/api/auth/confirm-role', { role, student_class });
    setUser(res.data);
    return res.data;
  };

  const updateProfile = async (profileData) => {
    const res = await API.put('/api/auth/profile', profileData);
    setUser(res.data);
    return res.data;
  };

  const changePassword = async (old_password, new_password) => {
    const res = await API.put('/api/auth/change-password', { old_password, new_password });
    return res.data;
  };

  const uploadAvatar = async (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('file', file);
    const res = await API.post('/api/auth/upload-avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    setUser(res.data);
    return res.data;
  };

  const deleteAccount = async () => {
    await API.delete('/api/auth/delete-account');
    localStorage.removeItem('noteai_token');
    setUser(null);
  };

  const logout = () => {
    localStorage.removeItem('noteai_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, loading, login, signup, verifyOtp, resendOtp, 
      googleLogin, confirmRole, updateProfile, changePassword, uploadAvatar, deleteAccount, logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
