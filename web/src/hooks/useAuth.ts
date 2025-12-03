import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../config';

/**
 * Hook for managing Tidal authentication state.
 * Checks auth status on mount and provides a refresh function.
 */
export function useAuth(options?: { delayCheck?: number }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await apiFetch('/api/auth/status');
      const data = await response.json();
      setIsAuthenticated(data.authenticated);
    } catch (err) {
      console.error('Auth check failed:', err);
      setIsAuthenticated(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    const delay = options?.delayCheck ?? 0;
    const timer = setTimeout(checkAuthStatus, delay);
    return () => clearTimeout(timer);
  }, [checkAuthStatus, options?.delayCheck]);

  return {
    isAuthenticated,
    isChecking,
    checkAuthStatus,
  };
}


