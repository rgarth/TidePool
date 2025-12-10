// Tidal API proxy routes
import { Router, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { Server } from 'socket.io';
import { getHostAccessToken, hostTokens, getHostTokenFromRequest, TokenExpiredError } from '../services/tokens.js';
import {
  searchTidal,
  createPlaylist,
  addTracksToPlaylist,
  removeTracksFromPlaylist,
  getPlaylistWithFullTracks,
  getPlaylistInfo,
  parseTrackData,
  updatePlaylistDescription,
  updatePlaylist,
  buildContributorDescription,
} from '../services/tidal.js';
import { sessions } from './sessions.js';
import { sanitizeSessionName, sanitizeDescription } from '../utils/sanitize.js';

const router = Router();

// Will be set by index.ts
let io: Server;

export function setSocketIO(socketIO: Server) {
  io = socketIO;
}

// Helper to emit session_expired to all clients when OAuth expires
function emitSessionExpired(hostToken: string) {
  // Find any sessions using this hostToken
  for (const [sessionId, session] of sessions.entries()) {
    if (session.hostToken === hostToken) {
      console.log(`OAuth expired for session ${sessionId}, notifying all clients`);
      io.to(session.id).emit('session_expired', {
        message: 'This session has expired because the Tidal authorization is no longer valid.',
        reason: 'OAuth tokens are time-limited (typically 30-90 days). The host needs to log in again and create a new invite link.',
      });
    }
  }
}

// Search Tidal catalog
router.get('/search', async (req: Request, res: Response) => {
  const { query, sessionId } = req.query;
  
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query parameter required' });
  }

  // Try to get host's token from request (header or cookie)
  let hostToken = getHostTokenFromRequest(req);
  
  // If no token but sessionId provided, use session's hostToken (for guests)
  if (!hostToken && sessionId && typeof sessionId === 'string') {
    const session = sessions.get(sessionId.toUpperCase());
    if (session?.hostToken) {
      hostToken = session.hostToken;
      console.log(`Guest search using session ${sessionId} hostToken`);
    }
  }
  
  let auth;
  try {
    auth = hostToken ? await getHostAccessToken(hostToken) : null;
  } catch (err) {
    if (err instanceof TokenExpiredError && hostToken) {
      emitSessionExpired(hostToken);
      return res.status(401).json({ 
        error: 'Session expired. The host needs to log in again.',
        sessionExpired: true,
      });
    }
    throw err;
  }
  
  if (!auth) {
    return res.status(401).json({ error: 'Not authenticated. Please login with Tidal.', authRequired: true });
  }
  
  console.log(`Authenticated search for "${query}" (country: ${auth.countryCode})`);

  try {
    const tidalResults = await searchTidal(auth.token, query, auth.countryCode);
    
    // Parse tracks using shared helper
    const trackData = Array.isArray(tidalResults.data) ? tidalResults.data : [];
    const included = tidalResults.included || [];
    
    // Build maps for quick lookup
    const albumMap = new Map<string, any>();
    const artistMap = new Map<string, any>();
    const artworkMap = new Map<string, any>();
    
    included.forEach((item: any) => {
      if (item.type === 'albums') albumMap.set(item.id, item);
      if (item.type === 'artists') artistMap.set(item.id, item);
      if (item.type === 'artworks') artworkMap.set(item.id, item);
    });
    
    // Parse duration
    function parseDuration(isoDuration: string): number {
      if (!isoDuration) return 0;
      const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!match) return 0;
      const hours = parseInt(match[1] || '0', 10);
      const minutes = parseInt(match[2] || '0', 10);
      const seconds = parseInt(match[3] || '0', 10);
      return hours * 3600 + minutes * 60 + seconds;
    }
    
    const tracks = trackData.map((track: any) => {
      const attrs = track.attributes || {};
      const relationships = track.relationships || {};
      
      const albumRef = relationships.albums?.data?.[0];
      const album = albumRef ? albumMap.get(albumRef.id) : null;
      const albumAttrs = album?.attributes || {};
      const albumRelationships = album?.relationships || {};
      
      const artistRefs = relationships.artists?.data || [];
      const artistNames = artistRefs.map((ref: any) => {
        const artist = artistMap.get(ref.id);
        return artist?.attributes?.name || 'Unknown';
      }).join(', ') || 'Unknown Artist';
      
      let albumArt = '';
      const coverArtRef = albumRelationships.coverArt?.data?.[0];
      if (coverArtRef) {
        const artwork = artworkMap.get(coverArtRef.id);
        if (artwork?.attributes?.files) {
          const files = artwork.attributes.files;
          const img = files.find((f: any) => f.meta?.width === 320) ||
                      files.find((f: any) => f.meta?.width >= 160) ||
                      files[0];
          albumArt = img?.href || '';
        }
      }
      
      return {
        id: track.id?.toString() || nanoid(),
        tidalId: track.id?.toString(),
        title: attrs.title || 'Unknown',
        artist: artistNames,
        album: albumAttrs.title || 'Unknown Album',
        duration: parseDuration(attrs.duration),
        albumArt,
      };
    });
    
    return res.json({ tracks, authRequired: false });
    
  } catch (error: any) {
    console.error('>>> Tidal API FAILED:', error.message);
    return res.status(500).json({ error: `Tidal API failed: ${error.message}` });
  }
});

