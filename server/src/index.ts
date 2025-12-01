import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { nanoid } from 'nanoid';

dotenv.config();

// Tidal API configuration
const TIDAL_CLIENT_ID = process.env.TIDAL_CLIENT_ID;
const TIDAL_CLIENT_SECRET = process.env.TIDAL_CLIENT_SECRET;
const TIDAL_AUTH_BASE = 'https://login.tidal.com';
const TIDAL_TOKEN_URL = 'https://auth.tidal.com/v1/oauth2/token';
const TIDAL_API_URL = 'https://openapi.tidal.com';
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3001/api/auth/callback';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// OAuth scopes we need
const TIDAL_SCOPES = [
  'user.read',
  'collection.read', 
  'search.read',
  'playlists.read',
  'playlists.write',
  'entitlements.read',
].join(' ');

// User tokens storage (in production, use Redis/DB)
// Now keyed by hostToken (browser-persistent) instead of sessionId
interface UserTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  countryCode: string;
}
const hostTokens = new Map<string, UserTokens>(); // hostToken -> Tidal tokens

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
async function getHostAccessToken(hostToken: string): Promise<{ token: string; countryCode: string } | null> {
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
      return { token: refreshed.access_token, countryCode: tokens.countryCode };
    } catch (err) {
      console.error('Failed to refresh token:', err);
      hostTokens.delete(hostToken);
      return null;
    }
  }
  
  return { token: tokens.accessToken, countryCode: tokens.countryCode };
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
async function searchTidal(accessToken: string, query: string, countryCode: string, limit = 20): Promise<any> {
  const url = `${TIDAL_API_URL}/search?query=${encodeURIComponent(query)}&limit=${limit}&offset=0&countryCode=${countryCode}&include=tracks`;
  
  console.log(`Searching Tidal: "${query}" (country: ${countryCode})`);
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.tidal.v1+json',
      'Accept': 'application/vnd.tidal.v1+json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Tidal search error (${response.status}):`, error.substring(0, 500));
    throw new Error(`Tidal search failed: ${response.status}`);
  }

  return response.json();
}

// Get user's playlists
async function getUserPlaylists(accessToken: string, countryCode: string): Promise<any> {
  const url = `${TIDAL_API_URL}/me/playlists?countryCode=${countryCode}&limit=50`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.tidal.v1+json',
      'Accept': 'application/vnd.tidal.v1+json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Tidal playlists error (${response.status}):`, error.substring(0, 500));
    throw new Error(`Failed to get playlists: ${response.status}`);
  }

  return response.json();
}

