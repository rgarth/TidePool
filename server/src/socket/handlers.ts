// WebSocket event handlers
import { Server, Socket } from 'socket.io';
import { nanoid } from 'nanoid';
import { Track } from '../types/index.js';
import { sessions } from '../routes/sessions.js';
import { pendingAuth } from '../routes/auth.js';
import { hostTokens } from '../services/tokens.js';
import { sanitizeDisplayName } from '../utils/sanitize.js';

export function setupSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);
    
    let currentSessionId: string | null = null;
    let isHost = false;

    // Join a session
    socket.on('join_session', ({ sessionId, displayName, asHost, hostToken }) => {
      const session = sessions.get(sessionId.toUpperCase());
      
      if (!session) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      currentSessionId = session.id;
      socket.join(session.id);
      
      // Sanitize display name
      const safeDisplayName = sanitizeDisplayName(displayName, 'Guest');
      
      // Check if this is the session owner (same hostToken - shared across all user's devices)
      const isSessionOwner = hostToken && session.hostToken === hostToken;
      
      if (asHost && (!session.hostId || isSessionOwner)) {
        session.hostId = socket.id;
        isHost = true;
        
        // If hostName not set (reconnecting with existing token), look it up
        if (!session.hostName && hostToken) {
          const tokens = hostTokens.get(hostToken);
          if (tokens?.username) {
            session.hostName = sanitizeDisplayName(tokens.username, 'Host');
            session.hostToken = hostToken; // Also ensure hostToken is set for guests
            console.log(`Retrieved hostName from stored token: ${tokens.username}`);
          }
        }
      }
      
      // Use Tidal username for host if available, otherwise use provided displayName
      const actualDisplayName = (asHost && session.hostName) ? session.hostName : safeDisplayName;
      session.participants.set(socket.id, actualDisplayName);
      
      // Send current state to the joining client
      socket.emit('session_state', {
        id: session.id,
        name: session.name,
        tracks: session.tracks,
        tidalPlaylistId: session.tidalPlaylistId,
        tidalPlaylistUrl: session.tidalPlaylistUrl,
        isPublic: session.isPublic ?? true, // Default to public
        isHost,
        participants: Array.from(session.participants.values()),
      });
      
      // Notify others
      socket.to(session.id).emit('participant_joined', {
        name: displayName,
        participants: Array.from(session.participants.values()),
      });
      
      console.log(`${actualDisplayName} joined session ${session.id} as ${isHost ? 'host' : 'guest'}`);
    });

    // Add track to playlist
    socket.on('add_to_playlist', ({ track }) => {
      if (!currentSessionId) return;
      
      const session = sessions.get(currentSessionId);
      if (!session) return;
      
      const displayName = session.participants.get(socket.id) || 'Unknown';
      const newTrack: Track = {
        ...track,
        id: nanoid(),
        addedBy: displayName,
      };

      session.tracks.push(newTrack);

      io.to(session.id).emit('playlist_updated', {
        tracks: session.tracks,
        action: 'added',
        track: newTrack,
        addedBy: displayName,
      });
      
      console.log(`${displayName} added "${track.title}" to playlist`);
    });

    // Set playlist ID for session
    socket.on('set_playlist', ({ tidalPlaylistId, tidalPlaylistUrl, playlistName }) => {
      if (!currentSessionId || !isHost) return;
      
      const session = sessions.get(currentSessionId);
      if (!session) return;

      session.tidalPlaylistId = tidalPlaylistId;
      session.tidalPlaylistUrl = tidalPlaylistUrl;
      
      if (playlistName) {
        session.name = playlistName;
      }

      io.to(session.id).emit('playlist_linked', {
        tidalPlaylistId,
        tidalPlaylistUrl,
        sessionName: session.name,
      });
      
      console.log(`Playlist ${tidalPlaylistId} (${session.name}) linked to session ${currentSessionId}`);
    });

    // Disconnect
    socket.on('disconnect', () => {
      if (currentSessionId) {
        const session = sessions.get(currentSessionId);
        if (session) {
          const displayName = session.participants.get(socket.id);
          session.participants.delete(socket.id);
          
          if (isHost) {
            if (session.participants.size === 0) {
              const hasPendingAuth = Array.from(pendingAuth.values()).some(
                p => p.sessionId.toUpperCase() === currentSessionId!.toUpperCase()
              );
              
              session.hostId = '';
              
              if (hasPendingAuth) {
                console.log(`Session ${currentSessionId} kept alive (auth pending)`);
              } else {
                console.log(`Session ${currentSessionId} will expire in 5 minutes (host left)`);
                const sessionIdToDelete = currentSessionId;
                setTimeout(() => {
                  const currentSession = sessions.get(sessionIdToDelete);
                  if (currentSession && currentSession.participants.size === 0) {
                    sessions.delete(sessionIdToDelete);
                    saveSessions(sessions);
                    console.log(`Session ${sessionIdToDelete} expired`);
                  }
                }, 5 * 60 * 1000);
              }
            } else {
              const newHostId = session.participants.keys().next().value;
              if (newHostId) {
                session.hostId = newHostId;
                io.to(newHostId).emit('promoted_to_host');
              }
            }
          }
          
          socket.to(session.id).emit('participant_left', {
            name: displayName,
            participants: Array.from(session.participants.values()),
          });
        }
      }
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}

