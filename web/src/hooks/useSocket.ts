import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { SessionState, Track } from '../types';

interface UseSocketReturn {
  isConnected: boolean;
  sessionState: SessionState | null;
  error: string | null;
  joinSession: (sessionId: string, displayName: string, asHost: boolean) => void;
  addToQueue: (track: Omit<Track, 'id' | 'addedBy'>, position: 'end' | 'next') => void;
  removeFromQueue: (trackId: string) => void;
  playbackControl: (action: 'play' | 'pause' | 'next' | 'previous' | 'jump', trackIndex?: number) => void;
  trackEnded: () => void;
}

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Connect to WebSocket server
    const socket = io({
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

    socket.on('queue_updated', (data: { queue: Track[]; action: string; track: Track }) => {
      console.log('Queue updated:', data.action, data.track.title);
      setSessionState((prev) => prev ? { ...prev, queue: data.queue } : null);
    });

    socket.on('playback_state', (data: { isPlaying: boolean; currentTrackIndex: number; currentTrack: Track | null }) => {
      console.log('Playback state:', data);
      setSessionState((prev) =>
        prev
          ? {
              ...prev,
              isPlaying: data.isPlaying,
              currentTrackIndex: data.currentTrackIndex,
            }
          : null
      );
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

  const addToQueue = useCallback((track: Omit<Track, 'id' | 'addedBy'>, position: 'end' | 'next') => {
    if (socketRef.current) {
      socketRef.current.emit('add_to_queue', { track, position });
    }
  }, []);

  const removeFromQueue = useCallback((trackId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('remove_from_queue', { trackId });
    }
  }, []);

  const playbackControl = useCallback((action: 'play' | 'pause' | 'next' | 'previous' | 'jump', trackIndex?: number) => {
    if (socketRef.current) {
      socketRef.current.emit('playback_control', { action, trackIndex });
    }
  }, []);

  const trackEnded = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('track_ended');
    }
  }, []);

  return {
    isConnected,
    sessionState,
    error,
    joinSession,
    addToQueue,
    removeFromQueue,
    playbackControl,
    trackEnded,
  };
}

