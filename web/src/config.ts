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

// Host token management (for cross-origin auth when cookies are blocked)
const HOST_TOKEN_KEY = 'tidepool_host_token';

export function getHostToken(): string | null {
  return localStorage.getItem(HOST_TOKEN_KEY);
}

export function setHostToken(token: string): void {
  localStorage.setItem(HOST_TOKEN_KEY, token);
}

export function clearHostToken(): void {
  localStorage.removeItem(HOST_TOKEN_KEY);
}

// API fetch helper that includes the host token header
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const hostToken = getHostToken();
  
  const headers: HeadersInit = {
    ...options.headers as Record<string, string>,
  };
  
  // Add host token header if available
  if (hostToken) {
    (headers as Record<string, string>)['X-Host-Token'] = hostToken;
  }
  
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include', // Still send cookies as fallback
  });
}