// Get user's playlists - NOT SUPPORTED
router.get('/playlists', async (req: Request, res: Response) => {
  return res.status(501).json({ 
    error: 'Listing existing playlists is not supported by the Tidal API',
    message: 'You can only create new playlists.',
    authRequired: false,
  });
});

// Create a new playlist
router.post('/playlists', async (req: Request, res: Response) => {
  const name = sanitizeSessionName(req.body.name, 'New Playlist');
  const description = sanitizeDescription(req.body.description);
  
  const hostToken = getHostTokenFromRequest(req);
  
  let auth;
  try {
    auth = hostToken ? await getHostAccessToken(hostToken) : null;
  } catch (err) {
    if (err instanceof TokenExpiredError && hostToken) {
      emitSessionExpired(hostToken);
      return res.status(401).json({ error: 'Session expired', sessionExpired: true });
    }
    throw err;
  }
  
  if (!auth) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (!name) {
    return res.status(400).json({ error: 'Playlist name is required' });
  }
  
  try {
    const result = await createPlaylist(auth.token, name, description || '');
    const playlist = result.data || result;
    const playlistId = playlist.id || playlist.uuid;
    const privacy = playlist.attributes?.privacy || 'PUBLIC';
    
    console.log(`Created playlist: ${playlistId} (${privacy})`);
    
    res.json({
      id: playlistId,
      name: playlist.attributes?.name || name,
      tidalUrl: `https://tidal.com/playlist/${playlistId}`,
      listenUrl: `https://listen.tidal.com/playlist/${playlistId}`,
      isPublic: privacy === 'PUBLIC',
    });
  } catch (error: any) {
    console.error('>>> Create playlist error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Update playlist name and/or description
router.patch('/playlists/:playlistId', async (req: Request, res: Response) => {
  const { playlistId } = req.params;
  const name = req.body.name ? sanitizeSessionName(req.body.name) : undefined;
  const userDescription = sanitizeDescription(req.body.userDescription);
  const { sessionId } = req.body;
  
  const hostToken = getHostTokenFromRequest(req);
  
  let auth;
  try {
    auth = hostToken ? await getHostAccessToken(hostToken) : null;
  } catch (err) {
    if (err instanceof TokenExpiredError && hostToken) {
      emitSessionExpired(hostToken);
      return res.status(401).json({ error: 'Session expired', sessionExpired: true });
    }
    throw err;
  }
  
  if (!auth) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    // Build full description with user's text + contributor credits
    let fullDescription: string | undefined;
    
    if (sessionId) {
      const session = sessions.get(sessionId.toUpperCase());
      if (session) {
        const participants = Array.from(session.participants.values());
        fullDescription = buildContributorDescription(participants, session.hostName, userDescription);
        
        // Store user description in session for future updates
        session.userDescription = userDescription || '';
      }
    }
    
    // Update the playlist
    const success = await updatePlaylist(auth.token, playlistId, {
      name,
      description: fullDescription,
    });
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to update playlist' });
    }
    
    // Broadcast name change to all session participants
    if (sessionId && io && name) {
      const session = sessions.get(sessionId.toUpperCase());
      if (session) {
        session.name = name;
        io.to(session.id).emit('playlist_renamed', { name });
      }
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('>>> Update playlist error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Add tracks to a playlist
router.post('/playlists/:playlistId/tracks', async (req: Request, res: Response) => {
  const { playlistId } = req.params;
  const { trackIds, sessionId } = req.body;
  
  let hostToken = getHostTokenFromRequest(req);
  if (!hostToken && sessionId) {
    const session = sessions.get(sessionId.toUpperCase());
    if (session?.hostToken) {
      hostToken = session.hostToken;
    }
  }
  
  let auth;
  try {
    auth = hostToken ? await getHostAccessToken(hostToken) : null;
  } catch (err) {
    if (err instanceof TokenExpiredError && hostToken) {
      emitSessionExpired(hostToken);
      return res.status(401).json({ error: 'Session expired', sessionExpired: true });
    }
    throw err;
  }
  
  if (!auth) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (!trackIds || !Array.isArray(trackIds) || trackIds.length === 0) {
    return res.status(400).json({ error: 'trackIds array is required' });
  }
  
  try {
    await addTracksToPlaylist(auth.token, playlistId, trackIds);
    console.log(`Added ${trackIds.length} tracks to playlist ${playlistId}`);
    
    const tracks = await getPlaylistWithFullTracks(auth.token, playlistId, auth.countryCode);
    
    if (sessionId && io) {
      const session = sessions.get(sessionId.toUpperCase());
      if (session) {
        session.tracks = tracks;
        io.to(session.id).emit('playlist_synced', { tracks });
        console.log(`Broadcasted ${tracks.length} tracks to session ${sessionId}`);
        
        // Update playlist description with contributors (non-blocking)
        const participants = Array.from(session.participants.values());
        if (participants.length > 0) {
          const description = buildContributorDescription(participants, session.hostName, session.userDescription);
          updatePlaylistDescription(auth.token, playlistId, description)
            .then(success => {
              if (success) console.log(`Updated playlist description: ${description}`);
            })
            .catch(() => {}); // Ignore errors, this is optional
        }
      }
    }
    
    res.json({ success: true, added: trackIds.length, tracks });
  } catch (error: any) {
    console.error('>>> Add tracks error:', error.message);
    if (error.message === 'PLAYLIST_NOT_FOUND') {
      // Notify all clients in session that playlist is gone
      if (sessionId && io) {
        const session = sessions.get(sessionId.toUpperCase());
        if (session) {
          io.to(session.id).emit('playlist_unavailable', { 
            playlistId,
            message: 'This playlist is no longer accessible on Tidal',
          });
        }
      }
      return res.status(404).json({ error: 'Playlist not found or no longer accessible.', unavailable: true });
    }
    res.status(500).json({ error: error.message });
  }
});

// Remove tracks from a playlist
router.delete('/playlists/:playlistId/tracks', async (req: Request, res: Response) => {
  const { playlistId } = req.params;
  const { trackIds, sessionId } = req.body;
  
  const hostToken = getHostTokenFromRequest(req);
  
  let auth;
  try {
    auth = hostToken ? await getHostAccessToken(hostToken) : null;
  } catch (err) {
    if (err instanceof TokenExpiredError && hostToken) {
      emitSessionExpired(hostToken);
      return res.status(401).json({ error: 'Session expired', sessionExpired: true });
    }
    throw err;
  }
  
  if (!auth) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (!trackIds || !Array.isArray(trackIds) || trackIds.length === 0) {
    return res.status(400).json({ error: 'trackIds array is required' });
  }
  
  try {
    await removeTracksFromPlaylist(auth.token, playlistId, trackIds);
    console.log(`Removed ${trackIds.length} tracks from playlist ${playlistId}`);
    
    const tracks = await getPlaylistWithFullTracks(auth.token, playlistId, auth.countryCode);
    
    if (sessionId && io) {
      const session = sessions.get(sessionId.toUpperCase());
      if (session) {
        session.tracks = tracks;
        io.to(session.id).emit('playlist_synced', { tracks });
      }
    }
    
    res.json({ success: true, removed: trackIds.length, tracks });
  } catch (error: any) {
    console.error('>>> Remove tracks error:', error.message);
    if (error.message === 'PLAYLIST_NOT_FOUND') {
      // Notify all clients in session that playlist is gone
      if (sessionId && io) {
        const session = sessions.get(sessionId.toUpperCase());
        if (session) {
          io.to(session.id).emit('playlist_unavailable', { 
            playlistId,
            message: 'This playlist is no longer accessible on Tidal',
          });
        }
      }
      return res.status(404).json({ error: 'Playlist not found or no longer accessible.', unavailable: true });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get tracks from a specific playlist
router.get('/playlists/:playlistId/tracks', async (req: Request, res: Response) => {
  const { playlistId } = req.params;

  const hostToken = getHostTokenFromRequest(req);
  
  let auth;
  try {
    auth = hostToken ? await getHostAccessToken(hostToken) : null;
  } catch (err) {
    if (err instanceof TokenExpiredError && hostToken) {
      emitSessionExpired(hostToken);
      return res.status(401).json({ error: 'Session expired', sessionExpired: true });
    }
    throw err;
  }
  
  if (!auth) {
    return res.status(401).json({ error: 'Not authenticated', authRequired: true });
  }

  try {
    const [playlistInfo, tracks] = await Promise.all([
      getPlaylistInfo(auth.token, playlistId),
      getPlaylistWithFullTracks(auth.token, playlistId, auth.countryCode),
    ]);
    
    const isPublic = playlistInfo?.privacy === 'PUBLIC';
    console.log(`Got ${tracks.length} tracks from playlist ${playlistId} (${playlistInfo?.name}, ${isPublic ? 'PUBLIC' : 'PRIVATE'})`);
    return res.json({ 
      tracks, 
      playlistName: playlistInfo?.name,
      isPublic,
      authRequired: false,
    });
    
  } catch (error: any) {
    console.error('>>> Tidal playlist tracks FAILED:', error);
    // Handle playlist not found (deleted on Tidal)
    if (error.message === 'PLAYLIST_NOT_FOUND') {
      return res.status(404).json({ error: 'Playlist not found or no longer accessible.' });
    }
    return res.status(500).json({ error: `Failed to load tracks: ${error.message}` });
  }
});

// Refresh playlist from Tidal
router.get('/playlists/:playlistId/refresh', async (req: Request, res: Response) => {
  const { playlistId } = req.params;
  const { sessionId } = req.query;

  // Try to get host's token from request (header or cookie)
  let hostToken = getHostTokenFromRequest(req);
  
  // If no token but sessionId provided, use session's hostToken (for guests)
  if (!hostToken && sessionId && typeof sessionId === 'string') {
    const session = sessions.get(sessionId.toUpperCase());
    if (session?.hostToken) {
      hostToken = session.hostToken;
    }
  }
  
  let auth;
  try {
    auth = hostToken ? await getHostAccessToken(hostToken) : null;
  } catch (err) {
    if (err instanceof TokenExpiredError && hostToken) {
      emitSessionExpired(hostToken);
      return res.status(401).json({ error: 'Session expired', sessionExpired: true });
    }
    throw err;
  }
  
  if (!auth) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Fetch both playlist info and tracks
    const [playlistInfo, tracks] = await Promise.all([
      getPlaylistInfo(auth.token, playlistId),
      getPlaylistWithFullTracks(auth.token, playlistId, auth.countryCode),
    ]);
    
    const isPublic = playlistInfo?.privacy === 'PUBLIC';
    
    if (sessionId && typeof sessionId === 'string' && io) {
      const session = sessions.get(sessionId.toUpperCase());
      if (session) {
        session.tracks = tracks;
        session.isPublic = isPublic;
        // Update session name from Tidal
        if (playlistInfo?.name) {
          session.name = playlistInfo.name;
        }
        // Broadcast tracks, name, and privacy
        io.to(session.id).emit('playlist_synced', { 
          tracks, 
          playlistName: playlistInfo?.name,
          isPublic,
        });
        console.log(`Refreshed & broadcasted ${tracks.length} tracks to session ${sessionId} (${playlistInfo?.name}, ${isPublic ? 'PUBLIC' : 'PRIVATE'})`);
      }
    }
    
    return res.json({ success: true, tracks, playlistName: playlistInfo?.name, isPublic });
  } catch (error: any) {
    console.error('>>> Refresh playlist FAILED:', error);
    // Handle deleted playlist
    if (error.message === 'PLAYLIST_NOT_FOUND') {
      // Notify session that playlist was deleted
      if (sessionId && typeof sessionId === 'string' && io) {
        const session = sessions.get(sessionId.toUpperCase());
        if (session) {
          io.to(session.id).emit('playlist_unavailable', { 
            playlistId,
            message: 'This playlist is no longer accessible on Tidal',
          });
        }
      }
      return res.status(404).json({ 
        error: 'Playlist not found or no longer accessible.',
        deleted: true,
      });
    }
    return res.status(500).json({ error: error.message });
  }
});

export default router;

