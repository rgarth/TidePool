// WebSocket event handlers
import { Server, Socket } from 'socket.io';
import { pendingAuth } from '../routes/auth.js';
import { getHostToken } from '../services/tokens.js';
import * as valkey from '../services/valkey.js';
import { sanitizeDisplayName } from '../utils/sanitize.js';

// In-memory participants tracking (tied to socket connections, not persisted)
// Maps sessionId -> Map<socketId, displayName>
const sessionParticipants = new Map<string, Map<string, string>>();

function getParticipants(sessionId: string): Map<string, string> {
  if (!sessionParticipants.has(sessionId)) {
    sessionParticipants.set(sessionId, new Map());
  }
  return sessionParticipants.get(sessionId)!;
}

export function setupSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);
    
    let currentSessionId: string | null = null;
    let isHost = false;

    // Join a session
    socket.on('join_session', async ({ sessionId, displayName, asHost, hostToken }) => {
      try {
        const session = await valkey.getSession(sessionId.toUpperCase());
        
        if (!session) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        currentSessionId = session.id;
        socket.join(session.id);
        
        const safeDisplayName = sanitizeDisplayName(displayName, 'Guest');
        const participants = getParticipants(session.id);
        
        // Check if this is the session owner
        const isSessionOwner = hostToken && session.hostToken === hostToken;
        
        if (asHost && (!session.hostId || isSessionOwner)) {
          session.hostId = socket.id;
          isHost = true;
          
          // If hostName not set, look it up from token
          if (!session.hostName && hostToken) {
            const tokens = await getHostToken(hostToken);
            if (tokens?.username) {
              session.hostName = sanitizeDisplayName(tokens.username, 'Host');
              session.hostToken = hostToken;
              await valkey.setSession(session.id, session);
              console.log(`Retrieved hostName from stored token: ${tokens.username}`);
            }
          }
        }
        
        const actualDisplayName = (asHost && session.hostName) ? session.hostName : safeDisplayName;
        participants.set(socket.id, actualDisplayName);
        
        // Update session hostId if needed
        if (isHost && session.hostId !== socket.id) {
          session.hostId = socket.id;
          await valkey.setSession(session.id, session);
        }
        
        // Refresh session TTL
        await valkey.touchSession(session.id);
        
        socket.emit('session_state', {
          id: session.id,
          name: session.name,
          tracks: session.tracks,
          tidalPlaylistId: session.tidalPlaylistId,
          tidalPlaylistUrl: session.tidalPlaylistUrl,
          isPublic: session.isPublic ?? true,
          isHost,
          participants: Array.from(participants.values()),
        });
        
        socket.to(session.id).emit('participant_joined', {
          name: actualDisplayName,
          participants: Array.from(participants.values()),
        });
        
        console.log(`${actualDisplayName} joined session ${session.id} as ${isHost ? 'host' : 'guest'}`);
      } catch (err) {
        console.error('Error joining session:', err);
        socket.emit('error', { message: 'Failed to join session' });
      }
    });

    // Set playlist ID for session
    socket.on('set_playlist', async ({ tidalPlaylistId, tidalPlaylistUrl, playlistName }) => {
      if (!currentSessionId || !isHost) return;
      
      try {
        const session = await valkey.getSession(currentSessionId);
        if (!session) return;

        session.tidalPlaylistId = tidalPlaylistId;
        session.tidalPlaylistUrl = tidalPlaylistUrl;
        
        if (playlistName) {
          session.name = playlistName;
        }
        
        await valkey.setSession(session.id, session);

        io.to(session.id).emit('playlist_linked', {
          tidalPlaylistId,
          tidalPlaylistUrl,
          sessionName: session.name,
        });
        
        console.log(`Playlist ${tidalPlaylistId} (${session.name}) linked to session ${currentSessionId}`);
      } catch (err) {
        console.error('Error setting playlist:', err);
      }
    });

    // Disconnect
    socket.on('disconnect', async () => {
      if (currentSessionId) {
        try {
          const session = await valkey.getSession(currentSessionId);
          const participants = getParticipants(currentSessionId);
          
          if (session) {
            const displayName = participants.get(socket.id);
            participants.delete(socket.id);
            
            if (isHost) {
              if (participants.size === 0) {
                const hasPendingAuth = Array.from(pendingAuth.values()).some(
                  p => p.sessionId.toUpperCase() === currentSessionId!.toUpperCase()
                );
                
                session.hostId = '';
                await valkey.setSession(session.id, session);
                
                if (hasPendingAuth) {
                  console.log(`Session ${currentSessionId} kept alive (auth pending)`);
                } else {
                  // Sessions in Valkey have TTL, so we don't need to manually delete
                  // Just log it
                  console.log(`Session ${currentSessionId} host left (will expire based on TTL)`);
                }
              } else {
                const newHostId = participants.keys().next().value;
                if (newHostId) {
                  session.hostId = newHostId;
                  await valkey.setSession(session.id, session);
                  io.to(newHostId).emit('promoted_to_host');
                }
              }
            }
            
            socket.to(session.id).emit('participant_left', {
              name: displayName,
              participants: Array.from(participants.values()),
            });
            
            // Clean up empty participant maps
            if (participants.size === 0) {
              sessionParticipants.delete(currentSessionId);
            }
          }
        } catch (err) {
          console.error('Error handling disconnect:', err);
        }
      }
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}
