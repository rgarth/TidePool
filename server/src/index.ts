import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { nanoid } from 'nanoid';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

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

// REST API Routes
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

// Tidal API proxy (to avoid CORS issues and protect credentials)
app.get('/api/tidal/search', async (req, res) => {
  const { query } = req.query;
  
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query parameter required' });
  }

  // For now, return mock data
  // TODO: Integrate with real Tidal API
  const mockResults = generateMockSearchResults(query);
  res.json(mockResults);
});

// Get user's playlists (mock for now)
app.get('/api/tidal/playlists', async (req, res) => {
  // TODO: Use host's OAuth token to fetch real playlists
  const mockPlaylists = generateMockPlaylists();
  res.json(mockPlaylists);
});

// Get tracks from a specific playlist
app.get('/api/tidal/playlists/:playlistId/tracks', async (req, res) => {
  const { playlistId } = req.params;
  // TODO: Use host's OAuth token to fetch real playlist tracks
  const mockTracks = generateMockPlaylistTracks(playlistId);
  res.json(mockTracks);
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
          // Host disconnected - end session or transfer host
          if (session.participants.size === 0) {
            sessions.delete(currentSessionId);
            console.log(`Session ${currentSessionId} ended (host left, no participants)`);
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

