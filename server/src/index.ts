import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { nanoid } from 'nanoid';

dotenv.config();

// Fix for TLS certificate verification issues in development
// This disables SSL cert verification - only use in development!
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// Token persistence file (for development - survives server restarts)
const TOKEN_FILE = path.join(process.cwd(), '.tokens.json');

function loadTokens(): Map<string, any> {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
      console.log(`Loaded ${Object.keys(data).length} tokens from disk`);
      return new Map(Object.entries(data));
    }
  } catch (e) {
    console.error('Failed to load tokens:', e);
  }
  return new Map();
}

function saveTokens(tokens: Map<string, any>) {
  try {
    const data = Object.fromEntries(tokens);
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to save tokens:', e);
  }
}

// Tidal API configuration
const TIDAL_CLIENT_ID = process.env.TIDAL_CLIENT_ID;
const TIDAL_CLIENT_SECRET = process.env.TIDAL_CLIENT_SECRET;
const TIDAL_AUTH_BASE = 'https://login.tidal.com';
const TIDAL_TOKEN_URL = 'https://auth.tidal.com/v1/oauth2/token';
const TIDAL_API_URL = 'https://openapi.tidal.com';
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3001/api/auth/callback';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// OAuth scopes we need (minimal for playlist generator)
const TIDAL_SCOPES = [
  'user.read',        // Get user ID for playlist creation
  'search.read',      // Search for tracks
  'playlists.read',   // List user's playlists
  'playlists.write',  // Create playlists and add tracks
].join(' ');

// User tokens storage (in production, use Redis/DB)
// Now keyed by hostToken (browser-persistent) instead of sessionId
interface UserTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  countryCode: string;
  userId: string; // Store user ID from OAuth
}
// Load tokens from disk on startup (survives server restarts during dev)
const hostTokens = loadTokens() as Map<string, UserTokens>;

// PKCE helpers
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// Temporary storage for OAuth state (in production, use Redis with expiry)
const pendingAuth = new Map<string, { codeVerifier: string; sessionId: string; hostToken: string }>();

// Get user's access token (with auto-refresh)
async function getHostAccessToken(hostToken: string): Promise<{ token: string; countryCode: string; userId: string } | null> {
  const tokens = hostTokens.get(hostToken);
  if (!tokens) return null;
  
  // Refresh if expired (with 5 min buffer)
  if (tokens.expiresAt < Date.now() + 300000) {
    try {
      const refreshed = await refreshAccessToken(tokens.refreshToken);
      hostTokens.set(hostToken, {
        ...tokens,
        accessToken: refreshed.access_token,
        expiresAt: Date.now() + refreshed.expires_in * 1000,
      });
      return { token: refreshed.access_token, countryCode: tokens.countryCode, userId: tokens.userId };
    } catch (err) {
      console.error('Failed to refresh token:', err);
      hostTokens.delete(hostToken);
      return null;
    }
  }
  
  return { token: tokens.accessToken, countryCode: tokens.countryCode, userId: tokens.userId };
}

// Refresh access token
async function refreshAccessToken(refreshToken: string): Promise<any> {
  const credentials = Buffer.from(`${TIDAL_CLIENT_ID}:${TIDAL_CLIENT_SECRET}`).toString('base64');
  
  const response = await fetch(TIDAL_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  return response.json();
}

// Search Tidal catalog using user's token
// Based on official SDK: https://github.com/tidal-music/tidal-sdk-web
async function searchTidal(accessToken: string, query: string, countryCode: string, limit = 20): Promise<any> {
  // Correct URL: searchResults (camelCase R!)
  // First get the search results with track IDs
  const searchUrl = `https://openapi.tidal.com/v2/searchResults/${encodeURIComponent(query)}?countryCode=${countryCode}&include=tracks,artists,albums`;
  
  console.log(`>>> searchTidal() called for "${query}"`);
  console.log(`>>> URL: ${searchUrl}`);
  
  const response = await fetch(searchUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.api+json',
    },
  });

  console.log(`>>> Response status: ${response.status}`);
  
  if (!response.ok) {
    const error = await response.text();
    console.error(`>>> Tidal search error (${response.status}):`, error.substring(0, 1000));
    throw new Error(`Tidal search failed: ${response.status} - ${error.substring(0, 200)}`);
  }

  const searchData = await response.json();
  console.log(`>>> Search response keys:`, Object.keys(searchData));
  
  // The search returns track IDs in relationships, we need to fetch full track data
  // Get track IDs from the relationships
  const trackRefs = searchData.data?.relationships?.tracks?.data || [];
  console.log(`>>> Found ${trackRefs.length} track references`);
  
  if (trackRefs.length === 0) {
    return { tracks: [] };
  }
  
  // Fetch full track details (batch up to 20)
  // Include albums.coverArt to get artwork in the included array
  const trackIds = trackRefs.slice(0, limit).map((t: any) => t.id).join(',');
  const tracksUrl = `https://openapi.tidal.com/v2/tracks?countryCode=${countryCode}&filter[id]=${trackIds}&include=albums.coverArt,artists`;
  
  console.log(`>>> Fetching track details: ${tracksUrl}`);
  
  const tracksResponse = await fetch(tracksUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.api+json',
    },
  });
  
  if (!tracksResponse.ok) {
    console.error(`>>> Failed to fetch track details: ${tracksResponse.status}`);
    // Return what we have from search
    return searchData;
  }
  
  const tracksData = await tracksResponse.json();
  console.log(`>>> Got full track data, keys:`, Object.keys(tracksData));
  console.log(`>>> Track data sample:`, JSON.stringify(tracksData).substring(0, 2000));
  
  return tracksData;
}

