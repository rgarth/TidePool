import { motion } from 'framer-motion';
import { MusicIcon } from './Icons';
import { TrackItem } from './TrackItem';
import type { Track } from '../types';

interface SessionExpiredInfo {
  message: string;
  reason: string;
}

interface PlaylistViewProps {
  tracks: Track[];
  isLoading: boolean;
  isHost: boolean;
  deletingTrackId: string | null;
  onDeleteTrack: (trackId: string) => void;
  isUnavailable?: boolean;
  onSelectNewPlaylist?: () => void;
  sessionExpired?: SessionExpiredInfo | null;
}

export function PlaylistView({
  tracks,
  isLoading,
  isHost,
  deletingTrackId,
  onDeleteTrack,
  isUnavailable,
  onSelectNewPlaylist,
  sessionExpired,
}: PlaylistViewProps) {
  // Priority: SessionExpired > Unavailable > Loading > Empty > Tracks
  if (sessionExpired) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon" style={{ color: '#ff6b6b' }}>🔐</div>
        <h3 style={{ color: '#ff6b6b' }} className="mb-sm">Session Expired</h3>
        <p className="text-secondary mb-md">{sessionExpired.message}</p>
        <p className="text-muted text-sm mb-lg" style={{ maxWidth: '400px' }}>
          {sessionExpired.reason}
        </p>
        {isHost ? (
          <a href="/" className="btn btn-primary">
            Start New Session
          </a>
        ) : (
          <p className="text-secondary text-sm">
            Ask the host to create a new session and share the invite link with you.
          </p>
        )}
      </div>
    );
  }

  if (isUnavailable) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon" style={{ color: '#ffb464' }}>⚠️</div>
        <h3 style={{ color: '#ffb464' }} className="mb-sm">Playlist Unavailable</h3>
        <p className="text-muted mb-lg">This playlist is no longer accessible on Tidal</p>
        {isHost && onSelectNewPlaylist && (
          <button className="btn btn-primary" onClick={onSelectNewPlaylist}>
            Select Different Playlist
          </button>
        )}
        {!isHost && (
          <p className="text-secondary text-sm">Ask the host to select a different playlist</p>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="empty-state">
        <motion.div
          className="empty-state-icon"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        >
          <MusicIcon size={48} color="var(--accent-cyan)" />
        </motion.div>
        <h3 className="text-secondary mb-xs">Loading playlist...</h3>
        <p className="text-muted">Fetching tracks from Tidal</p>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <MusicIcon size={48} color="var(--text-muted)" />
        </div>
        <h3 className="text-secondary mb-xs">Playlist is empty</h3>
        <p className="text-muted">Search for songs above to add them</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-sm">
      {tracks.map((track, index) => (
        <TrackItem
          key={track.id}
          track={track}
          index={index}
          isHost={isHost}
          isDeleting={deletingTrackId === track.id}
          onDelete={onDeleteTrack}
        />
      ))}
    </div>
  );
}
