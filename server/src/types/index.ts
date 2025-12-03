// Types for TidePool Server

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  albumArt: string;
  addedBy: string;
  tidalId: string;
}

export interface Session {
  id: string;
  hostId: string;
  hostToken?: string; // Reference to host's auth token (so guests can use it)
  hostName?: string;  // Tidal username of the host
  name: string;
  // Playlist info (created in Tidal)
  tidalPlaylistId?: string;
  tidalPlaylistUrl?: string;
  isPublic?: boolean; // Whether playlist is public on Tidal (allows Open in Tidal for guests)
  // Track list (mirrored from playlist for display)
  tracks: Track[];
  createdAt: Date;
  participants: Map<string, string>; // socketId -> displayName
}

export interface UserTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  countryCode: string;
  userId: string;
  username?: string;
}

export interface PendingAuth {
  codeVerifier: string;
  sessionId: string;
  hostToken: string;
}

