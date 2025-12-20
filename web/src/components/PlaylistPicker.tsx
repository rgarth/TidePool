import { motion } from 'framer-motion';
import { TidalLogo } from './Icons';

interface PlaylistPickerProps {
  existingPlaylistId: string;
  newPlaylistName: string;
  existingPlaylistError: string;
  isLoadingExisting: boolean;
  isCreatingPlaylist: boolean;
  onCancel: () => void;
  onCreateNewPlaylist: () => void;
  onUseExistingPlaylist: () => void;
  onNewPlaylistNameChange: (name: string) => void;
  onExistingPlaylistIdChange: (id: string) => void;
}

export function PlaylistPicker({
  existingPlaylistId,
  newPlaylistName,
  existingPlaylistError,
  isLoadingExisting,
  isCreatingPlaylist,
  onCancel,
  onCreateNewPlaylist,
  onUseExistingPlaylist,
  onNewPlaylistNameChange,
  onExistingPlaylistIdChange,
}: PlaylistPickerProps) {
  return (
    <div className="page page-centered">
      <motion.div
        className="modal"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ position: 'relative' }}
      >
        {/* Tidal icon */}
        <div className="flex justify-center mb-lg">
          <div className="flex items-center justify-center" style={{
            width: 64,
            height: 64,
            borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-teal))',
          }}>
            <TidalLogo size={32} color="var(--bg-primary)" />
          </div>
        </div>
        
        <h2 className="text-center mb-xs">Choose a Playlist</h2>
        <p className="text-secondary text-center mb-xl">
          Create new or continue editing an existing one
        </p>
        
        {/* Create new playlist */}
        <div className="mb-lg">
          <label className="text-secondary text-sm mb-sm" style={{ display: 'block' }}>
            Create new playlist
          </label>
          <div className="flex gap-sm">
            <input
              type="text"
              className="input flex-1"
              placeholder="Name (or leave for random)"
              value={newPlaylistName}
              onChange={(e) => onNewPlaylistNameChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onCreateNewPlaylist()}
            />
            <button
              className="btn btn-primary"
              onClick={onCreateNewPlaylist}
              disabled={isCreatingPlaylist}
            >
              {isCreatingPlaylist ? '...' : 'Create'}
            </button>
          </div>
        </div>
        
        {/* Divider */}
        <div className="flex items-center gap-md mb-lg mt-lg">
          <div className="flex-1" style={{ height: 1, background: 'var(--bg-elevated)' }} />
          <span className="text-muted text-sm">or edit existing</span>
          <div className="flex-1" style={{ height: 1, background: 'var(--bg-elevated)' }} />
        </div>
        
        {/* Use existing playlist */}
        <div>
          <label className="text-secondary text-sm mb-sm" style={{ display: 'block' }}>
            Paste playlist ID or URL from Tidal
          </label>
          <div className="flex gap-sm">
            <input
              type="text"
              className="input flex-1"
              placeholder="e.g., abc123-def456 or tidal.com/playlist/..."
              value={existingPlaylistId}
              onChange={(e) => onExistingPlaylistIdChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onUseExistingPlaylist()}
            />
            <button
              className="btn btn-secondary"
              onClick={onUseExistingPlaylist}
              disabled={isLoadingExisting || !existingPlaylistId.trim()}
            >
              {isLoadingExisting ? '...' : 'Load'}
            </button>
          </div>
          {existingPlaylistError && (
            <p className="text-error text-sm mt-sm">{existingPlaylistError}</p>
          )}
        </div>
        
        {/* Session info */}
        <div className="session-info-box mt-lg">
          <p className="text-muted text-xs">
            You'll get a shareable code once your playlist is set up.
          </p>
        </div>

        {/* Cancel button */}
        <button
          className="btn btn-ghost btn-block mt-lg"
          onClick={onCancel}
        >
          Cancel
        </button>
      </motion.div>
    </div>
  );
}

