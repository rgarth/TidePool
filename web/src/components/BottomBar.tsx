import { TidalLogo } from './Icons';

interface BottomBarProps {
  isHost: boolean;
  hasPlaylist: boolean;
  isPublic: boolean;
  isTogglingPrivacy?: boolean;
  onOpenInTidal: () => void;
  onTogglePrivacy?: (isPublic: boolean) => void;
}

export function BottomBar({ 
  isHost, 
  hasPlaylist, 
  isPublic,
  isTogglingPrivacy,
  onOpenInTidal,
  onTogglePrivacy,
}: BottomBarProps) {
  // Show for hosts always, and for guests when playlist is public
  if (!hasPlaylist || (!isHost && !isPublic)) {
    return null;
  }

  return (
    <div className="bottom-bar">
      <div className="container">
        {isHost && (
          <div className="privacy-toggle">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={isPublic}
                disabled={isTogglingPrivacy}
                onChange={(e) => onTogglePrivacy?.(e.target.checked)}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-text">
                {isPublic ? 'Public playlist' : 'Private playlist'}
              </span>
            </label>
          </div>
        )}
        <button className="btn btn-primary btn-block btn-lg" onClick={onOpenInTidal}>
          <TidalLogo size={20} />
          Open in Tidal
        </button>
      </div>
    </div>
  );
}

