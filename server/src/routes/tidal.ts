// Tidal API proxy routes
import { Router, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { Server } from 'socket.io';
import { getHostAccessToken, hostTokens, getHostTokenFromRequest } from '../services/tokens.js';
import {
  searchTidal,
  createPlaylist,
  addTracksToPlaylist,
  removeTracksFromPlaylist,
  getPlaylistWithFullTracks,
  getPlaylistInfo,
  parseTrackData,
} from '../services/tidal.js';
import { sessions } from './sessions.js';

const router = Router();

// Will be set by index.ts
let io: Server;

export function setSocketIO(socketIO: Server) {
  io = socketIO;
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
  
  const auth = hostToken ? await getHostAccessToken(hostToken) : null;
  
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
  const { name, description } = req.body;
  
  const hostToken = getHostTokenFromRequest(req);
  const auth = hostToken ? await getHostAccessToken(hostToken) : null;
  
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
    
    console.log(`Created playlist: ${playlistId}`);
    
    res.json({
      id: playlistId,
      name: playlist.attributes?.name || name,
      tidalUrl: `https://tidal.com/playlist/${playlistId}`,
      listenUrl: `https://listen.tidal.com/playlist/${playlistId}`,
    });
  } catch (error: any) {
    console.error('>>> Create playlist error:', error.message);
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
  
  const auth = hostToken ? await getHostAccessToken(hostToken) : null;
  
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
      }
    }
    
    res.json({ success: true, added: trackIds.length, tracks });
  } catch (error: any) {
    console.error('>>> Add tracks error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Remove tracks from a playlist
router.delete('/playlists/:playlistId/tracks', async (req: Request, res: Response) => {
  const { playlistId } = req.params;
  const { trackIds, sessionId } = req.body;
  
  const hostToken = getHostTokenFromRequest(req);
  const auth = hostToken ? await getHostAccessToken(hostToken) : null;
  
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
    res.status(500).json({ error: error.message });
  }
});

// Get tracks from a specific playlist
router.get('/playlists/:playlistId/tracks', async (req: Request, res: Response) => {
  const { playlistId } = req.params;

  const hostToken = getHostTokenFromRequest(req);
  const auth = hostToken ? await getHostAccessToken(hostToken) : null;
  
  if (!auth) {
    return res.status(401).json({ error: 'Not authenticated', authRequired: true });
  }

  try {
    const [playlistInfo, tracks] = await Promise.all([
      getPlaylistInfo(auth.token, playlistId),
      getPlaylistWithFullTracks(auth.token, playlistId, auth.countryCode),
    ]);
    
    console.log(`Got ${tracks.length} tracks from playlist ${playlistId} (${playlistInfo?.name})`);
    return res.json({ 
      tracks, 
      playlistName: playlistInfo?.name,
      authRequired: false,
    });
    
  } catch (error: any) {
    console.error('>>> Tidal playlist tracks FAILED:', error);
    // Handle playlist not found (deleted on Tidal)
    if (error.message === 'PLAYLIST_NOT_FOUND') {
      return res.status(404).json({ error: 'Playlist not found. It may have been deleted from Tidal.' });
    }
    return res.status(500).json({ error: `Failed to load tracks: ${error.message}` });
  }
});

// Refresh playlist from Tidal
router.get('/playlists/:playlistId/refresh', async (req: Request, res: Response) => {
  const { playlistId } = req.params;
  const { sessionId } = req.query;

  const hostToken = getHostTokenFromRequest(req);
  const auth = hostToken ? await getHostAccessToken(hostToken) : null;
  
  if (!auth) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Fetch both playlist info and tracks
    const [playlistInfo, tracks] = await Promise.all([
      getPlaylistInfo(auth.token, playlistId),
      getPlaylistWithFullTracks(auth.token, playlistId, auth.countryCode),
    ]);
    
    if (sessionId && typeof sessionId === 'string' && io) {
      const session = sessions.get(sessionId.toUpperCase());
      if (session) {
        session.tracks = tracks;
        // Update session name from Tidal
        if (playlistInfo?.name) {
          session.name = playlistInfo.name;
        }
        // Broadcast tracks and name
        io.to(session.id).emit('playlist_synced', { 
          tracks, 
          playlistName: playlistInfo?.name,
        });
        console.log(`Refreshed & broadcasted ${tracks.length} tracks to session ${sessionId} (${playlistInfo?.name})`);
      }
    }
    
    return res.json({ success: true, tracks, playlistName: playlistInfo?.name });
  } catch (error: any) {
    console.error('>>> Refresh playlist FAILED:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;

