import { useState, useCallback, useEffect } from 'react';
import { apiFetch } from '../config';
import type { SearchResult } from '../types';

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

function generateRandomName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj} ${noun}`;
}

function extractPlaylistId(input: string): string | null {
  const trimmed = input.trim();
  
  // Try to extract UUID from URL (tidal.com/playlist/UUID or listen.tidal.com/playlist/UUID)
  const urlMatch = trimmed.match(/playlist\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (urlMatch) return urlMatch[1];
  
  // Check if input itself is a valid UUID
  const uuidMatch = trimmed.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  if (uuidMatch) return uuidMatch[1];
  
  return null;
}

interface UsePlaylistActionsProps {
  sessionId?: string;
  playlistId?: string;
  onPlaylistSet: (id: string, url: string, name: string) => void;
  onStartLoading: () => void;
  onClearSearch?: () => void;
}

export function usePlaylistActions({
  sessionId,
  playlistId,
  onPlaylistSet,
  onStartLoading,
  onClearSearch,
}: UsePlaylistActionsProps) {
  // Playlist picker state
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [existingPlaylistId, setExistingPlaylistId] = useState('');
  const [existingPlaylistError, setExistingPlaylistError] = useState('');
  
  // Loading states
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Track operations
  const [addingTrackId, setAddingTrackId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [deletingTrackId, setDeletingTrackId] = useState<string | null>(null);
  
  // Last used playlist (from localStorage)
  const [lastPlaylistId, setLastPlaylistId] = useState<string | null>(null);
  
  // Load last playlist ID from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('tidepool_last_playlist');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setLastPlaylistId(data.id);
      } catch {}
    }
  }, []);
  
  // Save playlist to localStorage
  const saveLastPlaylist = useCallback((id: string, name: string) => {
    localStorage.setItem('tidepool_last_playlist', JSON.stringify({
      id,
      name,
      createdAt: new Date().toISOString(),
    }));
    setLastPlaylistId(id);
  }, []);

  // Create new playlist
  const createPlaylist = useCallback(async () => {
    const name = newPlaylistName.trim() || generateRandomName();
    
    setIsCreatingPlaylist(true);
    onStartLoading();
    
    try {
      const response = await apiFetch('/api/tidal/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: 'Created with TidePool' }),
      });
      
      if (!response.ok) throw new Error('Failed to create playlist');
      
      const data = await response.json();
      onPlaylistSet(data.id, data.listenUrl, name);
      setNewPlaylistName('');
      saveLastPlaylist(data.id, name);
      
      // Trigger refresh to sync
      setTimeout(() => {
        apiFetch(`/api/tidal/playlists/${data.id}/refresh?sessionId=${sessionId}`);
      }, 300);
      
      return true;
    } catch (err) {
      console.error('Failed to create playlist:', err);
      return false;
    } finally {
      setIsCreatingPlaylist(false);
    }
  }, [newPlaylistName, sessionId, onPlaylistSet, onStartLoading, saveLastPlaylist]);

  // Load existing playlist by ID or URL
  const loadExistingPlaylist = useCallback(async (idOrUrl?: string) => {
    const input = idOrUrl || existingPlaylistId;
    const cleanId = extractPlaylistId(input);
    
    if (!cleanId) {
      setExistingPlaylistError('Please enter a valid playlist ID or Tidal URL');
      return false;
    }
    
    setIsLoadingExisting(true);
    setExistingPlaylistError('');
    
    try {
      const response = await apiFetch(`/api/tidal/playlists/${cleanId}/tracks`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Playlist not found or no longer accessible.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Playlist not found');
      }
      
      const data = await response.json();
      const playlistName = data.playlistName;
      
      onStartLoading();
      setExistingPlaylistId('');
      
      const listenUrl = `https://listen.tidal.com/playlist/${cleanId}`;
      onPlaylistSet(cleanId, listenUrl, playlistName);
      saveLastPlaylist(cleanId, playlistName);
      
      // Trigger refresh to sync
      setTimeout(() => {
        apiFetch(`/api/tidal/playlists/${cleanId}/refresh?sessionId=${sessionId}`);
      }, 500);
      
      return true;
    } catch (err: any) {
      setExistingPlaylistError(err.message || 'Failed to load playlist');
      return false;
    } finally {
      setIsLoadingExisting(false);
    }
  }, [existingPlaylistId, sessionId, onPlaylistSet, onStartLoading, saveLastPlaylist]);

  // Refresh playlist from Tidal
  const refreshPlaylist = useCallback(async () => {
    if (!playlistId) return;
    
    setIsRefreshing(true);
    try {
      const response = await apiFetch(`/api/tidal/playlists/${playlistId}/refresh?sessionId=${sessionId}`);
      if (!response.ok) throw new Error('Failed to refresh');
    } catch (err) {
      console.error('Failed to refresh playlist:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [playlistId, sessionId]);

  // Add track to playlist
  const addTrack = useCallback(async (track: SearchResult) => {
    if (!playlistId) {
      setAddError('No playlist selected');
      return false;
    }
    
    setAddingTrackId(track.id);
    setAddError(null);
    
    try {
      const response = await apiFetch(`/api/tidal/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackIds: [track.tidalId],
          sessionId,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to add track (${response.status})`);
      }
      
      onClearSearch?.();
      return true;
    } catch (err: any) {
      console.error('Failed to add track:', err);
      setAddError(err.message || 'Failed to add track');
      setTimeout(() => setAddError(null), 3000);
      return false;
    } finally {
      setAddingTrackId(null);
    }
  }, [playlistId, sessionId, onClearSearch]);

  // Delete track from playlist
  const deleteTrack = useCallback(async (trackId: string) => {
    if (!playlistId) return false;
    
    setDeletingTrackId(trackId);
    try {
      const response = await apiFetch(`/api/tidal/playlists/${playlistId}/tracks`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackIds: [trackId],
          sessionId: sessionId?.toUpperCase(),
        }),
      });
      
      if (!response.ok) throw new Error('Failed to delete track');
      return true;
    } catch (err) {
      console.error('Failed to delete track:', err);
      return false;
    } finally {
      setDeletingTrackId(null);
    }
  }, [playlistId, sessionId]);


  // Toggle playlist privacy
  const [isTogglingPrivacy, setIsTogglingPrivacy] = useState(false);
  
  const togglePrivacy = useCallback(async (newIsPublic: boolean) => {
    if (!playlistId) return false;
    
    setIsTogglingPrivacy(true);
    try {
      const response = await apiFetch(`/api/tidal/playlists/${playlistId}/privacy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPublic: newIsPublic,
          sessionId: sessionId?.toUpperCase(),
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update privacy');
      }
      
      return true;
    } catch (err) {
      console.error('Failed to toggle privacy:', err);
      return false;
    } finally {
      setIsTogglingPrivacy(false);
    }
  }, [playlistId, sessionId]);

  // Clear existing playlist error when input changes
  const handleExistingPlaylistIdChange = useCallback((id: string) => {
    setExistingPlaylistId(id);
    setExistingPlaylistError('');
  }, []);

  return {
    // Picker state
    newPlaylistName,
    setNewPlaylistName,
    existingPlaylistId,
    setExistingPlaylistId: handleExistingPlaylistIdChange,
    existingPlaylistError,
    lastPlaylistId,
    
    // Loading states
    isCreatingPlaylist,
    isLoadingExisting,
    isRefreshing,
    isTogglingPrivacy,
    isLoading: isCreatingPlaylist || isLoadingExisting || isRefreshing,
    
    // Track operation states
    addingTrackId,
    addError,
    deletingTrackId,
    
    // Actions
    createPlaylist,
    loadExistingPlaylist,
    refreshPlaylist,
    addTrack,
    deleteTrack,
    togglePrivacy,
  };
}


