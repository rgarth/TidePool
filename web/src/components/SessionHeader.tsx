import { motion } from 'framer-motion';
import { RefreshIcon, MenuIcon, ExitIcon, SearchIcon, CloseIcon } from './Icons';

interface SessionHeaderProps {
  sessionName: string;
  sessionId?: string;
  isHost: boolean;
  hasPlaylist: boolean;
  isRefreshing: boolean;
  copied: boolean;
  trackCount: number;
  participantCount: number;
  activeTab: 'playlist' | 'participants';
  searchQuery: string;
  onCopyCode: () => void;
  onRefresh: () => void;
  onOpenPlaylistPicker: () => void;
  onShare: () => void;
  onExit: () => void;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  onTabChange: (tab: 'playlist' | 'participants') => void;
}

export function SessionHeader({
  sessionName,
  sessionId,
  isHost,
  hasPlaylist,
  isRefreshing,
  copied,
  trackCount,
  participantCount,
  activeTab,
  searchQuery,
  onCopyCode,
  onRefresh,
  onOpenPlaylistPicker,
  onShare,
  onExit,
  onSearchChange,
  onClearSearch,
  onTabChange,
}: SessionHeaderProps) {
  return (
    <header className="container" style={{ paddingTop: 'var(--space-lg)', paddingBottom: 'var(--space-md)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{sessionName}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <button
              onClick={onCopyCode}
              className="text-muted"
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <code style={{ 
                background: 'var(--bg-elevated)', 
                padding: '2px 8px', 
                borderRadius: 'var(--radius-sm)',
                letterSpacing: '0.1em',
              }}>
                {sessionId}
              </code>
              {copied ? '✓' : '📋'}
            </button>
            {isHost && (
              <span style={{
                padding: '4px 8px',
                background: 'var(--accent-cyan)',
                color: 'var(--bg-primary)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                fontWeight: '600',
              }}>
                HOST
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          {isHost && hasPlaylist && (
            <button 
              onClick={onRefresh}
              disabled={isRefreshing}
              className="btn btn-ghost btn-sm"
              title="Refresh from Tidal"
            >
              <motion.div
                animate={isRefreshing ? { rotate: 360 } : {}}
                transition={isRefreshing ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
                style={{ display: 'flex' }}
              >
                <RefreshIcon size={18} />
              </motion.div>
            </button>
          )}
          {isHost && (
            <button 
              onClick={onOpenPlaylistPicker}
              className="btn btn-ghost btn-sm"
              title="Switch playlist"
            >
              <MenuIcon size={18} />
            </button>
          )}
          <button onClick={onShare} className="btn btn-secondary btn-sm">
            Invite
          </button>
          <button 
            onClick={onExit}
            className="btn btn-ghost btn-sm"
            title="Exit session"
          >
            <ExitIcon size={18} />
          </button>
        </div>
      </div>

      {/* Search input */}
      <div style={{ position: 'relative', zIndex: 15 }}>
        <input
          type="text"
          className="input"
          placeholder="Search for songs to add..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            paddingLeft: '44px',
            paddingRight: searchQuery ? '44px' : undefined,
          }}
        />
        <SearchIcon 
          size={20} 
          style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} 
        />
        {searchQuery && (
          <button
            onClick={onClearSearch}
            style={{
              position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', padding: '8px', cursor: 'pointer', color: 'var(--text-muted)',
            }}
          >
            <CloseIcon size={16} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)', borderBottom: '1px solid rgba(255,255,255,0.1)', alignItems: 'center' }}>
        <button
          onClick={() => onTabChange('playlist')}
          style={{
            background: 'none', border: 'none', padding: 'var(--space-sm) var(--space-md)',
            color: activeTab === 'playlist' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'playlist' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
            cursor: 'pointer', fontWeight: '500',
          }}
        >
          Playlist ({trackCount})
        </button>
        <button
          onClick={() => onTabChange('participants')}
          style={{
            background: 'none', border: 'none', padding: 'var(--space-sm) var(--space-md)',
            color: activeTab === 'participants' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'participants' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
            cursor: 'pointer', fontWeight: '500',
          }}
        >
          People ({participantCount})
        </button>
      </div>
    </header>
  );
}

