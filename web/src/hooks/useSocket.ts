import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { SessionState, Track } from '../types';
import { WS_URL } from '../config';

interface UseSocketReturn {
  isConnected: boolean;
  sessionState: SessionState | null;
  error: string | null;
  /** True when we're waiting for playlist_synced after a playlist change */
  isAwaitingSync: boolean;
  /** True when the current playlist was deleted from Tidal */
  playlistDeleted: boolean;
  joinSession: (sessionId: string, displayName: string, asHost: boolean) => void;
  addToPlaylist: (track: Omit<Track, 'id' | 'addedBy'>) => void;
  setPlaylist: (tidalPlaylistId: string, tidalPlaylistUrl: string, playlistName?: string) => void;
  /** Call before loading a playlist to clear tracks and show loading state */
  startLoading: () => void;
  /** Clear the deleted flag (when switching to a new playlist) */
  clearDeletedFlag: () => void;
}

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAwaitingSync, setIsAwaitingSync] = useState(false);
  const [playlistDeleted, setPlaylistDeleted] = useState(false);

  useEffect(() => {
    // Connect to WebSocket server
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    socket.on('error', (data: { message: string }) => {
      setError(data.message);
    });

    socket.on('session_state', (state: SessionState) => {
      console.log('Received session state:', state);
      setSessionState(state);
    });

    socket.on('playlist_updated', (data: { tracks: Track[]; action: string; track: Track; addedBy: string }) => {
      console.log('Playlist updated:', data.action, data.track.title, 'by', data.addedBy);
      setSessionState((prev) => prev ? { ...prev, tracks: data.tracks } : null);
    });

    // Playlist synced from Tidal (source of truth) - loading complete
    socket.on('playlist_synced', (data: { tracks: Track[]; playlistName?: string }) => {
      console.log('Playlist synced from Tidal:', data.tracks.length, 'tracks', data.playlistName ? `(${data.playlistName})` : '');
      setIsAwaitingSync(false); // Loading complete
      setSessionState((prev) => prev ? { 
        ...prev, 
        tracks: data.tracks,
        // Update name if provided (from refresh)
        ...(data.playlistName ? { name: data.playlistName } : {}),
      } : null);
    });

    socket.on('playlist_linked', (data: { tidalPlaylistId: string; tidalPlaylistUrl: string; sessionName?: string }) => {
      console.log('Playlist linked:', data.tidalPlaylistId, data.sessionName);
      setPlaylistDeleted(false); // Clear deleted flag when linking new playlist
      setSessionState((prev) => prev ? { 
        ...prev, 
        tidalPlaylistId: data.tidalPlaylistId,
        tidalPlaylistUrl: data.tidalPlaylistUrl,
        name: data.sessionName || prev.name,
        tracks: [], // Clear old tracks when switching playlists
      } : null);
    });

    socket.on('playlist_deleted', (data: { playlistId: string; message: string }) => {
      console.log('Playlist deleted:', data.playlistId, data.message);
      setPlaylistDeleted(true);
      setIsAwaitingSync(false); // Stop any loading state
    });

    socket.on('participant_joined', (data: { name: string; participants: string[] }) => {
      console.log(`${data.name} joined`);
      setSessionState((prev) => prev ? { ...prev, participants: data.participants } : null);
    });

    socket.on('participant_left', (data: { name: string; participants: string[] }) => {
      console.log(`${data.name} left`);
      setSessionState((prev) => prev ? { ...prev, participants: data.participants } : null);
    });

    socket.on('promoted_to_host', () => {
      console.log('You are now the host!');
      setSessionState((prev) => prev ? { ...prev, isHost: true } : null);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinSession = useCallback((sessionId: string, displayName: string, asHost: boolean) => {
    if (socketRef.current) {
      socketRef.current.emit('join_session', { sessionId, displayName, asHost });
    }
  }, []);

  const addToPlaylist = useCallback((track: Omit<Track, 'id' | 'addedBy'>) => {
    if (socketRef.current) {
      socketRef.current.emit('add_to_playlist', { track });
    }
  }, []);

  const setPlaylist = useCallback((tidalPlaylistId: string, tidalPlaylistUrl: string, playlistName?: string) => {
    if (socketRef.current) {
      socketRef.current.emit('set_playlist', { tidalPlaylistId, tidalPlaylistUrl, playlistName });
    }
  }, []);

  // Call before loading a new playlist - clears tracks and sets loading state
  const startLoading = useCallback(() => {
    setIsAwaitingSync(true);
    setPlaylistDeleted(false); // Clear deleted flag
    setSessionState((prev) => prev ? { ...prev, tracks: [] } : null);
  }, []);

  // Clear the deleted flag (when user acknowledges or switches playlist)
  const clearDeletedFlag = useCallback(() => {
    setPlaylistDeleted(false);
  }, []);

  return {
    isConnected,
    sessionState,
    error,
    isAwaitingSync,
    playlistDeleted,
    joinSession,
    addToPlaylist,
    setPlaylist,
    startLoading,
    clearDeletedFlag,
  };
}
