import { motion } from 'framer-motion';
import { CloseIcon, TidalLogo, ReloadIcon } from './Icons';

interface PlaylistPickerProps {
  sessionId?: string;
  lastPlaylistId: string | null;
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
      <div className="container" style={{ maxWidth: '500px' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="card" style={{ padding: 'var(--space-xl)', position: 'relative' }}>
            {/* Close button - only show if there's already a playlist */}
            {hasLinkedPlaylist && (
              <button
                onClick={onClose}
                style={{
                  position: 'absolute',
                  top: 'var(--space-md)',
                  right: 'var(--space-md)',
                  background: 'none',
                  border: 'none',
                  padding: '8px',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
                title="Cancel"
              >
                <CloseIcon size={20} />
              </button>
            )}
            
            {/* Playlist icon */}
            <div
              style={{
                width: '64px',
                height: '64px',
                margin: '0 auto var(--space-lg)',
                borderRadius: '16px',
                background: 'var(--gradient-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TidalLogo size={32} style={{ color: 'var(--bg-primary)' }} />
            </div>
            
            <h2 style={{ marginBottom: 'var(--space-sm)', textAlign: 'center' }}>
              Choose a Playlist
            </h2>
            <p className="text-secondary" style={{ marginBottom: 'var(--space-xl)', textAlign: 'center' }}>
              Create new or continue editing an existing one
            </p>
            
            {/* Resume last playlist */}
            {lastPlaylistId && (
              <div style={{ marginBottom: 'var(--space-lg)' }}>
                <button
                  onClick={() => onUseExistingPlaylist(lastPlaylistId)}
                  disabled={isLoadingExisting}
                  className="btn btn-secondary"
                  style={{ 
                    width: '100%', 
                    padding: 'var(--space-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'var(--space-sm)',
                  }}
                >
                  {isLoadingExisting ? (
                    <>Loading...</>
                  ) : (
                    <>
                      <ReloadIcon size={18} />
                      Resume Last Playlist
                    </>
                  )}
                </button>
                <p className="text-muted" style={{ fontSize: '0.75rem', textAlign: 'center', marginTop: 'var(--space-xs)' }}>
                  ID: {lastPlaylistId.substring(0, 8)}...
                </p>
                {existingPlaylistError && (
                  <p style={{ color: '#ff6b6b', fontSize: '0.8rem', marginTop: 'var(--space-sm)', textAlign: 'center' }}>
                    {existingPlaylistError}
                  </p>
                )}
              </div>
            )}
            
            {/* Create new playlist */}
            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <label className="text-secondary" style={{ display: 'block', marginBottom: 'var(--space-sm)', fontSize: '0.875rem' }}>
                Create new playlist
              </label>
              <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                <input
                  type="text"
                  className="input"
                  placeholder="Name (or leave for random)"
                  value={newPlaylistName}
                  onChange={(e) => onNewPlaylistNameChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onCreateNewPlaylist()}
                  style={{ flex: 1 }}
                />
                <button
                  onClick={onCreateNewPlaylist}
                  disabled={isCreatingPlaylist}
                  className="btn btn-primary"
                >
                  {isCreatingPlaylist ? '...' : 'Create'}
                </button>
              </div>
            </div>
            
            {/* Divider */}
            <div style={{ position: 'relative', textAlign: 'center', margin: 'var(--space-lg) 0' }}>
              <div style={{ 
                position: 'absolute', 
                left: 0, 
                right: 0, 
                top: '50%', 
                height: '1px', 
                background: 'var(--bg-elevated)' 
              }} />
              <span style={{ 
                position: 'relative', 
                background: 'var(--bg-card)', 
                padding: '0 var(--space-md)',
                color: 'var(--text-muted)',
                fontSize: '0.875rem',
              }}>
                or edit existing
              </span>
            </div>
            
            {/* Use existing playlist */}
            <div>
              <label className="text-secondary" style={{ display: 'block', marginBottom: 'var(--space-sm)', fontSize: '0.875rem' }}>
                Paste playlist ID or URL from Tidal
              </label>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., abc123-def456 or tidal.com/playlist/..."
                  value={existingPlaylistId}
                  onChange={(e) => onExistingPlaylistIdChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onUseExistingPlaylist()}
                  style={{ flex: 1 }}
                />
                <button
                  onClick={() => onUseExistingPlaylist()}
                  disabled={isLoadingExisting || !existingPlaylistId.trim()}
                  className="btn btn-secondary"
                >
                  {isLoadingExisting ? '...' : 'Load'}
                </button>
              </div>
              {existingPlaylistError && (
                <p style={{ color: '#ff6b6b', fontSize: '0.8rem', marginTop: 'var(--space-sm)' }}>
                  {existingPlaylistError}
                </p>
              )}
            </div>
          </div>
          
          {/* Share code hint */}
          <p className="text-muted" style={{ marginTop: 'var(--space-lg)', textAlign: 'center', fontSize: '0.875rem' }}>
            Session code: <code style={{ color: 'var(--accent-cyan)' }}>{sessionId}</code>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