// Get user info (needed for user ID) - try api.tidal.com (older API)
async function getUserInfo(accessToken: string): Promise<any> {
  // Try api.tidal.com (v1 API base)
  const url = 'https://api.tidal.com/v1/sessions';
  console.log(`>>> getUserInfo URL: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  console.log(`>>> getUserInfo response status: ${response.status}`);
  
  if (!response.ok) {
    const error = await response.text();
    console.error(`>>> Get user info failed (${response.status}):`, error.substring(0, 500));
    return null;
  }
  
  const data = await response.json();
  console.log(`>>> getUserInfo data:`, JSON.stringify(data).substring(0, 500));
  return data;
}

// NOTE: Listing user playlists is NOT supported by the Tidal Developer Portal API
// The r_usr scope required for /v1/users/{id}/playlists is not available to third-party apps
// We can only create NEW playlists and read playlists by ID

// Create a new playlist
async function createPlaylist(accessToken: string, name: string, description: string = ''): Promise<any> {
  const url = 'https://openapi.tidal.com/v2/playlists';
  
  console.log(`>>> Creating playlist: "${name}"`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'playlists',
        attributes: {
          name,
          description,
          privacy: 'PUBLIC', // Make it public so others can see it
        },
      },
    }),
  });

  console.log(`>>> Create playlist response status: ${response.status}`);
  
  if (!response.ok) {
    const error = await response.text();
    console.error(`>>> Create playlist error (${response.status}):`, error.substring(0, 500));
    throw new Error(`Failed to create playlist: ${response.status} - ${error.substring(0, 200)}`);
  }

  return response.json();
}

// Add tracks to a playlist
async function addTracksToPlaylist(accessToken: string, playlistId: string, trackIds: string[]): Promise<any> {
  const url = `https://openapi.tidal.com/v2/playlists/${playlistId}/relationships/items`;
  
  console.log(`>>> Adding ${trackIds.length} tracks to playlist ${playlistId}`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: trackIds.map(id => ({
        type: 'tracks',
        id,
      })),
    }),
  });

  console.log(`>>> Add tracks response status: ${response.status}`);
  
  if (!response.ok) {
    const error = await response.text();
    console.error(`>>> Add tracks error (${response.status}):`, error.substring(0, 500));
    throw new Error(`Failed to add tracks: ${response.status} - ${error.substring(0, 200)}`);
  }

  // 201 and 204 can both have empty bodies
  const text = await response.text();
  if (!text) {
    return { success: true };
  }
  
  try {
    return JSON.parse(text);
  } catch {
    return { success: true };
  }
}

