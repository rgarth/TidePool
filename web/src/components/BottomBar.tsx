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
            disabled={isDisabled}
          >
            <TidalLogo size={20} />
            Open in Tidal
          </button>
          
          {/* Show explanation when playlist is private */}
          {isDisabled && (
            <p className="bottom-bar-hint">
              <InfoIcon size={14} />
              This playlist is private. Ask the host to make it public on Tidal.
            </p>
          )}
          
          {/* Show hint when playlist is public */}
          {!isHost && isPublic && (
            <p className="bottom-bar-hint">
              <InfoIcon size={14} />
              Access this playlist using the public URL from the host. Adding to your library creates a copy that won't reflect changes made here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

