import { motion } from 'framer-motion';
import { TrashIcon } from './Icons';
import { Spinner } from './Spinner';
import { formatDuration } from '../utils/format';
import type { Track } from '../types';

interface TrackItemProps {
  track: Track;
  index: number;
  isHost: boolean;
  isDeleting: boolean;
  onDelete: (trackId: string) => void;
}

export function TrackItem({ track, index, isHost, isDeleting, onDelete }: TrackItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="card"
      style={{ padding: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}
    >
      <span className="text-muted" style={{ width: '24px', textAlign: 'center', fontSize: '0.875rem' }}>
        {index + 1}
      </span>
      <img
        src={track.albumArt}
        alt={track.album}
        style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {track.title}
        </div>
        <div className="text-secondary" style={{ fontSize: '0.875rem' }}>
          {track.artist} • {track.addedBy}
        </div>
      </div>
      <span className="text-muted" style={{ fontSize: '0.875rem' }}>
        {formatDuration(track.duration)}
      </span>
      {isHost && (
        <button
          onClick={() => onDelete(track.id)}
          disabled={isDeleting}
          title="Remove from playlist"
          style={{
            background: 'none',
            border: 'none',
            padding: '8px',
            cursor: isDeleting ? 'wait' : 'pointer',
            color: 'var(--text-muted)',
            opacity: isDeleting ? 0.5 : 1,
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#ff6b6b'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          {isDeleting ? <Spinner size={18} /> : <TrashIcon size={18} />}
        </button>
      )}
    </motion.div>
  );
}

