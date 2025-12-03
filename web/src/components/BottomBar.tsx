import { TidalLogo } from './Icons';

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
  // Show for hosts always, and for guests only when playlist is public
  if (!hasPlaylist || (!isHost && !isPublic)) {
    return null;
  }

  return (
    <div className="bottom-bar">
      <div className="container">
        <button className="btn btn-primary btn-block btn-lg" onClick={onOpenInTidal}>
          <TidalLogo size={20} />
          Open in Tidal
        </button>
      </div>
    </div>
  );
}

