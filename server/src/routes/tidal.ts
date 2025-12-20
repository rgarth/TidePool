// Tidal API proxy routes
import { Router, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { Server } from 'socket.io';
import { getHostAccessToken, getHostTokenFromRequest, TokenExpiredError } from '../services/tokens.js';
import * as valkey from '../services/valkey.js';
import {
  searchTidal,
  createPlaylist,
  addTracksToPlaylist,
  removeTracksFromPlaylist,
  getPlaylistWithFullTracks,
  getPlaylistInfo,
  updatePlaylistDescription,
  updatePlaylist,
  buildContributorDescription,
} from '../services/tidal.js';
import { sanitizeSessionName, sanitizeDescription } from '../utils/sanitize.js';

const router = Router();

// Will be set by index.ts
let io: Server;

export function setSocketIO(socketIO: Server) {
  io = socketIO;
}

// Helper to emit session_expired to all clients when OAuth expires
async function emitSessionExpired(hostToken: string) {
  const allSessions = await valkey.getAllSessions();
  for (const session of allSessions) {
    if (session.hostToken === hostToken) {
      console.log(`OAuth expired for session ${session.id}, notifying all clients`);
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

  let hostToken = getHostTokenFromRequest(req);
  
  // If no token but sessionId provided, use session's hostToken (for guests)
  if (!hostToken && sessionId && typeof sessionId === 'string') {
    const session = await valkey.getSession(sessionId.toUpperCase());
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
      await emitSessionExpired(hostToken);
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
    
    const trackData = Array.isArray(tidalResults.data) ? tidalResults.data : [];
    const included = tidalResults.included || [];
    
    const albumMap = new Map<string, any>();
    const artistMap = new Map<string, any>();
    const artworkMap = new Map<string, any>();
    
    included.forEach((item: any) => {
      if (item.type === 'albums') albumMap.set(item.id, item);
      if (item.type === 'artists') artistMap.set(item.id, item);
      if (item.type === 'artworks') artworkMap.set(item.id, item);
    });
    
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
      await emitSessionExpired(hostToken);
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
      await emitSessionExpired(hostToken);
      return res.status(401).json({ error: 'Session expired', sessionExpired: true });
    }
    throw err;
  }
  
  if (!auth) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    let fullDescription: string | undefined;
    
    if (sessionId) {
      const session = await valkey.getSession(sessionId.toUpperCase());
      if (session) {
        // Note: participants are in-memory, we don't have them here
        // Just use the user description
        fullDescription = userDescription || '';
        session.userDescription = userDescription || '';
        await valkey.setSession(session.id, session);
      }
    }
    
    const success = await updatePlaylist(auth.token, playlistId, {
      name,
      description: fullDescription,
    });
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to update playlist' });
    }
    
    if (sessionId && io && name) {
      const session = await valkey.getSession(sessionId.toUpperCase());
      if (session) {
        session.name = name;
        await valkey.setSession(session.id, session);
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
    const session = await valkey.getSession(sessionId.toUpperCase());
    if (session?.hostToken) {
      hostToken = session.hostToken;
    }
  }
  
  let auth;
  try {
    auth = hostToken ? await getHostAccessToken(hostToken) : null;
  } catch (err) {
    if (err instanceof TokenExpiredError && hostToken) {
      await emitSessionExpired(hostToken);
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
      const session = await valkey.getSession(sessionId.toUpperCase());
      if (session) {
        session.tracks = tracks;
        await valkey.setSession(session.id, session);
        io.to(session.id).emit('playlist_synced', { tracks });
        console.log(`Broadcasted ${tracks.length} tracks to session ${sessionId}`);
        
        // Update playlist description (non-blocking, without participants since they're in-memory)
        if (session.userDescription) {
          updatePlaylistDescription(auth.token, playlistId, session.userDescription)
            .catch(() => {});
        }
      }
    }
    
    res.json({ success: true, added: trackIds.length, tracks });
  } catch (error: any) {
    console.error('>>> Add tracks error:', error.message);
    if (error.message === 'PLAYLIST_NOT_FOUND') {
      if (sessionId && io) {
        const session = await valkey.getSession(sessionId.toUpperCase());
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
  const { trackIds, itemIds, sessionId } = req.body;
  
  console.log(`>>> DELETE /playlists/${playlistId}/tracks`, { trackIds, itemIds, sessionId });
  
  // Get hostToken from request OR fall back to session's hostToken (for guests)
  let hostToken = getHostTokenFromRequest(req);
  console.log(`>>> hostToken from request: ${hostToken ? 'yes' : 'no'}`);
  
  if (!hostToken && sessionId) {
    const session = await valkey.getSession(sessionId.toUpperCase());
    if (session?.hostToken) {
      hostToken = session.hostToken;
      console.log(`>>> hostToken from session: yes`);
    } else {
      console.log(`>>> hostToken from session: no (session: ${session ? 'found' : 'not found'})`);
    }
  }
  
  let auth;
  try {
    auth = hostToken ? await getHostAccessToken(hostToken) : null;
  } catch (err) {
    if (err instanceof TokenExpiredError && hostToken) {
      await emitSessionExpired(hostToken);
      return res.status(401).json({ error: 'Session expired', sessionExpired: true });
    }
    throw err;
  }
  
  if (!auth) {
    console.log(`>>> DELETE failed: Not authenticated`);
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (!trackIds || !Array.isArray(trackIds) || trackIds.length === 0) {
    console.log(`>>> DELETE failed: No trackIds`);
    return res.status(400).json({ error: 'trackIds array is required' });
  }
  
  console.log(`>>> Calling removeTracksFromPlaylist with trackIds:`, trackIds, 'itemIds:', itemIds);
  
  try {
    // Pass itemIds if provided (fast path), otherwise will fetch all items (slow path)
    const result = await removeTracksFromPlaylist(auth.token, playlistId, trackIds, itemIds);
    console.log(`>>> removeTracksFromPlaylist result:`, result);
    
    const tracks = await getPlaylistWithFullTracks(auth.token, playlistId, auth.countryCode);
    
    if (sessionId && io) {
      const session = await valkey.getSession(sessionId.toUpperCase());
      if (session) {
        session.tracks = tracks;
        await valkey.setSession(session.id, session);
        io.to(session.id).emit('playlist_synced', { tracks });
      }
    }
    
    res.json({ success: true, removed: trackIds.length, tracks });
  } catch (error: any) {
    console.error('>>> Remove tracks error:', error.message);
    if (error.message === 'PLAYLIST_NOT_FOUND') {
      if (sessionId && io) {
        const session = await valkey.getSession(sessionId.toUpperCase());
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
      await emitSessionExpired(hostToken);
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

  let hostToken = getHostTokenFromRequest(req);
  
  if (!hostToken && sessionId && typeof sessionId === 'string') {
    const session = await valkey.getSession(sessionId.toUpperCase());
    if (session?.hostToken) {
      hostToken = session.hostToken;
    }
  }
  
  let auth;
  try {
    auth = hostToken ? await getHostAccessToken(hostToken) : null;
  } catch (err) {
    if (err instanceof TokenExpiredError && hostToken) {
      await emitSessionExpired(hostToken);
      return res.status(401).json({ error: 'Session expired', sessionExpired: true });
    }
    throw err;
  }
  
  if (!auth) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const [playlistInfo, tracks] = await Promise.all([
      getPlaylistInfo(auth.token, playlistId),
      getPlaylistWithFullTracks(auth.token, playlistId, auth.countryCode),
    ]);
    
    const isPublic = playlistInfo?.privacy === 'PUBLIC';
    
    if (sessionId && typeof sessionId === 'string' && io) {
      const session = await valkey.getSession(sessionId.toUpperCase());
      if (session) {
        session.tracks = tracks;
        session.isPublic = isPublic;
        if (playlistInfo?.name) {
          session.name = playlistInfo.name;
        }
        await valkey.setSession(session.id, session);
        
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
    if (error.message === 'PLAYLIST_NOT_FOUND') {
      if (sessionId && typeof sessionId === 'string' && io) {
        const session = await valkey.getSession(sessionId.toUpperCase());
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