// Get playlist tracks
async function getPlaylistTracks(accessToken: string, playlistId: string, countryCode: string): Promise<any> {
  const url = `${TIDAL_API_URL}/playlists/${playlistId}/items?countryCode=${countryCode}&limit=100`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.tidal.v1+json',
      'Accept': 'application/vnd.tidal.v1+json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Tidal playlist tracks error (${response.status}):`, error.substring(0, 500));
    throw new Error(`Failed to get playlist tracks: ${response.status}`);
  }

  return response.json();
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
  queue: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  createdAt: Date;
  participants: Map<string, string>; // odcketId -> displayName
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
    
    // Get user info to determine country code
    const userResponse = await fetch(`${TIDAL_API_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/vnd.tidal.v1+json',
        'Accept': 'application/vnd.tidal.v1+json',
      },
    });

    let countryCode = 'US'; // Default
    if (userResponse.ok) {
      const userData = await userResponse.json();
      countryCode = userData.countryCode || userData.country || 'US';
      console.log(`User country: ${countryCode}`);
    }

    // Store tokens against hostToken (persists across sessions)
    hostTokens.set(pending.hostToken, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      countryCode,
    });

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
  res.json({
    authenticated: !!tokens,
    expiresAt: tokens?.expiresAt,
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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', sessions: sessions.size });
});

app.post('/api/sessions', (req, res) => {
  const { hostName } = req.body;
  const sessionId = generateSessionCode();
  
  const session: Session = {
    id: sessionId,
    hostId: '', // Will be set when host connects via WebSocket
    name: hostName || 'Road Trip', // Use the name directly
    queue: [],
    currentTrackIndex: 0,
    isPlaying: false,
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
    queue: session.queue,
    currentTrackIndex: session.currentTrackIndex,
    isPlaying: session.isPlaying,
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
  const auth = hostToken ? await getHostAccessToken(hostToken) : null;
  
  if (!auth) {
    // Not authenticated - return mock data with auth required flag
    console.log('No auth, returning mock results');
    const mockResults = generateMockSearchResults(query);
    return res.json({ ...mockResults, authRequired: true });
  }

  try {
    const tidalResults = await searchTidal(auth.token, query, auth.countryCode);
    
    // Transform Tidal response to our format
    // The response structure may vary, let's handle both formats
    const trackData = tidalResults.tracks?.items || tidalResults.tracks || tidalResults.data || [];
    
    const tracks = trackData.map((item: any) => {
      const track = item.resource || item;
      return {
        id: track.id?.toString() || nanoid(),
        tidalId: track.id?.toString(),
        title: track.title || 'Unknown',
        artist: track.artists?.map((a: any) => a.name).join(', ') || 
                track.artist?.name || 'Unknown Artist',
        album: track.album?.title || 'Unknown Album',
        duration: track.duration || 0,
        albumArt: track.album?.imageCover?.[0]?.url ||
                  (track.album?.cover ? 
                    `https://resources.tidal.com/images/${track.album.cover.replace(/-/g, '/')}/320x320.jpg` :
                    `https://picsum.photos/seed/${track.id}/300/300`),
      };
    });
    
    console.log(`Tidal search for "${query}" returned ${tracks.length} tracks`);
    return res.json({ tracks, authRequired: false });
    
  } catch (error) {
    console.error('Tidal API error:', error);
    // Return mock data on error
    const mockResults = generateMockSearchResults(query);
    return res.json({ ...mockResults, error: 'Search failed, showing sample results' });
  }
});

// Get user's playlists
app.get('/api/tidal/playlists', async (req, res) => {
  // Get host's token from cookie
  const hostToken = req.cookies.tidepool_host;
  const auth = hostToken ? await getHostAccessToken(hostToken) : null;
  
  if (!auth) {
    console.log('No auth for playlists, returning mock data');
    return res.json({ ...generateMockPlaylists(), authRequired: true });
  }

  try {
    const tidalPlaylists = await getUserPlaylists(auth.token, auth.countryCode);
    
    // Transform response
    const playlistData = tidalPlaylists.items || tidalPlaylists.data || [];
    
    const playlists = playlistData.map((item: any) => {
      const playlist = item.resource || item;
      return {
        id: playlist.uuid || playlist.id,
        name: playlist.title || playlist.name || 'Untitled',
        trackCount: playlist.numberOfTracks || playlist.trackCount || 0,
        duration: playlist.duration || 0,
        imageUrl: playlist.squareImage?.[0]?.url || 
                  playlist.image ||
                  `https://picsum.photos/seed/${playlist.uuid || playlist.id}/300/300`,
        description: playlist.description || '',
      };
    });
    
    console.log(`Got ${playlists.length} playlists`);
    return res.json({ playlists, authRequired: false });
    
  } catch (error) {
    console.error('Tidal playlists error:', error);
    return res.json({ ...generateMockPlaylists(), error: 'Failed to load playlists' });
  }
});

