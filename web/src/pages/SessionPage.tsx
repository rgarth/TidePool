import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { useSocket } from '../hooks/useSocket';
import { apiFetch, setHostToken } from '../config';
import type { SearchResult } from '../types';

export function SessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    isConnected,
    sessionState,
    error,
    joinSession,
    setPlaylist,
    resetForLoad,
  } = useSocket();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'playlist' | 'participants'>('playlist');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Playlist creation state (for host)
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [existingPlaylistId, setExistingPlaylistId] = useState('');
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [existingPlaylistError, setExistingPlaylistError] = useState('');
  
  // Check for last used playlist ID
  const [lastPlaylistId, setLastPlaylistId] = useState<string | null>(null);
  
  useEffect(() => {
    const saved = localStorage.getItem('tidepool_last_playlist');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setLastPlaylistId(data.id);
      } catch {}
    }
  }, []);

  // Share modal state
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Track adding state
  const [addingTrackId, setAddingTrackId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  
  // Check if just returned from auth
  const authSuccess = searchParams.get('auth') === 'success';
  const urlToken = searchParams.get('token');
  
  // Extract and store token from URL (for cross-origin auth when cookies are blocked)
  useEffect(() => {
    if (authSuccess && urlToken) {
      console.log('Storing auth token from URL');
      setHostToken(urlToken);
      // Clean up URL (remove token param)
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('token');
      navigate(`/session/${sessionId}?${newParams.toString()}`, { replace: true });
    }
  }, [authSuccess, urlToken, navigate, sessionId, searchParams]);
  
  // Check authentication status
  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await apiFetch('/api/auth/status');
      const data = await response.json();
      setIsAuthenticated(data.authenticated);
    } catch (err) {
      console.error('Failed to check auth status:', err);
    }
  }, []);
  
  // Check auth on mount and after successful auth
  useEffect(() => {
    // Small delay after storing token to ensure it's saved
    const timer = setTimeout(() => {
      checkAuthStatus();
    }, authSuccess && urlToken ? 100 : 0);
    return () => clearTimeout(timer);
  }, [checkAuthStatus, authSuccess, urlToken]);

  // Show playlist picker for host if no playlist linked yet
  useEffect(() => {
    if (sessionState?.isHost && isAuthenticated && !sessionState.tidalPlaylistId) {
      setShowPlaylistPicker(true);
    }
  }, [sessionState?.isHost, isAuthenticated, sessionState?.tidalPlaylistId]);

  // Simple loading state: are we waiting for playlist data?
  // Set false when starting to load, set true when socket delivers tracks
  const [playlistReady, setPlaylistReady] = useState(!sessionState?.tidalPlaylistId);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Reset to "ready" when initial session loads with a playlist
  useEffect(() => {
    if (sessionState?.tidalPlaylistId && sessionState.tracks.length > 0) {
      setPlaylistReady(true);
    }
  }, [sessionState?.tidalPlaylistId, sessionState?.tracks?.length]);
  
  // Show loading spinner when not ready OR actively fetching
  const isLoadingPlaylist = !playlistReady || isLoadingExisting || isCreatingPlaylist || isRefreshing;
  
  const refreshPlaylistFromTidal = useCallback(async () => {
    if (!sessionState?.tidalPlaylistId) return;
    
    setIsRefreshing(true);
    try {
      // Call the server to fetch from Tidal and broadcast to all clients
      const response = await apiFetch(`/api/tidal/playlists/${sessionState.tidalPlaylistId}/refresh?sessionId=${sessionId}`);
      
      if (!response.ok) {
        throw new Error('Failed to refresh');
      }
      
      // Server will broadcast 'playlist_synced' to all clients
      console.log('Refresh requested');
    } catch (err) {
      console.error('Failed to refresh playlist:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [sessionState?.tidalPlaylistId, sessionId]);

  // Delete track from playlist
  const [deletingTrackId, setDeletingTrackId] = useState<string | null>(null);
  
  const handleDeleteTrack = useCallback(async (trackId: string) => {
    if (!sessionState?.tidalPlaylistId) return;
    
    setDeletingTrackId(trackId);
    try {
      const response = await apiFetch(`/api/tidal/playlists/${sessionState.tidalPlaylistId}/tracks`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          trackIds: [trackId],
          sessionId: sessionId?.toUpperCase(),
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete track');
      }
      
      console.log('Track deleted');
    } catch (err) {
      console.error('Failed to delete track:', err);
    } finally {
      setDeletingTrackId(null);
    }
  }, [sessionState?.tidalPlaylistId, sessionId]);

  // Random playlist name generator
  const ADJECTIVES = [
    'Midnight', 'Summer', 'Chill', 'Epic', 'Groovy', 'Smooth', 'Cosmic', 
    'Electric', 'Golden', 'Sunset', 'Highway', 'Road Trip', 'Late Night',
    'Weekend', 'Sunday', 'Throwback', 'Fresh', 'Good Times', 'Cruising'
  ];
  const NOUNS = [
    'Bangers', 'Jams', 'Beats', 'Vibes', 'Tunes', 'Tracks', 'Hits', 
    'Grooves', 'Sounds', 'Mix', 'Playlist', 'Session', 'Party', 'Drive',
    'Journey', 'Waves', 'Flow', 'Mood', 'Energy', 'Magic'
  ];
  
  const generateRandomName = () => {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    return `${adj} ${noun}`;
  };

  // Create new playlist and link to session
  const handleCreateNewPlaylist = async () => {
    const playlistName = newPlaylistName.trim() || generateRandomName();
    
    setIsCreatingPlaylist(true);
    try {
      const response = await apiFetch('/api/tidal/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: playlistName,
          description: 'Created with TidePool',
        }),
      });
      
      if (!response.ok) throw new Error('Failed to create playlist');
      
      const data = await response.json();
      // New playlist is empty, so it's ready immediately
      setPlaylistReady(true);
      setPlaylist(data.id, data.listenUrl, playlistName);
      setShowPlaylistPicker(false);
      setNewPlaylistName(''); // Clear input
      
      // Save as last used playlist and update state
      localStorage.setItem('tidepool_last_playlist', JSON.stringify({ 
        id: data.id, 
        name: playlistName,
        createdAt: new Date().toISOString(),
      }));
      setLastPlaylistId(data.id);
      
      // Trigger refresh to sync empty playlist to all clients (clears old tracks)
      setTimeout(() => {
        apiFetch(`/api/tidal/playlists/${data.id}/refresh?sessionId=${sessionId}`);
      }, 300);
    } catch (err) {
      console.error('Failed to create playlist:', err);
    } finally {
      setIsCreatingPlaylist(false);
    }
  };

  // Use an existing playlist by ID
  const handleUseExistingPlaylist = async (playlistIdToUse?: string) => {
    const idToUse = (playlistIdToUse || existingPlaylistId).trim();
    
    // Extract playlist ID from URL if pasted
    // Handles: tidal.com/playlist/UUID, listen.tidal.com/playlist/UUID, or just UUID
    let cleanId = idToUse;
    
    // Try to extract UUID from URL
    const urlMatch = idToUse.match(/playlist\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (urlMatch) {
      cleanId = urlMatch[1];
    } else {
      // Check if the input itself is a valid UUID
      const uuidMatch = idToUse.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
      if (uuidMatch) {
        cleanId = uuidMatch[1];
      }
    }
    
    if (!cleanId || cleanId.length !== 36) {
      setExistingPlaylistError('Please enter a valid playlist ID (UUID format) or Tidal URL');
      return;
    }
    
    console.log('Loading playlist:', cleanId);
    
    // Reset all state for fresh load - clears old tracks and shows loading
    resetForLoad();
    setPlaylistReady(false);
    setIsLoadingExisting(true);
    setExistingPlaylistError('');
    setShowPlaylistPicker(false);
    
    try {
      // Step 1: Verify playlist exists and get its info from Tidal API
      const response = await apiFetch(`/api/tidal/playlists/${cleanId}/tracks`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 404) {
          throw new Error('Playlist not found yet. Tidal may still be syncing - try again in a moment.');
        }
        throw new Error(errorData.error || 'Playlist not found or not accessible');
      }
      
      const data = await response.json();
      const playlistName = data.playlistName;
      const isEmpty = !data.tracks || data.tracks.length === 0;
      
      // If playlist is empty, it's ready immediately (nothing to wait for)
      if (isEmpty) {
        setPlaylistReady(true);
      }
      
      // Step 2: Clear input field
      setExistingPlaylistId('');
      
      // Step 3: Link playlist to session via socket
      // This triggers: playlist_linked (clears tracks) → playlist_synced (populates tracks)
      const listenUrl = `https://listen.tidal.com/playlist/${cleanId}`;
      setPlaylist(cleanId, listenUrl, playlistName);
      
      // Save as last used and update state
      localStorage.setItem('tidepool_last_playlist', JSON.stringify({ id: cleanId, name: playlistName }));
      setLastPlaylistId(cleanId);
      
      // Trigger a refresh to sync tracks to all clients
      const playlistIdForRefresh = cleanId; // Capture in closure
      setTimeout(() => {
        apiFetch(`/api/tidal/playlists/${playlistIdForRefresh}/refresh?sessionId=${sessionId}`);
      }, 500);
    } catch (err: any) {
      setExistingPlaylistError(err.message || 'Failed to load playlist');
    } finally {
      setIsLoadingExisting(false);
    }
  };

  // Join session on mount
  useEffect(() => {
    if (isConnected && sessionId) {
      const userName = sessionStorage.getItem('userName') || 'Guest';
      const isHost = sessionStorage.getItem('isHost') === 'true';
      joinSession(sessionId, userName, isHost);
    }
  }, [isConnected, sessionId, joinSession]);

  // Handle connection errors
  useEffect(() => {
    if (error) {
      console.error('Socket error:', error);
      if (error.includes('not found')) {
        navigate('/', { replace: true });
      }
    }
  }, [error, navigate]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await apiFetch(`/api/tidal/search?query=${encodeURIComponent(searchQuery)}&sessionId=${sessionId}`);
        const data = await response.json();
        
        if (data.authRequired) {
          setSearchResults([]);
          return;
        }
        
        setSearchResults(data.tracks || []);
      } catch (err) {
        console.error('Search failed:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [searchQuery]);

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  // Add track to playlist - POST to Tidal, server broadcasts real playlist to everyone
  const handleAddTrack = async (track: SearchResult) => {
    if (!sessionState?.tidalPlaylistId) {
      setAddError('No playlist selected');
      return;
    }
    
    setAddingTrackId(track.id);
    setAddError(null);
    
    try {
      // POST to Tidal - server will fetch real playlist and broadcast to ALL clients
      const response = await apiFetch(`/api/tidal/playlists/${sessionState.tidalPlaylistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          trackIds: [track.tidalId],
          sessionId: sessionId, // So server knows which room to broadcast to
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to add track (${response.status})`);
      }
      
      // Success! Server will broadcast 'playlist_synced' to ALL clients
      // No local state update needed - everyone gets the real Tidal playlist
      clearSearch();
    } catch (err: any) {
      console.error('Failed to add to Tidal playlist:', err);
      setAddError(err.message || 'Failed to add track');
      // Clear error after 3 seconds
      setTimeout(() => setAddError(null), 3000);
    } finally {
      setAddingTrackId(null);
    }
  };

  // Share functionality - always show QR modal
  const handleShare = () => {
    setShowShare(true);
  };

  const copyJoinUrl = async () => {
    const joinUrl = `${window.location.origin}/join/${sessionId}`;
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Open playlist in Tidal
  const openInTidal = () => {
    if (sessionState?.tidalPlaylistUrl) {
      window.open(sessionState.tidalPlaylistUrl, '_blank');
    }
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Loading state
  if (!sessionState) {
    return (
      <div className="page page-centered">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--bg-elevated)',
            borderTopColor: 'var(--accent-cyan)',
            borderRadius: '50%',
          }}
        />
      </div>
    );
  }

  // Playlist picker for host (no playlist selected yet)
  if (showPlaylistPicker && sessionState.isHost) {
    return (
      <div className="page page-centered">
        <div className="container" style={{ maxWidth: '500px' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="card" style={{ padding: 'var(--space-xl)', position: 'relative' }}>
              {/* Close button - only show if there's already a playlist */}
              {sessionState.tidalPlaylistId && (
                <button
                  onClick={() => setShowPlaylistPicker(false)}
                  style={{
                    position: 'absolute',
                    top: 'var(--space-md)',
                    right: 'var(--space-md)',
                    background: 'none',
                    border: 'none',
                    padding: '8px',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                  }}
                  title="Cancel"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
              
              {/* Playlist icon */}
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  margin: '0 auto var(--space-lg)',
                  borderRadius: '16px',
                  background: 'var(--gradient-glow)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--bg-primary)' }}>
                  <path d="M4 4L8 8L4 12L0 8ZM12 4L16 8L12 12L8 8ZM20 4L24 8L20 12L16 8ZM12 12L16 16L12 20L8 16Z"/>
                </svg>
              </div>
              
              <h2 style={{ marginBottom: 'var(--space-sm)', textAlign: 'center' }}>
                Choose a Playlist
              </h2>
              <p className="text-secondary" style={{ marginBottom: 'var(--space-xl)', textAlign: 'center' }}>
                Create new or continue editing an existing one
              </p>
              
              {/* Resume last playlist */}
              {lastPlaylistId && (
                <div style={{ marginBottom: 'var(--space-lg)' }}>
                  <button
                    onClick={() => handleUseExistingPlaylist(lastPlaylistId)}
                    disabled={isLoadingExisting}
                    className="btn btn-secondary"
                    style={{ 
                      width: '100%', 
                      padding: 'var(--space-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 'var(--space-sm)',
                    }}
                  >
                    {isLoadingExisting ? (
                      <>Loading...</>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                          <path d="M3 3v5h5" />
                        </svg>
                        Resume Last Playlist
                      </>
                    )}
                  </button>
                  <p className="text-muted" style={{ fontSize: '0.75rem', textAlign: 'center', marginTop: 'var(--space-xs)' }}>
                    ID: {lastPlaylistId.substring(0, 8)}...
                  </p>
                  {existingPlaylistError && (
                    <p style={{ color: '#ff6b6b', fontSize: '0.8rem', marginTop: 'var(--space-sm)', textAlign: 'center' }}>
                      {existingPlaylistError}
                    </p>
                  )}
                </div>
              )}
              
              {/* Create new playlist */}
              <div style={{ marginBottom: 'var(--space-lg)' }}>
                <label className="text-secondary" style={{ display: 'block', marginBottom: 'var(--space-sm)', fontSize: '0.875rem' }}>
                  Create new playlist
                </label>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="Name (or leave for random)"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateNewPlaylist()}
                    style={{ flex: 1 }}
                  />
                  <button
                    onClick={handleCreateNewPlaylist}
                    disabled={isCreatingPlaylist}
                    className="btn btn-primary"
                  >
                    {isCreatingPlaylist ? '...' : 'Create'}
                  </button>
                </div>
              </div>
              
              {/* Divider */}
              <div style={{ position: 'relative', textAlign: 'center', margin: 'var(--space-lg) 0' }}>
                <div style={{ 
                  position: 'absolute', 
                  left: 0, 
                  right: 0, 
                  top: '50%', 
                  height: '1px', 
                  background: 'var(--bg-elevated)' 
                }} />
                <span style={{ 
                  position: 'relative', 
                  background: 'var(--bg-card)', 
                  padding: '0 var(--space-md)',
                  color: 'var(--text-muted)',
                  fontSize: '0.875rem',
                }}>
                  or edit existing
                </span>
              </div>
              
              {/* Use existing playlist */}
              <div>
                <label className="text-secondary" style={{ display: 'block', marginBottom: 'var(--space-sm)', fontSize: '0.875rem' }}>
                  Paste playlist ID or URL from Tidal
                </label>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g., abc123-def456 or tidal.com/playlist/..."
                    value={existingPlaylistId}
                    onChange={(e) => {
                      setExistingPlaylistId(e.target.value);
                      setExistingPlaylistError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleUseExistingPlaylist()}
                    style={{ flex: 1 }}
                  />
                  <button
                    onClick={() => handleUseExistingPlaylist()}
                    disabled={isLoadingExisting || !existingPlaylistId.trim()}
                    className="btn btn-secondary"
                  >
                    {isLoadingExisting ? '...' : 'Load'}
                  </button>
                </div>
                {existingPlaylistError && (
                  <p style={{ color: '#ff6b6b', fontSize: '0.8rem', marginTop: 'var(--space-sm)' }}>
                    {existingPlaylistError}
                  </p>
                )}
              </div>
            </div>
            
            {/* Share code hint */}
            <p className="text-muted" style={{ marginTop: 'var(--space-lg)', textAlign: 'center', fontSize: '0.875rem' }}>
              Session code: <code style={{ color: 'var(--accent-cyan)' }}>{sessionId}</code>
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <header className="container" style={{ paddingTop: 'var(--space-lg)', paddingBottom: 'var(--space-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{sessionState.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <button
                onClick={copyJoinUrl}
                className="text-muted"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <code style={{ 
                  background: 'var(--bg-elevated)', 
                  padding: '2px 8px', 
                  borderRadius: 'var(--radius-sm)',
                  letterSpacing: '0.1em',
                }}>
                  {sessionId}
                </code>
                {copied ? '✓' : '📋'}
              </button>
              {sessionState.isHost && (
                <span style={{
                  padding: '4px 8px',
                  background: 'var(--accent-cyan)',
                  color: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                }}>
                  HOST
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            {sessionState.isHost && sessionState.tidalPlaylistId && (
              <button 
                onClick={refreshPlaylistFromTidal}
                disabled={isRefreshing}
                className="btn btn-ghost btn-sm"
                title="Refresh from Tidal"
              >
                <motion.div
                  animate={isRefreshing ? { rotate: 360 } : {}}
                  transition={isRefreshing ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
                  style={{ display: 'flex' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                    <path d="M16 16h5v5" />
                  </svg>
                </motion.div>
              </button>
            )}
            {sessionState.isHost && (
              <button 
                onClick={() => setShowPlaylistPicker(true)}
                className="btn btn-ghost btn-sm"
                title="Switch playlist"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18" />
                  <path d="M3 12h18" />
                  <path d="M3 18h18" />
                </svg>
              </button>
            )}
            <button onClick={handleShare} className="btn btn-secondary btn-sm">
              Invite
            </button>
            <button 
              onClick={() => navigate('/')}
              className="btn btn-ghost btn-sm"
              title="Exit session"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', zIndex: 15 }}>
          <input
            type="text"
            className="input"
            placeholder="Search for songs to add..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: '44px',
              paddingRight: searchQuery ? '44px' : undefined,
            }}
          />
          <svg
            width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          {searchQuery && (
            <button
              onClick={clearSearch}
              style={{
                position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', padding: '8px', cursor: 'pointer', color: 'var(--text-muted)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)', borderBottom: '1px solid rgba(255,255,255,0.1)', alignItems: 'center' }}>
          <button
            onClick={() => setActiveTab('playlist')}
            style={{
              background: 'none', border: 'none', padding: 'var(--space-sm) var(--space-md)',
              color: activeTab === 'playlist' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'playlist' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
              cursor: 'pointer', fontWeight: '500',
            }}
          >
            Playlist ({sessionState.tracks.length})
          </button>
          <button
            onClick={() => setActiveTab('participants')}
            style={{
              background: 'none', border: 'none', padding: 'var(--space-sm) var(--space-md)',
              color: activeTab === 'participants' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'participants' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
              cursor: 'pointer', fontWeight: '500',
            }}
          >
            People ({sessionState.participants.length})
          </button>
          
        </div>
      </header>

      {/* Main content */}
      <main className="container" style={{ flex: 1, overflow: 'auto', paddingBottom: '120px' }}>
        {/* Search Results Overlay */}
        {searchQuery.trim().length >= 2 && (
          <>
            <div onClick={clearSearch} style={{ position: 'fixed', inset: 0, zIndex: 5 }} />
            <div style={{ position: 'relative', zIndex: 10, marginBottom: 'var(--space-lg)' }}>
              {isSearching ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    style={{ display: 'inline-block' }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                  </motion.div>
                </div>
              ) : searchResults.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
                  No results for "{searchQuery}"
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                  {/* Error message */}
                  {addError && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        padding: 'var(--space-md)',
                        background: 'rgba(255, 100, 100, 0.15)',
                        border: '1px solid rgba(255, 100, 100, 0.3)',
                        borderRadius: 'var(--radius-md)',
                        color: '#ff6b6b',
                        fontSize: '0.875rem',
                        textAlign: 'center',
                      }}
                    >
                      ❌ {addError}
                    </motion.div>
                  )}
                  {searchResults.map((track) => (
                    <motion.div
                      key={track.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="card"
                      style={{ padding: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}
                    >
                      <img
                        src={track.albumArt}
                        alt={track.album}
                        style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {track.title}
                        </div>
                        <div className="text-secondary" style={{ fontSize: '0.875rem' }}>
                          {track.artist}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleAddTrack(track)} 
                        className="btn btn-primary btn-sm"
                        disabled={addingTrackId === track.id}
                        style={{ minWidth: '60px' }}
                      >
                        {addingTrackId === track.id ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            style={{ width: '16px', height: '16px' }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                            </svg>
                          </motion.div>
                        ) : 'Add'}
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <AnimatePresence mode="wait">
          {activeTab === 'playlist' ? (
            <motion.div key="playlist" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Priority: Loading > Empty > Tracks */}
              {isLoadingPlaylist ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    style={{
                      width: '80px', height: '80px', margin: '0 auto var(--space-lg)',
                      borderRadius: '50%', background: 'var(--bg-elevated)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--accent-cyan)' }}>
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                  </motion.div>
                  <h3 className="text-secondary" style={{ marginBottom: 'var(--space-sm)' }}>
                    Loading playlist...
                  </h3>
                  <p className="text-muted">Fetching tracks from Tidal</p>
                </div>
              ) : sessionState.tracks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                  <div style={{
                    width: '80px', height: '80px', margin: '0 auto var(--space-lg)',
                    borderRadius: '50%', background: 'var(--bg-elevated)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)' }}>
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                  </div>
                  <h3 className="text-secondary" style={{ marginBottom: 'var(--space-sm)' }}>
                    Playlist is empty
                  </h3>
                  <p className="text-muted">Search for songs above to add them</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                  {sessionState.tracks.map((track, index) => (
                    <motion.div
                      key={track.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="card"
                      style={{ padding: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}
                    >
                      <span className="text-muted" style={{ width: '24px', textAlign: 'center', fontSize: '0.875rem' }}>
                        {index + 1}
                      </span>
                      <img
                        src={track.albumArt}
                        alt={track.album}
                        style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {track.title}
                        </div>
                        <div className="text-secondary" style={{ fontSize: '0.875rem' }}>
                          {track.artist} • {track.addedBy}
                        </div>
                      </div>
                      <span className="text-muted" style={{ fontSize: '0.875rem' }}>
                        {formatDuration(track.duration)}
                      </span>
                      {sessionState.isHost && (
                        <button
                          onClick={() => handleDeleteTrack(track.id)}
                          disabled={deletingTrackId === track.id}
                          title="Remove from playlist"
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '8px',
                            cursor: deletingTrackId === track.id ? 'wait' : 'pointer',
                            color: 'var(--text-muted)',
                            opacity: deletingTrackId === track.id ? 0.5 : 1,
                            transition: 'color 0.2s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#ff6b6b'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                        >
                          {deletingTrackId === track.id ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                              </svg>
                            </motion.div>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18" />
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                          )}
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="participants" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {sessionState.participants.map((name, index) => (
                  <div key={index} className="card" style={{ padding: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '50%',
                      background: `hsl(${(name.charCodeAt(0) * 137) % 360}, 60%, 50%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: '600',
                    }}>
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <span>{name}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom bar - Open in Tidal (host only) */}
      {sessionState.isHost && sessionState.tidalPlaylistId && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, var(--bg-primary) 20%)',
          padding: 'var(--space-xl) var(--space-lg) var(--space-lg)',
        }}>
          <div className="container">
            <button onClick={openInTidal} className="btn btn-primary" style={{ width: '100%', padding: 'var(--space-md)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px' }}>
                <path d="M4 4L8 8L4 12L0 8ZM12 4L16 8L12 12L8 8ZM20 4L24 8L20 12L16 8ZM12 12L16 16L12 20L8 16Z"/>
              </svg>
              Open in Tidal
            </button>
          </div>
        </div>
      )}

      {/* Share Modal */}
      <AnimatePresence>
        {showShare && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowShare(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 100, padding: 'var(--space-lg)',
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="card"
              style={{ maxWidth: '400px', width: '100%', padding: 'var(--space-xl)' }}
            >
              <h3 style={{ marginBottom: 'var(--space-lg)', textAlign: 'center' }}>Invite Friends</h3>
              
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-lg)' }}>
                <QRCodeSVG
                  value={`${window.location.origin}/join/${sessionId}`}
                  size={180}
                  bgColor="transparent"
                  fgColor="#22d3ee"
                />
              </div>
              
              <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
                <p className="text-secondary" style={{ marginBottom: 'var(--space-sm)' }}>Code</p>
                <code style={{ fontSize: '2rem', letterSpacing: '0.2em', fontWeight: '700', color: 'var(--accent-cyan)' }}>
                  {sessionId}
                </code>
              </div>
              
              <button onClick={copyJoinUrl} className="btn btn-primary" style={{ width: '100%' }}>
                {copied ? 'Copied!' : 'Copy Invite Link'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
