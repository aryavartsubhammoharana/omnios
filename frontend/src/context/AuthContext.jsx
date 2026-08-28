import React, { createContext, useState, useEffect } from 'react';
import API from '../api/client';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('noteai_token');
    if (token) {
      API.get('/api/auth/me')
        .then((res) => {
          setUser(res.data);
        })
        .catch(() => {
          localStorage.removeItem('noteai_token');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await API.post('/api/auth/login', { email, password });
    localStorage.setItem('noteai_token', res.data.access_token);
    setUser(res.data.user);
    return res.data.user;
  };

  const signup = async (email, password, full_name, role) => {
    const res = await API.post('/api/auth/signup', { email, password, full_name, role });
    localStorage.setItem('noteai_token', res.data.access_token);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('noteai_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