// Get tracks from a specific playlist
app.get('/api/tidal/playlists/:playlistId/tracks', async (req, res) => {
  const { playlistId } = req.params;

  // Get host's token from cookie
  const hostToken = req.cookies.tidepool_host;
  const auth = hostToken ? await getHostAccessToken(hostToken) : null;
  
  if (!auth) {
    return res.json({ ...generateMockPlaylistTracks(playlistId), authRequired: true });
  }

  try {
    const tidalTracks = await getPlaylistTracks(auth.token, playlistId, auth.countryCode);
    
    // Transform response
    const trackData = tidalTracks.items || tidalTracks.data || [];
    
    const tracks = trackData.map((item: any) => {
      const track = item.item?.resource || item.item || item.resource || item;
      return {
        id: track.id?.toString() || nanoid(),
        tidalId: track.id?.toString(),
        title: track.title || 'Unknown',
        artist: track.artists?.map((a: any) => a.name).join(', ') || 
                track.artist?.name || 'Unknown Artist',
        album: track.album?.title || 'Unknown Album',
        duration: track.duration || 0,
        albumArt: track.album?.imageCover?.[0]?.url ||
                  (track.album?.cover ? 
                    `https://resources.tidal.com/images/${track.album.cover.replace(/-/g, '/')}/320x320.jpg` :
                    `https://picsum.photos/seed/${track.id}/300/300`),
      };
    });
    
    console.log(`Got ${tracks.length} tracks from playlist ${playlistId}`);
    return res.json({ tracks, authRequired: false });
    
  } catch (error) {
    console.error('Tidal playlist tracks error:', error);
    return res.json({ ...generateMockPlaylistTracks(playlistId), error: 'Failed to load tracks' });
  }
});

function generateMockPlaylists() {
  return {
    playlists: [
      {
        id: 'pl_roadtrip',
        name: 'Road Trip Bangers 🚗',
        trackCount: 47,
        duration: 10920,
        imageUrl: 'https://picsum.photos/seed/roadtrip/300/300',
        description: 'The ultimate driving playlist',
      },
      {
        id: 'pl_chill',
        name: 'Chill Vibes',
        trackCount: 32,
        duration: 7680,
        imageUrl: 'https://picsum.photos/seed/chill/300/300',
        description: 'Relaxed tunes for easy listening',
      },
      {
        id: 'pl_90s',
        name: '90s Throwbacks',
        trackCount: 55,
        duration: 13200,
        imageUrl: 'https://picsum.photos/seed/90s/300/300',
        description: 'Nostalgia hits from the 90s',
      },
      {
        id: 'pl_workout',
        name: 'Workout Mix 💪',
        trackCount: 28,
        duration: 6720,
        imageUrl: 'https://picsum.photos/seed/workout/300/300',
        description: 'High energy tracks',
      },
      {
        id: 'pl_indie',
        name: 'Indie Discoveries',
        trackCount: 41,
        duration: 9840,
        imageUrl: 'https://picsum.photos/seed/indie/300/300',
        description: 'Fresh indie finds',
      },
    ],
  };
}

