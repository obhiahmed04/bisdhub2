
import axios from 'axios';

const RAW_BACKEND = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://bisdhub-backend-staging.onrender.com';
const BACKEND_URL = RAW_BACKEND.replace(/\/$/, '');
export const API_BASE = `${BACKEND_URL}/api`;
// Build WS base — always ensure /api/ws path is present
const _rawWsBase = (process.env.REACT_APP_WS_URL || `${BACKEND_URL.replace(/^http/, 'ws')}/api/ws`).replace(/\/$/, '');
export const WS_BASE = _rawWsBase.endsWith('/api/ws') ? _rawWsBase : _rawWsBase + '/api/ws';

export const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const resolveAssetUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//.test(url)) return url;
  return `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const getPublicName = (entity) => entity?.username ? `@${entity.username}` : (entity?.display_name || entity?.full_name || entity?.id_number || 'User');
export const getSecondaryIdentity = (entity) => entity?.username ? `${entity.id_number}` : '';

export default api;
