import { motion } from 'framer-motion';
import { DropdownMenu } from './DropdownMenu';
import { ThemePicker } from './ThemePicker';
import { RefreshIcon, SwitchIcon, SearchIcon, CloseIcon, LogoutIcon, PaletteIcon, EditIcon, StopIcon } from './Icons';

interface SessionHeaderProps {
  sessionName: string;
  isHost: boolean;
  hasPlaylist: boolean;
  isRefreshing: boolean;
  trackCount: number;
  participantCount: number;
  activeTab: 'playlist' | 'participants';
  searchQuery: string;
  searchDisabled?: boolean;
  onRefresh: () => void;
  onChangeSession: () => void;
  onShare: () => void;
  onEndSession?: () => void;
  onLogout?: () => void;
  onEdit?: () => void;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  onTabChange: (tab: 'playlist' | 'participants') => void;
}

export function SessionHeader({
  sessionName,
  isHost,
  hasPlaylist,
  isRefreshing,
  trackCount,
  participantCount,
  activeTab,
  searchQuery,
  searchDisabled,
  onRefresh,
  onChangeSession,
  onShare,
  onEndSession,
  onLogout,
  onEdit,
  onSearchChange,
  onClearSearch,
  onTabChange,
}: SessionHeaderProps) {
  // Build menu items based on host status
  const menuItems = [];
  
  if (hasPlaylist) {
    menuItems.push({
      label: 'Refresh from Tidal',
      icon: (
        <motion.div
          animate={isRefreshing ? { rotate: 360 } : {}}
          transition={isRefreshing ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
          style={{ display: 'flex' }}
        >
          <RefreshIcon size={18} />
        </motion.div>
      ),
      onClick: onRefresh,
      disabled: isRefreshing,
    });
  }
  
  if (isHost) {
    menuItems.push({
      label: 'Change session',
      icon: <SwitchIcon size={18} />,
      onClick: onChangeSession,
    });
  }
  
  // Theme submenu (collapsible)
  menuItems.push({
    label: 'Theme',
    icon: <PaletteIcon size={18} />,
    submenu: (closeMenu: () => void) => <ThemePicker onSelect={closeMenu} />,
  });
  
  if (isHost && onLogout) {
    menuItems.push({
      label: 'Disconnect Tidal',
      icon: <LogoutIcon size={18} />,
      onClick: onLogout,
      danger: true,
    });
  }
  
  if (isHost && onEndSession) {
    menuItems.push({
      label: 'End session',
      icon: <StopIcon size={18} />,
      onClick: onEndSession,
      danger: true,
    });
  }

  return (
    <header className="header container">
      {/* Top row: Name + edit + HOST badge, actions */}
      <div className="header-row">
        <div className="header-info flex items-center gap-sm">
          <h1 className="header-title truncate">{sessionName}</h1>
          {isHost && hasPlaylist && onEdit && (
            <button
              className="btn btn-ghost"
              onClick={onEdit}
              title="Edit playlist"
              style={{ padding: '4px', opacity: 0.6 }}
            >
              <EditIcon size={16} />
            </button>
          )}
          {isHost && <span className="badge badge-accent flex-shrink-0">HOST</span>}
        </div>
        
        <div className="header-actions">
          <button onClick={onShare} className="btn btn-secondary btn-sm">
            Invite
          </button>
          <DropdownMenu items={menuItems} />
        </div>
      </div>

      {/* Search input */}
      <div className={`input-group ${searchDisabled ? 'opacity-50' : ''}`}>
        <input
          type="text"
          className="input input-with-icon"
          placeholder={searchDisabled ? 'Playlist unavailable' : 'Search for songs to add...'}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          disabled={searchDisabled}
        />
        <SearchIcon size={20} className="input-icon" />
        {searchQuery && (
          <button className="input-clear" onClick={onClearSearch}>
            <CloseIcon size={16} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs mt-md">
        <button
          className={`tab ${activeTab === 'playlist' ? 'tab-active' : ''}`}
          onClick={() => onTabChange('playlist')}
        >
          Playlist ({trackCount})
        </button>
        <button
          className={`tab ${activeTab === 'participants' ? 'tab-active' : ''}`}
          onClick={() => onTabChange('participants')}
        >
          People ({participantCount})
        </button>
      </div>
    </header>
  );
}
