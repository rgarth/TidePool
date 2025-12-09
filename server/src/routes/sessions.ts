// Session management routes
import { Router, Request, Response } from 'express';
import { Session } from '../types/index.js';
import { CLIENT_URL, hostTokens } from '../services/tokens.js';

const router = Router();

// In-memory storage (replace with Redis/DB for production)
export const sessions = new Map<string, Session>();

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

// Create a new session
router.post('/', (req: Request, res: Response) => {
  const { hostName, resumeCode } = req.body;
  
  // Allow resuming with a specific code (hidden feature for server restarts)
  let sessionId: string;
  if (resumeCode && typeof resumeCode === 'string') {
    const cleanCode = resumeCode.toUpperCase().trim();
    // Validate format (6 alphanumeric chars) and check availability
    if (/^[A-Z0-9]{6}$/.test(cleanCode) && !sessions.has(cleanCode)) {
      sessionId = cleanCode;
      console.log(`Resuming session with code: ${sessionId}`);
    } else {
      sessionId = generateSessionCode();
      console.log(`Requested code ${cleanCode} unavailable, generated: ${sessionId}`);
    }
  } else {
    sessionId = generateSessionCode();
  }
  
  const sessionName = hostName?.trim() || generateRandomSessionName();
  
  const session: Session = {
    id: sessionId,
    hostId: '',
    name: sessionName,
    tracks: [],
    createdAt: new Date(),
    participants: new Map(),
  };
  
  sessions.set(sessionId, session);
  
  res.json({
    sessionId,
    name: session.name,
    joinUrl: `${CLIENT_URL}/join/${sessionId}`,
  });
});

// Get host's existing sessions
router.get('/mine', (req: Request, res: Response) => {
  const hostToken = req.headers['x-host-token'] as string || req.cookies?.tidepool_host;
  
  if (!hostToken) {
    return res.json({ sessions: [] });
  }
  
  const mySessions: Array<{
    id: string;
    name: string;
    playlistName?: string;
    playlistId?: string;
    trackCount: number;
    participantCount: number;
    createdAt: Date;
  }> = [];
  
  sessions.forEach((session) => {
    if (session.hostToken === hostToken) {
      mySessions.push({
        id: session.id,
        name: session.name,
        playlistName: session.name,
        playlistId: session.tidalPlaylistId,
        trackCount: session.tracks.length,
        participantCount: session.participants.size,
        createdAt: session.createdAt,
      });
    }
  });
  
  // Sort by most recent first
  mySessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  res.json({ sessions: mySessions });
});

// Get public session list for a host (by username)
router.get('/host/:username', (req: Request, res: Response) => {
  const { username } = req.params;
  const usernameLower = username.toLowerCase();
  
  // Find the hostToken for this username
  let hostToken: string | null = null;
  let hostUsername: string | null = null;
  
  for (const [token, data] of hostTokens.entries()) {
    if (data.username?.toLowerCase() === usernameLower) {
      hostToken = token;
      hostUsername = data.username || null;
      break;
    }
  }
  
  if (!hostToken) {
    return res.status(404).json({ error: 'Host not found' });
  }
  
  // Find all sessions for this host
  const hostSessions: Array<{
    id: string;
    name: string;
    trackCount: number;
  }> = [];
  
  sessions.forEach((session) => {
    if (session.hostToken === hostToken) {
      hostSessions.push({
        id: session.id,
        name: session.name,
        trackCount: session.tracks.length,
      });
    }
  });
  
  // Sort by most recent first
  hostSessions.sort((a, b) => {
    const sessionA = sessions.get(a.id);
    const sessionB = sessions.get(b.id);
    if (!sessionA || !sessionB) return 0;
    return new Date(sessionB.createdAt).getTime() - new Date(sessionA.createdAt).getTime();
  });
  
  res.json({
    host: {
      username: hostUsername,
    },
    sessions: hostSessions,
  });
});

// Get session details
router.get('/:sessionId', (req: Request, res: Response) => {
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

// End/delete a session (host only)
router.delete('/:sessionId', (req: Request, res: Response) => {
  const sessionId = req.params.sessionId.toUpperCase();
  const hostToken = req.headers['x-host-token'] as string || req.cookies?.tidepool_host;
  
  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  // Verify the requester is the host
  if (session.hostToken !== hostToken) {
    return res.status(403).json({ error: 'Only the host can end this session' });
  }
  
  // Delete the session
  sessions.delete(sessionId);
  console.log(`Session ${sessionId} ended by host`);
  
  res.json({ success: true, message: 'Session ended' });
});

export default router;