async function removeTracksFromPlaylist(accessToken: string, playlistId: string, trackIds: string[]): Promise<any> {
  // First, get the playlist items to find the itemId for each track
  const itemsUrl = `https://openapi.tidal.com/v2/playlists/${playlistId}/relationships/items`;
  
  console.log(`>>> Getting playlist items to find track positions for deletion`);
  
  const itemsResponse = await fetch(itemsUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.api+json',
    },
  });
  
  if (!itemsResponse.ok) {
    const error = await itemsResponse.text();
    console.error(`>>> Get items error (${itemsResponse.status}):`, error.substring(0, 500));
    throw new Error(`Failed to get playlist items: ${itemsResponse.status}`);
  }
  
  const itemsData = await itemsResponse.json();
  const items = itemsData.data || [];
  
  // Find the items that match our trackIds and get their meta.itemId
  const itemsToDelete = items
    .filter((item: any) => trackIds.includes(item.id))
    .map((item: any) => ({
      type: 'tracks',
      id: item.id,
      meta: {
        itemId: item.meta?.itemId,
      },
    }));
  
  if (itemsToDelete.length === 0) {
    console.log(`>>> No matching tracks found to delete`);
    return { success: true };
  }
  
  console.log(`>>> Removing ${itemsToDelete.length} tracks from playlist ${playlistId}`);
  console.log(`>>> Items to delete:`, JSON.stringify(itemsToDelete));
  
  const response = await fetch(itemsUrl, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: itemsToDelete,
    }),
  });

  console.log(`>>> Remove tracks response status: ${response.status}`);
  
  if (!response.ok) {
    const error = await response.text();
    console.error(`>>> Remove tracks error (${response.status}):`, error.substring(0, 500));
    throw new Error(`Failed to remove tracks: ${response.status} - ${error.substring(0, 200)}`);
  }

  return { success: true };
}

// Get playlist track IDs
async function getPlaylistTrackIds(accessToken: string, playlistId: string): Promise<string[]> {
  const url = `https://openapi.tidal.com/v2/playlists/${playlistId}/relationships/items`;
  
  console.log(`>>> getPlaylistTrackIds URL: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.api+json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`>>> Playlist items error (${response.status}):`, error.substring(0, 500));
    throw new Error(`Failed to get playlist items: ${response.status}`);
  }

  const data = await response.json();
  return (data.data || []).map((item: any) => item.id);
}

// Fetch full track details for a list of track IDs (with artists and album art)
async function getTrackDetails(accessToken: string, trackIds: string[], countryCode: string): Promise<Track[]> {
  if (trackIds.length === 0) return [];
  
  // Batch up to 50 tracks at a time
  const batchIds = trackIds.slice(0, 50).join(',');
  const url = `https://openapi.tidal.com/v2/tracks?countryCode=${countryCode}&filter[id]=${batchIds}&include=albums.coverArt,artists`;
  
  console.log(`>>> Fetching ${trackIds.length} track details`);
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.api+json',
    },
  });

  if (!response.ok) {
    console.error(`>>> Failed to fetch track details: ${response.status}`);
    return [];
  }

  const data = await response.json();
  return parseTrackData(data, trackIds);
}

// Parse track data from JSON:API response (shared between search and playlist)
function parseTrackData(data: any, orderedIds?: string[]): Track[] {
  const trackData = Array.isArray(data.data) ? data.data : [];
  const included = data.included || [];
  
  // Build maps for quick lookup
  const albumMap = new Map<string, any>();
  const artistMap = new Map<string, any>();
  const artworkMap = new Map<string, any>();
  
  included.forEach((item: any) => {
    if (item.type === 'albums') albumMap.set(item.id, item);
    if (item.type === 'artists') artistMap.set(item.id, item);
    if (item.type === 'artworks') artworkMap.set(item.id, item);
  });
  
  // Parse ISO 8601 duration (PT3M20S) to seconds
  function parseDuration(isoDuration: string): number {
    if (!isoDuration) return 0;
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  }
  
  // Create a map of tracks for ordering
  const trackMap = new Map<string, Track>();
  
  trackData.forEach((track: any) => {
    const attrs = track.attributes || {};
    const relationships = track.relationships || {};
    
    // Get album info
    const albumRef = relationships.albums?.data?.[0];
    const album = albumRef ? albumMap.get(albumRef.id) : null;
    const albumAttrs = album?.attributes || {};
    const albumRelationships = album?.relationships || {};
    
    // Get artist info
    const artistRefs = relationships.artists?.data || [];
    const artistNames = artistRefs.map((ref: any) => {
      const artist = artistMap.get(ref.id);
      return artist?.attributes?.name || 'Unknown';
    }).join(', ') || 'Unknown Artist';
    
    // Get album art from coverArt relationship -> artworks
    let albumArt = '';
    const coverArtRef = albumRelationships.coverArt?.data?.[0];
    if (coverArtRef) {
      const artwork = artworkMap.get(coverArtRef.id);
      if (artwork?.attributes?.files) {
        const files = artwork.attributes.files;
        // Find 320x320 or closest size
        const img = files.find((f: any) => f.meta?.width === 320) ||
                    files.find((f: any) => f.meta?.width >= 160) ||
                    files[0];
        albumArt = img?.href || '';
      }
    }
    
    trackMap.set(track.id, {
      id: track.id?.toString() || nanoid(),
      tidalId: track.id?.toString(),
      title: attrs.title || 'Unknown',
      artist: artistNames,
      album: albumAttrs.title || 'Unknown Album',
      duration: parseDuration(attrs.duration),
      albumArt,
      addedBy: 'Tidal',
    });
  });
  
  // Return in the order of the original IDs if provided
  if (orderedIds) {
    return orderedIds
      .map(id => trackMap.get(id))
      .filter((t): t is Track => t !== undefined);
  }
  
  return Array.from(trackMap.values());
}

