export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  albumArt: string;
  addedBy: string;
  tidalId: string;
  tidalItemId?: string; // Playlist-specific ID for deletion
}

export interface SessionState {
  id: string;
  name: string;
  tracks: Track[];
  tidalPlaylistId?: string;
  tidalPlaylistUrl?: string;
  isPublic?: boolean;
  isHost: boolean;
  participants: string[];
}

export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  albumArt: string;
  tidalId: string;
}

export interface Playlist {
  id: string;
  name: string;
  trackCount: number;
  duration: number;
  imageUrl: string;
  description: string;
}
