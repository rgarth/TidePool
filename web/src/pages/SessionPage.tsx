import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../hooks/useSocket';
import { useSearch } from '../hooks/useSearch';
import { useAuth } from '../hooks/useAuth';
import { PlaylistPicker } from '../components/PlaylistPicker';
import { SessionHeader } from '../components/SessionHeader';
import { SearchResults } from '../components/SearchResults';
import { PlaylistView } from '../components/PlaylistView';
import { ParticipantsList } from '../components/ParticipantsList';
import { ShareModal } from '../components/ShareModal';
import { BottomBar } from '../components/BottomBar';
import { PageSpinner } from '../components/Spinner';
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
    isAwaitingSync,
    joinSession,
    setPlaylist,
    startLoading,
  } = useSocket();

  const { searchQuery, setSearchQuery, searchResults, isSearching, clearSearch } = useSearch(sessionId);
  const [activeTab, setActiveTab] = useState<'playlist' | 'participants'>('playlist');
  
  // Check if just returned from auth (need to calculate before useAuth)
  const authSuccess = searchParams.get('auth') === 'success';
  const urlToken = searchParams.get('token');
  
  // Authentication state - delay check if we just got a token from URL
  const { isAuthenticated } = useAuth({ delayCheck: authSuccess && urlToken ? 100 : 0 });
  
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

  // Show playlist picker for host if no playlist linked yet
  useEffect(() => {
    if (sessionState?.isHost && isAuthenticated && !sessionState.tidalPlaylistId) {
      setShowPlaylistPicker(true);
    }
  }, [sessionState?.isHost, isAuthenticated, sessionState?.tidalPlaylistId]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Show loading when: awaiting socket sync, API calls in progress, or refreshing
  const isLoadingPlaylist = isAwaitingSync || isLoadingExisting || isCreatingPlaylist || isRefreshing;
  
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
    startLoading(); // Clear tracks and show loading
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
    
    // Clear tracks and show loading state
    startLoading();
    setIsLoadingExisting(true);
    setExistingPlaylistError('');
    setShowPlaylistPicker(false);
    
    try {
      // Verify playlist exists and get its info from Tidal API
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
      
      // Clear input field
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

  // Loading state
  if (!sessionState) {
    return <PageSpinner />;
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
              <PlaylistView
                tracks={sessionState.tracks}
                isLoading={isLoadingPlaylist}
                isHost={sessionState.isHost}
                deletingTrackId={deletingTrackId}
                onDeleteTrack={handleDeleteTrack}
              />
            </motion.div>
          ) : (
            <motion.div key="participants" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ParticipantsList participants={sessionState.participants} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomBar
        isHost={sessionState.isHost}
        hasPlaylist={!!sessionState.tidalPlaylistId}
        onOpenInTidal={openInTidal}
      />

      <ShareModal
        isOpen={showShare}
        sessionId={sessionId}
        copied={copied}
        onClose={() => setShowShare(false)}
        onCopyLink={copyJoinUrl}
      />
    </div>
  );
}