function generateMockPlaylistTracks(playlistId: string) {
  const playlistTracks: Record<string, Array<{ title: string; artist: string; album: string; duration: number }>> = {
    pl_roadtrip: [
      { title: 'Life is a Highway', artist: 'Tom Cochrane', album: 'Mad Mad World', duration: 264 },
      { title: 'Born to Run', artist: 'Bruce Springsteen', album: 'Born to Run', duration: 270 },
      { title: 'Take It Easy', artist: 'Eagles', album: 'Eagles', duration: 211 },
      { title: 'Sweet Home Alabama', artist: 'Lynyrd Skynyrd', album: "Second Helping", duration: 284 },
      { title: 'On the Road Again', artist: 'Willie Nelson', album: 'Honeysuckle Rose', duration: 157 },
      { title: 'Radar Love', artist: 'Golden Earring', album: 'Moontan', duration: 378 },
      { title: 'Running Down a Dream', artist: 'Tom Petty', album: 'Full Moon Fever', duration: 278 },
      { title: 'Go Your Own Way', artist: 'Fleetwood Mac', album: 'Rumours', duration: 222 },
    ],
    pl_chill: [
      { title: 'Sunset Lover', artist: 'Petit Biscuit', album: 'Presence', duration: 237 },
      { title: 'Electric Feel', artist: 'MGMT', album: 'Oracular Spectacular', duration: 229 },
      { title: 'Intro', artist: 'The xx', album: 'xx', duration: 128 },
      { title: 'Midnight City', artist: 'M83', album: 'Hurry Up, We\'re Dreaming', duration: 243 },
      { title: 'Breathe', artist: 'Télépopmusik', album: 'Genetic World', duration: 283 },
    ],
    pl_90s: [
      { title: 'Smells Like Teen Spirit', artist: 'Nirvana', album: 'Nevermind', duration: 301 },
      { title: 'Wonderwall', artist: 'Oasis', album: "(What's the Story) Morning Glory?", duration: 258 },
      { title: 'Creep', artist: 'Radiohead', album: 'Pablo Honey', duration: 239 },
      { title: 'Losing My Religion', artist: 'R.E.M.', album: 'Out of Time', duration: 269 },
      { title: 'Black Hole Sun', artist: 'Soundgarden', album: 'Superunknown', duration: 320 },
      { title: 'Under the Bridge', artist: 'Red Hot Chili Peppers', album: 'Blood Sugar Sex Magik', duration: 264 },
    ],
    pl_workout: [
      { title: 'Lose Yourself', artist: 'Eminem', album: '8 Mile', duration: 326 },
      { title: 'Stronger', artist: 'Kanye West', album: 'Graduation', duration: 312 },
      { title: "Can't Hold Us", artist: 'Macklemore & Ryan Lewis', album: 'The Heist', duration: 258 },
      { title: 'Eye of the Tiger', artist: 'Survivor', album: 'Eye of the Tiger', duration: 245 },
      { title: 'Till I Collapse', artist: 'Eminem', album: 'The Eminem Show', duration: 297 },
    ],
    pl_indie: [
      { title: 'Do I Wanna Know?', artist: 'Arctic Monkeys', album: 'AM', duration: 272 },
      { title: 'Take Me Out', artist: 'Franz Ferdinand', album: 'Franz Ferdinand', duration: 237 },
      { title: 'Somebody That I Used to Know', artist: 'Gotye', album: 'Making Mirrors', duration: 244 },
      { title: 'Ho Hey', artist: 'The Lumineers', album: 'The Lumineers', duration: 163 },
      { title: 'Pumped Up Kicks', artist: 'Foster the People', album: 'Torches', duration: 239 },
    ],
  };

  const tracks = playlistTracks[playlistId] || playlistTracks.pl_roadtrip;
  
  return {
    tracks: tracks.map((t, i) => ({
      id: `${playlistId}_${i}`,
      tidalId: `tidal_${playlistId}_${i}`,
      title: t.title,
      artist: t.artist,
      album: t.album,
      duration: t.duration,
      albumArt: `https://picsum.photos/seed/${playlistId}${i}/300/300`,
    })),
  };
}

