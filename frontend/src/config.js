/**
 * Trinetra API and WebSocket Configuration
 * 
 * Supports dynamic Railway backend URL, custom environment variables, and local proxy.
 */

// Fallback production URL (Replace with your actual Railway domain after deployment)
const PROD_BACKEND_URL = 'https://trinetra-backend.up.railway.app';

const isProduction =
  import.meta.env.PROD ||
  (typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1');

const envApiUrl =
  import.meta.env.VITE_API_URL ||
  import.meta.env.API_URL ||
  import.meta.env.BACKEND_URL ||
  (typeof process !== 'undefined' && process.env && (process.env.API_URL || process.env.BACKEND_URL)) ||
  '';

export const API_BASE_URL = isProduction
  ? (envApiUrl || PROD_BACKEND_URL)
  : '';

export const getApiUrl = (path) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
};

export const getWsUrl = () => {
  const customWs = import.meta.env.VITE_WS_URL || import.meta.env.WS_URL;
  if (customWs) {
    return customWs;
  }
  if (API_BASE_URL && API_BASE_URL.startsWith('http')) {
    // Automatically convert https://... to wss://... and http://... to ws://...
    const wsBase = API_BASE_URL.replace(/^http/, 'ws').replace(/\/+$/, '');
    return `${wsBase}/api/ws/telemetry`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const hostname = window.location.hostname || 'localhost';
  return `${protocol}//${hostname}:8000/api/ws/telemetry`;
};
