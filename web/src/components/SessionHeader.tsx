import { motion } from 'framer-motion';
import { DropdownMenu } from './DropdownMenu';
import { ThemePicker } from './ThemePicker';
import { RefreshIcon, SwitchIcon, ExitIcon, SearchIcon, CloseIcon } from './Icons';

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
  onOpenPlaylistPicker: () => void;
  onShare: () => void;
  onExit: () => void;
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
  onOpenPlaylistPicker,
  onShare,
  onExit,
  onSearchChange,
  onClearSearch,
  onTabChange,
}: SessionHeaderProps) {
  // Build menu items based on host status
  const menuItems = [];
  
  if (isHost && hasPlaylist) {
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
      label: 'Switch playlist',
      icon: <SwitchIcon size={18} />,
      onClick: onOpenPlaylistPicker,
    });
  }
  
  menuItems.push({
    label: 'Exit session',
    icon: <ExitIcon size={18} />,
    onClick: onExit,
    danger: true,
  });

  return (
    <header className="header container">
      {/* Top row: Name + HOST badge, actions */}
      <div className="header-row">
        <div className="header-info flex items-center gap-sm">
          <h1 className="header-title truncate">{sessionName}</h1>
          {isHost && <span className="badge badge-accent flex-shrink-0">HOST</span>}
        </div>
        
        <div className="header-actions">
          <button onClick={onShare} className="btn btn-secondary btn-sm">
            Invite
          </button>
          <DropdownMenu items={menuItems} footer={<ThemePicker />} />
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
