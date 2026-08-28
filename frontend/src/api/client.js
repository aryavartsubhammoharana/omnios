import axios from 'axios';

const API = axios.create({
  baseURL: '', // Relative URL proxied by Vite to http://127.0.0.1:8000
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('noteai_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

export default API;