// Get full playlist with track details
async function getPlaylistWithFullTracks(accessToken: string, playlistId: string, countryCode: string): Promise<Track[]> {
  // 1. Get track IDs from playlist
  const trackIds = await getPlaylistTrackIds(accessToken, playlistId);
  console.log(`>>> Playlist has ${trackIds.length} tracks`);
  
  if (trackIds.length === 0) return [];
  
  // 2. Fetch full track details
  return getTrackDetails(accessToken, trackIds, countryCode);
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.use(cors({
  origin: CLIENT_URL,
  credentials: true, // Allow cookies
}));
app.use(express.json());
app.use(cookieParser());

// Types
interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  albumArt: string;
  addedBy: string;
  tidalId: string;
}

interface Session {
  id: string;
  hostId: string;
  name: string;
  // Playlist info (created in Tidal)
  tidalPlaylistId?: string;
  tidalPlaylistUrl?: string;
  // Track list (mirrored from playlist for display)
  tracks: Track[];
  createdAt: Date;
  participants: Map<string, string>; // socketId -> displayName
}

// In-memory storage (replace with Redis/DB for production)
const sessions = new Map<string, Session>();

// Generate a short, easy-to-type session code
function generateSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (0,O,1,I)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============================================
// OAuth2 Authentication Routes
// ============================================

// Start OAuth login flow
app.get('/api/auth/login', (req, res) => {
  const { sessionId } = req.query;
  
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Session ID required' });
  }
  
  if (!TIDAL_CLIENT_ID) {
    return res.status(500).json({ error: 'Tidal client not configured' });
  }
  
  // Get or create hostToken from cookie
  let hostToken = req.cookies.tidepool_host;
  if (!hostToken) {
    hostToken = nanoid(32);
  }
  
  // Generate PKCE codes
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = nanoid(16);
  
  // Store for callback (including hostToken)
  pendingAuth.set(state, { codeVerifier, sessionId, hostToken });
  
  // Build authorization URL
  const authUrl = new URL(`${TIDAL_AUTH_BASE}/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', TIDAL_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', TIDAL_SCOPES);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  
  console.log(`Starting OAuth flow for session ${sessionId} (host: ${hostToken.substring(0, 8)}...)`);
  res.redirect(authUrl.toString());
});

// OAuth callback handler
app.get('/api/auth/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  
  if (error) {
    console.error('OAuth error:', error, error_description);
    return res.redirect(`${CLIENT_URL}?auth_error=${encodeURIComponent(String(error_description || error))}`);
  }
  
  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    return res.redirect(`${CLIENT_URL}?auth_error=missing_params`);
  }
  
  const pending = pendingAuth.get(state);
  if (!pending) {
    return res.redirect(`${CLIENT_URL}?auth_error=invalid_state`);
  }
  
  pendingAuth.delete(state);
  
  try {
    // Exchange code for tokens
    const credentials = Buffer.from(`${TIDAL_CLIENT_ID}:${TIDAL_CLIENT_SECRET}`).toString('base64');
    
    const tokenResponse = await fetch(TIDAL_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: pending.codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return res.redirect(`${CLIENT_URL}?auth_error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();
    console.log('Got tokens, fetching user info...');
    
    // Get user info to determine country code AND user ID
    // Try multiple endpoints since Tidal API is inconsistent
    let countryCode = 'US';
    let userId = '';
    
    // Try v2 API first
    const userUrls = [
      'https://openapi.tidal.com/v2/users/me',
      'https://openapi.tidal.com/users/me',
      'https://api.tidal.com/v1/users/me',
    ];
    
    for (const url of userUrls) {
      console.log(`>>> Trying user info URL: ${url}`);
      const userResponse = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/vnd.api+json',
          'Accept': 'application/vnd.api+json',
        },
      });
      
      console.log(`>>> Response status: ${userResponse.status}`);
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        console.log(`>>> User data:`, JSON.stringify(userData).substring(0, 500));
        // Handle both v1 and v2 response formats
        const data = userData.data || userData;
        const attrs = data.attributes || data;
        countryCode = attrs.countryCode || attrs.country || data.countryCode || 'US';
        userId = data.id?.toString() || attrs.userId?.toString() || data.userId?.toString() || '';
        console.log(`User country: ${countryCode}, userId: ${userId}`);
        break;
      } else {
        const errorText = await userResponse.text();
        console.log(`>>> Failed (${userResponse.status}):`, errorText.substring(0, 200));
      }
    }
    
    if (!userId) {
      console.error('Could not get user ID from any endpoint');
    }

    // Store tokens against hostToken (persists across sessions)
    hostTokens.set(pending.hostToken, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      countryCode,
      userId,
    });
    
    // Save to disk (survives server restarts during dev)
    saveTokens(hostTokens);

    console.log(`Authenticated host ${pending.hostToken.substring(0, 8)}... for session ${pending.sessionId}`);
    
    // Set persistent cookie (30 days)
    res.cookie('tidepool_host', pending.hostToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
    
    // Redirect back to app
    res.redirect(`${CLIENT_URL}/session/${pending.sessionId}?auth=success`);
    
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect(`${CLIENT_URL}?auth_error=unknown`);
  }
});

