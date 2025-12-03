import { useState } from 'react';
import { TidalLogo, InfoIcon } from './Icons';

interface BottomBarProps {
  isHost: boolean;
  hasPlaylist: boolean;
  isPublic: boolean;
  onOpenInTidal: () => void;
}

export function BottomBar({ 
  isHost, 
  hasPlaylist, 
  isPublic,
  onOpenInTidal,
}: BottomBarProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  if (!hasPlaylist) {
    return null;
  }

  // Guests can't open private playlists
  const isDisabled = !isHost && !isPublic;

  return (
    <div className="bottom-bar">
      <div className="container">
        <div className="bottom-bar-content">
          <button 
            className={`btn btn-block btn-lg ${isDisabled ? 'btn-disabled' : 'btn-primary'}`}
            onClick={isDisabled ? undefined : onOpenInTidal}
            onMouseEnter={() => isDisabled && setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            disabled={isDisabled}
          >
            <TidalLogo size={20} />
            Open in Tidal
          </button>
          
          {isDisabled && showTooltip && (
            <div className="tooltip tooltip-above">
              This playlist is private. Ask the host to make it public on Tidal.
            </div>
          )}
          
          {!isHost && isPublic && (
            <p className="bottom-bar-hint">
              <InfoIcon size={14} />
              Adding this playlist to your library creates a copy that won't sync with changes made here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