function generateMockSearchResults(query: string) {
  // Mock search results for development
  // Will be replaced with real Tidal API calls
  const mockTracks = [
    { id: '1', title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', duration: 354 },
    { id: '2', title: 'Hotel California', artist: 'Eagles', album: 'Hotel California', duration: 390 },
    { id: '3', title: 'Stairway to Heaven', artist: 'Led Zeppelin', album: 'Led Zeppelin IV', duration: 482 },
    { id: '4', title: 'Sweet Child O\' Mine', artist: 'Guns N\' Roses', album: 'Appetite for Destruction', duration: 356 },
    { id: '5', title: 'Smells Like Teen Spirit', artist: 'Nirvana', album: 'Nevermind', duration: 301 },
    { id: '6', title: 'Billie Jean', artist: 'Michael Jackson', album: 'Thriller', duration: 294 },
    { id: '7', title: 'Like a Rolling Stone', artist: 'Bob Dylan', album: 'Highway 61 Revisited', duration: 369 },
    { id: '8', title: 'Purple Rain', artist: 'Prince', album: 'Purple Rain', duration: 520 },
  ];

  const filtered = mockTracks.filter(
    (t) =>
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      t.artist.toLowerCase().includes(query.toLowerCase())
  );

  return {
    tracks: filtered.map((t) => ({
      ...t,
      tidalId: `tidal_${t.id}`,
      albumArt: `https://picsum.photos/seed/${t.id}/300/300`,
    })),
  };
}

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
      queue: session.queue,
      currentTrackIndex: session.currentTrackIndex,
      isPlaying: session.isPlaying,
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

  // Add track to queue
  socket.on('add_to_queue', ({ track, position }) => {
    if (!currentSessionId) return;
    
    const session = sessions.get(currentSessionId);
    if (!session) return;
    
    const displayName = session.participants.get(socket.id) || 'Unknown';
    const newTrack: Track = {
      ...track,
      id: nanoid(),
      addedBy: displayName,
    };

    if (position === 'next') {
      // Insert after current track
      const insertIndex = session.currentTrackIndex + 1;
      session.queue.splice(insertIndex, 0, newTrack);
    } else {
      // Add to end
      session.queue.push(newTrack);
    }

    // Broadcast updated queue to all clients in session
    io.to(session.id).emit('queue_updated', {
      queue: session.queue,
      action: position === 'next' ? 'play_next' : 'added',
      track: newTrack,
    });
    
    console.log(`${displayName} added "${track.title}" to queue (${position})`);
  });

  // Remove track from queue
  socket.on('remove_from_queue', ({ trackId }) => {
    if (!currentSessionId) return;
    
    const session = sessions.get(currentSessionId);
    if (!session) return;
    
    const index = session.queue.findIndex((t) => t.id === trackId);
    if (index !== -1) {
      const removed = session.queue.splice(index, 1)[0];
      
      // Adjust currentTrackIndex if needed
      if (index < session.currentTrackIndex) {
        session.currentTrackIndex--;
      }
      
      io.to(session.id).emit('queue_updated', {
        queue: session.queue,
        currentTrackIndex: session.currentTrackIndex,
        action: 'removed',
        track: removed,
      });
    }
  });

  // Host playback controls
  socket.on('playback_control', ({ action, trackIndex }) => {
    if (!currentSessionId || !isHost) return;
    
    const session = sessions.get(currentSessionId);
    if (!session) return;

    switch (action) {
      case 'play':
        session.isPlaying = true;
        break;
      case 'pause':
        session.isPlaying = false;
        break;
      case 'next':
        if (session.currentTrackIndex < session.queue.length - 1) {
          session.currentTrackIndex++;
        }
        break;
      case 'previous':
        if (session.currentTrackIndex > 0) {
          session.currentTrackIndex--;
        }
        break;
      case 'jump':
        if (trackIndex !== undefined && trackIndex >= 0 && trackIndex < session.queue.length) {
          session.currentTrackIndex = trackIndex;
        }
        break;
    }

    io.to(session.id).emit('playback_state', {
      isPlaying: session.isPlaying,
      currentTrackIndex: session.currentTrackIndex,
      currentTrack: session.queue[session.currentTrackIndex] || null,
    });
  });

  // Track ended (auto-advance)
  socket.on('track_ended', () => {
    if (!currentSessionId || !isHost) return;
    
    const session = sessions.get(currentSessionId);
    if (!session) return;

    if (session.currentTrackIndex < session.queue.length - 1) {
      session.currentTrackIndex++;
      
      io.to(session.id).emit('playback_state', {
        isPlaying: true,
        currentTrackIndex: session.currentTrackIndex,
        currentTrack: session.queue[session.currentTrackIndex],
      });
    } else {
      session.isPlaying = false;
      io.to(session.id).emit('playback_state', {
        isPlaying: false,
        currentTrackIndex: session.currentTrackIndex,
        currentTrack: session.queue[session.currentTrackIndex],
      });
    }
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
              p => p.sessionId.toUpperCase() === currentSessionId.toUpperCase()
            );
            
            // Clear hostId so they can rejoin as host
            session.hostId = '';
            
            if (hasPendingAuth) {
              console.log(`Session ${currentSessionId} kept alive (auth pending)`);
            } else {
              // Give a 5-minute grace period before deleting
              console.log(`Session ${currentSessionId} will expire in 5 minutes (host left)`);
              setTimeout(() => {
                const currentSession = sessions.get(currentSessionId!);
                if (currentSession && currentSession.participants.size === 0) {
                  sessions.delete(currentSessionId!);
                  userTokens.delete(currentSessionId!.toUpperCase());
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