// Check auth status (uses cookie, not session)
app.get('/api/auth/status', (req, res) => {
  const hostToken = req.cookies.tidepool_host;
  const tokens = hostToken ? hostTokens.get(hostToken) : null;
  
  console.log('>>> Auth status check:');
  console.log('>>>   Cookie present:', !!hostToken);
  console.log('>>>   Cookie value:', hostToken ? hostToken.substring(0, 8) + '...' : 'none');
  console.log('>>>   Tokens in map:', hostTokens.size);
  console.log('>>>   Token found:', !!tokens);
  
  res.json({
    authenticated: !!tokens,
    expiresAt: tokens?.expiresAt,
    debug: {
      cookiePresent: !!hostToken,
      tokensInMemory: hostTokens.size,
    }
  });
});

// Keep old endpoint for backwards compatibility during transition
app.get('/api/auth/status/:sessionId', (req, res) => {
  const hostToken = req.cookies.tidepool_host;
  const tokens = hostToken ? hostTokens.get(hostToken) : null;
  res.json({
    authenticated: !!tokens,
    expiresAt: tokens?.expiresAt,
  });
});

// Get credentials for Tidal Player SDK
app.get('/api/auth/credentials', async (req, res) => {
  const hostToken = req.cookies.tidepool_host;
  
  if (!hostToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const auth = await getHostAccessToken(hostToken);
  
  if (!auth) {
    return res.status(401).json({ error: 'Session expired' });
  }
  
  const tokens = hostTokens.get(hostToken);
  
  res.json({
    clientId: TIDAL_CLIENT_ID,
    accessToken: auth.token,
    expiresAt: tokens?.expiresAt,
    countryCode: auth.countryCode,
  });
});

// Logout (revoke tokens)
app.post('/api/auth/logout', (req, res) => {
  const hostToken = req.cookies.tidepool_host;
  if (hostToken) {
    hostTokens.delete(hostToken);
  }
  res.clearCookie('tidepool_host');
  res.json({ success: true });
});

// ============================================
// REST API Routes
// ============================================

// Fun random session name generator
const SESSION_ADJECTIVES = [
  'Midnight', 'Summer', 'Chill', 'Epic', 'Groovy', 'Smooth', 'Cosmic', 
  'Electric', 'Golden', 'Sunset', 'Highway', 'Road Trip', 'Late Night',
  'Weekend', 'Sunday', 'Throwback', 'Fresh', 'Vibe', 'Good Times', 'Cruising'
];

const SESSION_NOUNS = [
  'Bangers', 'Jams', 'Beats', 'Vibes', 'Tunes', 'Tracks', 'Hits', 
  'Grooves', 'Sounds', 'Mix', 'Playlist', 'Session', 'Party', 'Drive',
  'Journey', 'Waves', 'Flow', 'Mood', 'Energy', 'Magic'
];

function generateRandomSessionName(): string {
  const adj = SESSION_ADJECTIVES[Math.floor(Math.random() * SESSION_ADJECTIVES.length)];
  const noun = SESSION_NOUNS[Math.floor(Math.random() * SESSION_NOUNS.length)];
  return `${adj} ${noun}`;
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', sessions: sessions.size });
});

