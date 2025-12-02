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
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'linear-gradient(transparent, var(--bg-primary) 20%)',
      padding: 'var(--space-xl) var(--space-lg) var(--space-lg)',
    }}>
      <div className="container">
        <button onClick={onOpenInTidal} className="btn btn-primary" style={{ width: '100%', padding: 'var(--space-md)' }}>
          <TidalLogo size={20} style={{ marginRight: '8px' }} />
          Open in Tidal
        </button>
      </div>
    </div>
  );
}

