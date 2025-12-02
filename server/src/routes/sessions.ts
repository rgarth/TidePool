// Session management routes
import { Router, Request, Response } from 'express';
import { Session } from '../types/index.js';
import { CLIENT_URL } from '../services/tokens.js';

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
  const { hostName } = req.body;
  const sessionId = generateSessionCode();
  
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

export default router;

