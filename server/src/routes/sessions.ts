// Session management routes
import { Router, Request, Response } from 'express';
import { CLIENT_URL, getHostToken, getTokensForUser } from '../services/tokens.js';
import * as valkey from '../services/valkey.js';

const router = Router();

// Generate a short, easy-to-type session code
function generateSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Random session name generator
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

// Create a new session (requires playlist info)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { resumeCode, tidalPlaylistId, tidalPlaylistUrl, playlistName, hostToken: bodyHostToken } = req.body;
    
    // Playlist info is required
    if (!tidalPlaylistId || !tidalPlaylistUrl) {
      return res.status(400).json({ error: 'Playlist info required to create session' });
    }
    
    // Get host token from header, cookie, or body
    const hostToken = req.headers['x-host-token'] as string || req.cookies?.tidepool_host || bodyHostToken;
    
    // Generate session ID
    let sessionId: string;
    if (resumeCode && typeof resumeCode === 'string') {
      const cleanCode = resumeCode.toUpperCase().trim();
      const existing = await valkey.getSession(cleanCode);
      if (/^[A-Z0-9]{6}$/.test(cleanCode) && !existing) {
        sessionId = cleanCode;
        console.log(`Resuming session with code: ${sessionId}`);
      } else {
        sessionId = generateSessionCode();
        console.log(`Requested code ${cleanCode} unavailable, generated: ${sessionId}`);
      }
    } else {
      sessionId = generateSessionCode();
    }
    
    const sessionName = playlistName?.trim() || generateRandomSessionName();
    
    const session: valkey.StoredSession = {
      id: sessionId,
      hostId: '',
      hostToken: hostToken || undefined,
      name: sessionName,
      tracks: [],
      createdAt: new Date().toISOString(),
      tidalPlaylistId,
      tidalPlaylistUrl,
    };
    
    await valkey.setSession(sessionId, session);
    console.log(`Session ${sessionId} created with playlist ${tidalPlaylistId} (${sessionName})`);
    
    res.json({
      sessionId,
      name: session.name,
      joinUrl: `${CLIENT_URL}/join/${sessionId}`,
    });
  } catch (err) {
    console.error('Failed to create session:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get host's existing sessions
router.get('/mine', async (req: Request, res: Response) => {
  try {
    const hostToken = req.headers['x-host-token'] as string || req.cookies?.tidepool_host;
    
    if (!hostToken) {
      return res.json({ sessions: [] });
    }
    
    // Get userId from current token
    const currentTokenData = await getHostToken(hostToken);
    if (!currentTokenData?.userId) {
      return res.json({ sessions: [] });
    }
    
    // Find ALL hostTokens for this user (cross-device support)
    const userTokens = await getTokensForUser(currentTokenData.userId);
    
    // Get all sessions and filter
    const allSessions = await valkey.getAllSessions();
    const mySessions = allSessions
      .filter(session => 
        session.hostToken && 
        userTokens.includes(session.hostToken) && 
        session.tidalPlaylistId
      )
      .map(session => ({
        id: session.id,
        name: session.name,
        playlistName: session.name,
        playlistId: session.tidalPlaylistId,
        trackCount: session.tracks.length,
        participantCount: 0, // Can't track this in Redis easily
        createdAt: session.createdAt,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    res.json({ sessions: mySessions });
  } catch (err) {
    console.error('Failed to get sessions:', err);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// Get public session list for a host (by username)
router.get('/host/:username', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const usernameLower = username.toLowerCase();
    
    // Get all sessions and find ones matching this username
    const allSessions = await valkey.getAllSessions();
    const matchingSessions: Array<{ session: valkey.StoredSession; username: string }> = [];
    
    for (const session of allSessions) {
      if (session.hostToken && session.tidalPlaylistId) {
        const tokenData = await getHostToken(session.hostToken);
        if (tokenData?.username?.toLowerCase() === usernameLower) {
          matchingSessions.push({ session, username: tokenData.username });
        }
      }
    }
    
    if (matchingSessions.length === 0) {
      return res.status(404).json({ error: 'Host not found' });
    }
    
    const hostSessions = matchingSessions
      .map(({ session }) => ({
        id: session.id,
        name: session.name,
        trackCount: session.tracks.length,
      }))
      .sort((a, b) => {
        const sessionA = allSessions.find(s => s.id === a.id);
        const sessionB = allSessions.find(s => s.id === b.id);
        if (!sessionA || !sessionB) return 0;
        return new Date(sessionB.createdAt).getTime() - new Date(sessionA.createdAt).getTime();
      });
    
    res.json({
      host: {
        username: matchingSessions[0].username,
      },
      sessions: hostSessions,
    });
  } catch (err) {
    console.error('Failed to get host sessions:', err);
    res.status(500).json({ error: 'Failed to get host sessions' });
  }
});

// Get session details
router.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const session = await valkey.getSession(req.params.sessionId.toUpperCase());
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({
      id: session.id,
      name: session.name,
      tracks: session.tracks,
      tidalPlaylistId: session.tidalPlaylistId,
      tidalPlaylistUrl: session.tidalPlaylistUrl,
      participantCount: 0,
    });
  } catch (err) {
    console.error('Failed to get session:', err);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// End/delete a session (host only)
router.delete('/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId.toUpperCase();
    const hostToken = req.headers['x-host-token'] as string || req.cookies?.tidepool_host;
    
    const session = await valkey.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Verify the requester is the host
    if (session.hostToken !== hostToken) {
      // Check if same user via different token
      if (hostToken && session.hostToken) {
        const requesterToken = await getHostToken(hostToken);
        const sessionToken = await getHostToken(session.hostToken);
        if (!requesterToken?.userId || requesterToken.userId !== sessionToken?.userId) {
          return res.status(403).json({ error: 'Only the host can end this session' });
        }
      } else {
        return res.status(403).json({ error: 'Only the host can end this session' });
      }
    }
    
    await valkey.deleteSession(sessionId);
    console.log(`Session ${sessionId} ended by host`);
    
    res.json({ success: true, message: 'Session ended' });
  } catch (err) {
    console.error('Failed to delete session:', err);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

export default router;
