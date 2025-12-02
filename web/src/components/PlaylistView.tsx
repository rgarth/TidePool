import { motion } from 'framer-motion';
import { MusicIcon } from './Icons';
import { TrackItem } from './TrackItem';
import type { Track } from '../types';

interface PlaylistViewProps {
  tracks: Track[];
  isLoading: boolean;
  isHost: boolean;
  deletingTrackId: string | null;
  onDeleteTrack: (trackId: string) => void;
  /** Playlist was deleted from Tidal */
  isDeleted?: boolean;
  /** Callback when host wants to choose a new playlist */
  onSelectNewPlaylist?: () => void;
}

export function PlaylistView({
  tracks,
  isLoading,
  isHost,
  deletingTrackId,
  onDeleteTrack,
  isDeleted,
  onSelectNewPlaylist,
}: PlaylistViewProps) {
  // Priority: Deleted > Loading > Empty > Tracks
  if (isDeleted) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
        <div style={{
          width: '80px', height: '80px', margin: '0 auto var(--space-lg)',
          borderRadius: '50%', background: 'rgba(255, 100, 100, 0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid rgba(255, 100, 100, 0.3)',
        }}>
          <span style={{ fontSize: '2rem' }}>🗑️</span>
        </div>
        <h3 style={{ color: '#ff6b6b', marginBottom: 'var(--space-sm)' }}>
          Playlist Deleted
        </h3>
        <p className="text-muted" style={{ marginBottom: 'var(--space-lg)' }}>
          This playlist has been deleted from Tidal
        </p>
        {isHost && onSelectNewPlaylist && (
          <button 
            onClick={onSelectNewPlaylist}
            className="btn btn-primary"
          >
            Select New Playlist
          </button>
        )}
        {!isHost && (
          <p className="text-secondary" style={{ fontSize: '0.875rem' }}>
            Ask the host to select a new playlist
          </p>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          style={{
            width: '80px', height: '80px', margin: '0 auto var(--space-lg)',
            borderRadius: '50%', background: 'var(--bg-elevated)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <MusicIcon size={40} style={{ color: 'var(--accent-cyan)' }} />
        </motion.div>
        <h3 className="text-secondary" style={{ marginBottom: 'var(--space-sm)' }}>
          Loading playlist...
        </h3>
        <p className="text-muted">Fetching tracks from Tidal</p>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
        <div style={{
          width: '80px', height: '80px', margin: '0 auto var(--space-lg)',
          borderRadius: '50%', background: 'var(--bg-elevated)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MusicIcon size={40} style={{ color: 'var(--text-muted)' }} />
        </div>
        <h3 className="text-secondary" style={{ marginBottom: 'var(--space-sm)' }}>
          Playlist is empty
        </h3>
        <p className="text-muted">Search for songs above to add them</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
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

