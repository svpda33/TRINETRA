/**
 * Trinetra API and WebSocket Configuration
 * 
 * Production Vercel Backend: https://trinetrabackend-j66kcj8b2-svpda33s-projects.vercel.app
 * Local Development: Relative paths (proxied by Vite) & localhost WebSocket.
 */

const PROD_BACKEND_URL = 'https://trinetrabackend-j66kcj8b2-svpda33s-projects.vercel.app';
const PROD_WS_URL = 'wss://trinetrabackend-j66kcj8b2-svpda33s-projects.vercel.app/api/ws/telemetry';

const isProduction =
  import.meta.env.PROD ||
  (typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1');

export const API_BASE_URL = isProduction
  ? (import.meta.env.VITE_API_URL || PROD_BACKEND_URL)
  : '';

export const getApiUrl = (path) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
};

export const getWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  if (isProduction) {
    return PROD_WS_URL;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const hostname = window.location.hostname || 'localhost';
  return `${protocol}//${hostname}:8000/api/ws/telemetry`;
};
