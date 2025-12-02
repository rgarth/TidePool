import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { useSocket } from '../hooks/useSocket';
import { useSearch } from '../hooks/useSearch';
import { TrackItem } from '../components/TrackItem';
import { PlaylistPicker } from '../components/PlaylistPicker';
import { SessionHeader } from '../components/SessionHeader';
import { SearchResults } from '../components/SearchResults';
import { TidalLogo, MusicIcon } from '../components/Icons';
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

  const { searchQuery, setSearchQuery, searchResults, isSearching, clearSearch } = useSearch(sessionId);
  const [activeTab, setActiveTab] = useState<'playlist' | 'participants'>('playlist');
  
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
      <PlaylistPicker
        sessionId={sessionId}
        lastPlaylistId={lastPlaylistId}
        existingPlaylistId={existingPlaylistId}
        newPlaylistName={newPlaylistName}
        existingPlaylistError={existingPlaylistError}
        isLoadingExisting={isLoadingExisting}
        isCreatingPlaylist={isCreatingPlaylist}
        hasLinkedPlaylist={!!sessionState.tidalPlaylistId}
        onClose={() => setShowPlaylistPicker(false)}
        onCreateNewPlaylist={handleCreateNewPlaylist}
        onUseExistingPlaylist={handleUseExistingPlaylist}
        onNewPlaylistNameChange={setNewPlaylistName}
        onExistingPlaylistIdChange={(id) => {
          setExistingPlaylistId(id);
          setExistingPlaylistError('');
        }}
      />
    );
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <SessionHeader
        sessionName={sessionState.name}
        sessionId={sessionId}
        isHost={sessionState.isHost}
        hasPlaylist={!!sessionState.tidalPlaylistId}
        isRefreshing={isRefreshing}
        copied={copied}
        trackCount={sessionState.tracks.length}
        participantCount={sessionState.participants.length}
        activeTab={activeTab}
        searchQuery={searchQuery}
        onCopyCode={copyJoinUrl}
        onRefresh={refreshPlaylistFromTidal}
        onOpenPlaylistPicker={() => setShowPlaylistPicker(true)}
        onShare={handleShare}
        onExit={() => navigate('/')}
        onSearchChange={setSearchQuery}
        onClearSearch={clearSearch}
        onTabChange={setActiveTab}
      />

      {/* Main content */}
      <main className="container" style={{ flex: 1, overflow: 'auto', paddingBottom: '120px' }}>
        <SearchResults
          searchQuery={searchQuery}
          searchResults={searchResults}
          isSearching={isSearching}
          addingTrackId={addingTrackId}
          addError={addError}
          onAddTrack={handleAddTrack}
          onClearSearch={clearSearch}
        />

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
                    <MusicIcon size={40} style={{ color: 'var(--accent-cyan)' }} />
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
                    <MusicIcon size={40} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <h3 className="text-secondary" style={{ marginBottom: 'var(--space-sm)' }}>
                    Playlist is empty
                  </h3>
                  <p className="text-muted">Search for songs above to add them</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                  {sessionState.tracks.map((track, index) => (
                    <TrackItem
                      key={track.id}
                      track={track}
                      index={index}
                      isHost={sessionState.isHost}
                      isDeleting={deletingTrackId === track.id}
                      onDelete={handleDeleteTrack}
                      formatDuration={formatDuration}
                    />
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
              <TidalLogo size={20} style={{ marginRight: '8px' }} />
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
