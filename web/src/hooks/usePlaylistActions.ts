import { useState, useCallback } from 'react';
import { apiFetch } from '../config';
import type { SearchResult } from '../types';

interface UsePlaylistActionsProps {
  sessionId?: string;
  playlistId?: string;
  onClearSearch?: () => void;
}

/**
 * Hook for playlist operations within an active session.
 * Handles refreshing, adding tracks, and deleting tracks.
 */
export function usePlaylistActions({
  sessionId,
  playlistId,
  onClearSearch,
}: UsePlaylistActionsProps) {
  // Loading states
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Track operations
  const [addingTrackId, setAddingTrackId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [deletingTrackId, setDeletingTrackId] = useState<string | null>(null);

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
  const deleteTrack = useCallback(async (trackId: string, tidalId: string) => {
    console.log('>>> deleteTrack called:', { trackId, tidalId, playlistId, sessionId });
    
    if (!playlistId) {
      console.error('>>> deleteTrack: No playlistId');
      return false;
    }
    
    setDeletingTrackId(trackId); // Use internal ID for UI state
    try {
      const requestBody = {
        trackIds: [tidalId], // Use Tidal ID for API
        sessionId: sessionId?.toUpperCase(),
      };
      console.log('>>> deleteTrack request:', { url: `/api/tidal/playlists/${playlistId}/tracks`, body: requestBody });
      
      const response = await apiFetch(`/api/tidal/playlists/${playlistId}/tracks`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      const responseData = await response.json().catch(() => ({}));
      console.log('>>> deleteTrack response:', { status: response.status, ok: response.ok, data: responseData });
      
      if (!response.ok) {
        console.error('>>> deleteTrack failed:', response.status, responseData);
        throw new Error(responseData.error || 'Failed to delete track');
      }
      return true;
    } catch (err) {
      console.error('>>> deleteTrack error:', err);
      return false;
    } finally {
      setDeletingTrackId(null);
    }
  }, [playlistId, sessionId]);

  return {
    // Loading states
    isRefreshing,
    isLoading: isRefreshing,
    
    // Track operation states
    addingTrackId,
    addError,
    deletingTrackId,
    
    // Actions
    refreshPlaylist,
    addTrack,
    deleteTrack,
  };
}
