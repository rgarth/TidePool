import { useState, useRef, useEffect, useCallback } from 'react';
import { apiFetch } from '../config';
import type { SearchResult } from '../types';

interface UseSearchReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: SearchResult[];
  isSearching: boolean;
  clearSearch: () => void;
}

const SEARCH_TIMEOUT_MS = 10000; // 10 second timeout

export function useSearch(sessionId: string | undefined): UseSearchReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounced search
  useEffect(() => {
    console.log('>>> useSearch effect triggered:', { searchQuery, sessionId, queryLength: searchQuery.trim().length });
    
    // Clear any pending search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Not enough characters - clear results and ensure not searching
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    console.log('>>> useSearch: starting search, setting isSearching=true');
    // Start searching after debounce
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      // Create abort controller for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      
      // Set up timeout to abort if too slow
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, SEARCH_TIMEOUT_MS);
      
      console.log('>>> Search request:', { query: searchQuery, sessionId });
      
      try {
        const response = await apiFetch(
          `/api/tidal/search?query=${encodeURIComponent(searchQuery)}&sessionId=${sessionId}`,
          { signal: abortController.signal }
        );
        
        clearTimeout(timeoutId);
        
        // Check if this request was aborted (user typed something new)
        if (abortController.signal.aborted) {
          return;
        }
        
        const data = await response.json();
        console.log('>>> Search response:', { status: response.status, ok: response.ok, trackCount: data.tracks?.length, error: data.error });
        
        if (!response.ok) {
          console.error('>>> Search failed:', response.status, data.error);
          setSearchResults([]);
          return;
        }
        setSearchResults(data.tracks || []);
      } catch (err: any) {
        // Don't log abort errors (expected when user types fast)
        if (err.name !== 'AbortError') {
          console.error('Search failed:', err);
        }
        setSearchResults([]);
      } finally {
        // Only clear isSearching if this controller wasn't replaced
        if (abortControllerRef.current === abortController) {
          setIsSearching(false);
        }
      }
    }, 300);
    
    // Cleanup on unmount or query change
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [searchQuery, sessionId]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    clearSearch,
  };
}
