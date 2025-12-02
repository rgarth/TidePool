import { TidalLogo } from './Icons';

interface BottomBarProps {
  isHost: boolean;
  hasPlaylist: boolean;
  onOpenInTidal: () => void;
}

export function BottomBar({ isHost, hasPlaylist, onOpenInTidal }: BottomBarProps) {
  if (!isHost || !hasPlaylist) {
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
