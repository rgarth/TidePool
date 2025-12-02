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
      className="track-item"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <span className="track-number">{index + 1}</span>
      
      <img
        className="track-art"
        src={track.albumArt}
        alt={track.album}
      />
      
      <div className="track-info">
        <div className="track-title truncate">{track.title}</div>
        <div className="track-artist">{track.artist} • {track.addedBy}</div>
      </div>
      
      <span className="track-duration">{formatDuration(track.duration)}</span>
      
      {isHost && (
        <button
          className="btn btn-danger btn-icon"
          onClick={() => onDelete(track.id)}
          disabled={isDeleting}
          title="Remove from playlist"
        >
          {isDeleting ? <Spinner size={18} /> : <TrashIcon size={18} />}
        </button>
      )}
    </motion.div>
  );
}