app.post('/api/sessions', (req, res) => {
  const { hostName } = req.body;
  const sessionId = generateSessionCode();
  
  // Use provided name or generate a fun random one
  const sessionName = hostName?.trim() || generateRandomSessionName();
  
  const session: Session = {
    id: sessionId,
    hostId: '', // Will be set when host connects via WebSocket
    name: sessionName,
    tracks: [],
    createdAt: new Date(),
    participants: new Map(),
  };
  
  sessions.set(sessionId, session);
  
  res.json({
    sessionId,
    name: session.name,
    joinUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/join/${sessionId}`,
  });
});

app.get('/api/sessions/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId.toUpperCase());
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({
    id: session.id,
    name: session.name,
    tracks: session.tracks,
    tidalPlaylistId: session.tidalPlaylistId,
    tidalPlaylistUrl: session.tidalPlaylistUrl,
    participantCount: session.participants.size,
  });
});

// ============================================
// Tidal API Proxy Routes (uses host's auth)
// ============================================

// Search Tidal catalog
app.get('/api/tidal/search', async (req, res) => {
  const { query } = req.query;
  
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query parameter required' });
  }

  // Get host's token from cookie
  const hostToken = req.cookies.tidepool_host;
  console.log(`Search request - hostToken: ${hostToken ? hostToken.substring(0, 8) + '...' : 'none'}`);
  
  const auth = hostToken ? await getHostAccessToken(hostToken) : null;
  
  if (!auth) {
    // Not authenticated - return error, not mock data
    console.log('>>> NO AUTH - hostToken:', hostToken ? 'exists' : 'missing');
    console.log('>>> hostTokens map size:', hostTokens.size);
    return res.status(401).json({ error: 'Not authenticated. Please login with Tidal.', authRequired: true });
  }
  
  console.log(`Authenticated search for "${query}" (country: ${auth.countryCode})`);

  try {
    console.log('>>> Calling Tidal API...');
    const tidalResults = await searchTidal(auth.token, query, auth.countryCode);
    console.log('>>> Tidal API response:', JSON.stringify(tidalResults).substring(0, 1500));
    
    // JSON:API format: tracks in 'data' array, related albums/artists in 'included'
    const trackData = Array.isArray(tidalResults.data) ? tidalResults.data : [];
    const included = tidalResults.included || [];
    
    console.log(`>>> Found ${trackData.length} tracks in 'data'`);
    console.log(`>>> Found ${included.length} items in 'included'`);
    
    // Build maps for quick lookup
    const albumMap = new Map<string, any>();
    const artistMap = new Map<string, any>();
    const artworkMap = new Map<string, any>(); // artworks type = album covers
    
    included.forEach((item: any) => {
      if (item.type === 'albums') albumMap.set(item.id, item);
      if (item.type === 'artists') artistMap.set(item.id, item);
      if (item.type === 'artworks') artworkMap.set(item.id, item);
    });
    
    console.log(`>>> Maps: ${albumMap.size} albums, ${artistMap.size} artists, ${artworkMap.size} artworks`);
    
    // Parse ISO 8601 duration (PT3M20S) to seconds
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
      
      // Get album info
      const albumRef = relationships.albums?.data?.[0];
      const album = albumRef ? albumMap.get(albumRef.id) : null;
      const albumAttrs = album?.attributes || {};
      const albumRelationships = album?.relationships || {};
      
      // Get artist info
      const artistRefs = relationships.artists?.data || [];
      const artistNames = artistRefs.map((ref: any) => {
        const artist = artistMap.get(ref.id);
        return artist?.attributes?.name || 'Unknown';
      }).join(', ') || 'Unknown Artist';
      
      // Get album art from coverArt relationship -> artworks
      let albumArt = '';
      const coverArtRef = albumRelationships.coverArt?.data?.[0];
      if (coverArtRef) {
        const artwork = artworkMap.get(coverArtRef.id);
        if (artwork?.attributes?.files) {
          const files = artwork.attributes.files;
          // Find 320x320 or closest size
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
    
    console.log(`>>> Returning ${tracks.length} tracks to client`);
    return res.json({ tracks, authRequired: false });
    
  } catch (error: any) {
    console.error('>>> Tidal API FAILED:', error.message);
    console.error('>>> Full error:', error);
    // Return actual error, not mock data
    return res.status(500).json({ error: `Tidal API failed: ${error.message}` });
  }
});


// Get user's playlists - NOT SUPPORTED
// The Tidal Developer Portal API doesn't expose endpoints to list user playlists
// We can only CREATE new playlists and READ playlists by ID
app.get('/api/tidal/playlists', async (req, res) => {
  // This feature is not available with the current Tidal API scopes
  return res.status(501).json({ 
    error: 'Listing existing playlists is not supported by the Tidal API',
    message: 'You can only create new playlists. The Tidal Developer Portal API does not provide access to list user playlists.',
    authRequired: false,
  });
});

// Create a new playlist
app.post('/api/tidal/playlists', async (req, res) => {
  const { name, description } = req.body;
  
  const hostToken = req.cookies.tidepool_host;
  const auth = hostToken ? await getHostAccessToken(hostToken) : null;
  
  if (!auth) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (!name) {
    return res.status(400).json({ error: 'Playlist name is required' });
  }
  
  try {
    const result = await createPlaylist(auth.token, name, description || '');
    
    // Extract playlist info from response
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

// Add tracks to a playlist - then fetch real data from Tidal and broadcast to all clients
app.post('/api/tidal/playlists/:playlistId/tracks', async (req, res) => {
  const { playlistId } = req.params;
  const { trackIds, sessionId } = req.body; // Array of Tidal track IDs + session to broadcast to
  
  const hostToken = req.cookies.tidepool_host;
  const auth = hostToken ? await getHostAccessToken(hostToken) : null;
  
  if (!auth) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (!trackIds || !Array.isArray(trackIds) || trackIds.length === 0) {
    return res.status(400).json({ error: 'trackIds array is required' });
  }
  
  try {
    // 1. Add to Tidal
    await addTracksToPlaylist(auth.token, playlistId, trackIds);
    console.log(`Added ${trackIds.length} tracks to playlist ${playlistId}`);
    
    // 2. Fetch the REAL playlist from Tidal (source of truth)
    const tracks = await getPlaylistWithFullTracks(auth.token, playlistId, auth.countryCode);
    
    // 3. If sessionId provided, broadcast to all clients in that session
    if (sessionId) {
      const session = sessions.get(sessionId.toUpperCase());
      if (session) {
        session.tracks = tracks; // Update server-side state
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
app.delete('/api/tidal/playlists/:playlistId/tracks', async (req, res) => {
  const { playlistId } = req.params;
  const { trackIds, sessionId } = req.body;
  
  const hostToken = req.cookies.tidepool_host;
  const auth = hostToken ? await getHostAccessToken(hostToken) : null;
  
  if (!auth) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (!trackIds || !Array.isArray(trackIds) || trackIds.length === 0) {
    return res.status(400).json({ error: 'trackIds array is required' });
  }
  
  try {
    // 1. Remove from Tidal
    await removeTracksFromPlaylist(auth.token, playlistId, trackIds);
    console.log(`Removed ${trackIds.length} tracks from playlist ${playlistId}`);
    
    // 2. Fetch the REAL playlist from Tidal (source of truth)
    const tracks = await getPlaylistWithFullTracks(auth.token, playlistId, auth.countryCode);
    
    // 3. If sessionId provided, broadcast to all clients in that session
    if (sessionId) {
      const session = sessions.get(sessionId.toUpperCase());
      if (session) {
        session.tracks = tracks;
        io.to(session.id).emit('playlist_synced', { tracks });
        console.log(`Broadcasted ${tracks.length} tracks to session ${sessionId}`);
      }
    }
    
    res.json({ success: true, removed: trackIds.length, tracks });
  } catch (error: any) {
    console.error('>>> Remove tracks error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get tracks from a specific playlist
app.get('/api/tidal/playlists/:playlistId/tracks', async (req, res) => {
  const { playlistId } = req.params;

  // Get host's token from cookie
  const hostToken = req.cookies.tidepool_host;
  const auth = hostToken ? await getHostAccessToken(hostToken) : null;
  
  if (!auth) {
    console.log('>>> NO AUTH for playlist tracks');
    return res.status(401).json({ error: 'Not authenticated', authRequired: true });
  }

  try {
    const tracks = await getPlaylistWithFullTracks(auth.token, playlistId, auth.countryCode);
    
    console.log(`Got ${tracks.length} tracks from playlist ${playlistId}`);
    return res.json({ tracks, authRequired: false });
    
  } catch (error: any) {
    console.error('>>> Tidal playlist tracks FAILED:', error);
    return res.status(500).json({ error: `Failed to load tracks: ${error.message}` });
  }
});

// Refresh playlist from Tidal and broadcast to all session clients
app.get('/api/tidal/playlists/:playlistId/refresh', async (req, res) => {
  const { playlistId } = req.params;
  const { sessionId } = req.query;

  const hostToken = req.cookies.tidepool_host;
  const auth = hostToken ? await getHostAccessToken(hostToken) : null;
  
  if (!auth) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Fetch from Tidal (source of truth)
    const tracks = await getPlaylistWithFullTracks(auth.token, playlistId, auth.countryCode);
    
    // Broadcast to all clients in session
    if (sessionId && typeof sessionId === 'string') {
      const session = sessions.get(sessionId.toUpperCase());
      if (session) {
        session.tracks = tracks;
        io.to(session.id).emit('playlist_synced', { tracks });
        console.log(`Refreshed & broadcasted ${tracks.length} tracks to session ${sessionId}`);
      }
    }
    
    return res.json({ success: true, tracks });
  } catch (error: any) {
    console.error('>>> Refresh playlist FAILED:', error);
    return res.status(500).json({ error: error.message });
  }
});


// WebSocket handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  let currentSessionId: string | null = null;
  let isHost = false;

  // Join a session
  socket.on('join_session', ({ sessionId, displayName, asHost }) => {
    const session = sessions.get(sessionId.toUpperCase());
    
    if (!session) {
      socket.emit('error', { message: 'Session not found' });
      return;
    }

    currentSessionId = session.id;
    socket.join(session.id);
    
    if (asHost && !session.hostId) {
      session.hostId = socket.id;
      isHost = true;
    }
    
    session.participants.set(socket.id, displayName);
    
    // Send current state to the joining client
    socket.emit('session_state', {
      id: session.id,
      name: session.name,
      tracks: session.tracks,
      tidalPlaylistId: session.tidalPlaylistId,
      tidalPlaylistUrl: session.tidalPlaylistUrl,
      isHost,
      participants: Array.from(session.participants.values()),
    });
    
    // Notify others
    socket.to(session.id).emit('participant_joined', {
      name: displayName,
      participants: Array.from(session.participants.values()),
    });
    
    console.log(`${displayName} joined session ${session.id} as ${isHost ? 'host' : 'guest'}`);
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

    // Add to local track list
    session.tracks.push(newTrack);

    // Broadcast updated playlist to all clients in session
    io.to(session.id).emit('playlist_updated', {
      tracks: session.tracks,
      action: 'added',
      track: newTrack,
      addedBy: displayName,
    });
    
    console.log(`${displayName} added "${track.title}" to playlist`);
  });

  // Set playlist ID for session (called by host after creating playlist in Tidal)
  socket.on('set_playlist', ({ tidalPlaylistId, tidalPlaylistUrl }) => {
    if (!currentSessionId || !isHost) return;
    
    const session = sessions.get(currentSessionId);
    if (!session) return;

    session.tidalPlaylistId = tidalPlaylistId;
    session.tidalPlaylistUrl = tidalPlaylistUrl;

    // Notify all clients
    io.to(session.id).emit('playlist_linked', {
      tidalPlaylistId,
      tidalPlaylistUrl,
    });
    
    console.log(`Playlist ${tidalPlaylistId} linked to session ${currentSessionId}`);
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (currentSessionId) {
      const session = sessions.get(currentSessionId);
      if (session) {
        const displayName = session.participants.get(socket.id);
        session.participants.delete(socket.id);
        
        if (isHost) {
          // Host disconnected - check if auth is pending or give grace period
          if (session.participants.size === 0) {
            // Check if there's pending auth for this session
            const hasPendingAuth = Array.from(pendingAuth.values()).some(
              p => p.sessionId.toUpperCase() === currentSessionId!.toUpperCase()
            );
            
            // Clear hostId so they can rejoin as host
            session.hostId = '';
            
            if (hasPendingAuth) {
              console.log(`Session ${currentSessionId} kept alive (auth pending)`);
            } else {
              // Give a 5-minute grace period before deleting session
              console.log(`Session ${currentSessionId} will expire in 5 minutes (host left)`);
              setTimeout(() => {
                const currentSession = sessions.get(currentSessionId!);
                if (currentSession && currentSession.participants.size === 0) {
                  sessions.delete(currentSessionId!);
                  console.log(`Session ${currentSessionId} expired`);
                }
              }, 5 * 60 * 1000); // 5 minutes
            }
          } else {
            // Transfer host to first participant
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

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`
🌊 TidePool Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Server running on http://localhost:${PORT}
WebSocket ready for connections
  `);
});

