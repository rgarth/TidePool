import { motion } from 'framer-motion';
import { CloseIcon, TidalLogo, ReloadIcon } from './Icons';

interface PlaylistPickerProps {
  sessionId?: string;
  lastPlaylistId: string | null;
  lastPlaylistName: string | null;
  existingPlaylistId: string;
  newPlaylistName: string;
  existingPlaylistError: string;
  isLoadingExisting: boolean;
  isCreatingPlaylist: boolean;
  hasLinkedPlaylist: boolean;
  onClose: () => void;
  onCreateNewPlaylist: () => void;
  onUseExistingPlaylist: (playlistId?: string) => void;
  onNewPlaylistNameChange: (name: string) => void;
  onExistingPlaylistIdChange: (id: string) => void;
}

export function PlaylistPicker({
  sessionId,
  lastPlaylistId,
  lastPlaylistName,
  existingPlaylistId,
  newPlaylistName,
  existingPlaylistError,
  isLoadingExisting,
  isCreatingPlaylist,
  hasLinkedPlaylist,
  onClose,
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
        {/* Close button - only show if there's already a playlist */}
        {hasLinkedPlaylist && (
          <button
            className="modal-close"
            onClick={onClose}
            title="Cancel"
            style={{ position: 'absolute', top: 16, right: 16 }}
          >
            <CloseIcon size={20} />
          </button>
        )}
        
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
        
        {/* Resume last playlist */}
        {lastPlaylistId && (
          <div className="mb-lg">
            <button
              className="btn btn-secondary btn-block"
              onClick={() => onUseExistingPlaylist(lastPlaylistId)}
              disabled={isLoadingExisting}
              style={{ overflow: 'hidden' }}
            >
              {isLoadingExisting ? (
                'Loading...'
              ) : (
                <>
                  <ReloadIcon size={18} style={{ flexShrink: 0 }} />
                  <span className="truncate">
                    {lastPlaylistName ? `Resume: ${lastPlaylistName}` : 'Resume Last Playlist'}
                  </span>
                </>
              )}
            </button>
          </div>
        )}
        
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
              onClick={() => onUseExistingPlaylist()}
              disabled={isLoadingExisting || !existingPlaylistId.trim()}
            >
              {isLoadingExisting ? '...' : 'Load'}
            </button>
          </div>
          {existingPlaylistError && (
            <p className="text-error text-sm mt-sm">{existingPlaylistError}</p>
          )}
        </div>
        
        {/* Session code hint */}
        <p className="text-muted text-sm text-center mt-xl">
          Session code: <code className="text-accent">{sessionId}</code>
        </p>
        
        {/* Session duration info */}
        <div className="session-info-box mt-lg">
          <p className="text-muted text-xs">
            This session uses your Tidal login and will remain active while your authorization is valid (typically 30-90 days). 
            If it expires, just log in again and share a new invite link.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

