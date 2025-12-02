// API Configuration
// In development, Vite proxy handles /api routes to localhost:3001
// In production, we need the full Render URL

export const API_URL = import.meta.env.VITE_API_URL || '';

// WebSocket URL (same host as API, but ws:// or wss://)
export const WS_URL = (() => {
  if (import.meta.env.VITE_API_URL) {
    // Production: convert https://xxx to wss://xxx
    return import.meta.env.VITE_API_URL.replace(/^http/, 'ws');
  }
  // Development: use current host
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.hostname}:3001`;
})();

// Helper to build API URLs
export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}


