import { useCallback } from 'react';

/**
 * Hook to play tracks via Tidal's web player.
 * Opens Tidal in a popup window for playback while keeping queue in focus.
 */
export function useTidalPlayer() {
  
  // Open track in Tidal web player (popup window)
  const openInTidal = useCallback((tidalId: string) => {
    if (!tidalId) {
      console.error('No Tidal ID provided');
      return;
    }
    
    // Use listen.tidal.com for the web player (auto-plays)
    const tidalUrl = `https://listen.tidal.com/track/${tidalId}`;
    
    // Open in a popup window so the queue stays visible
    const width = 420;
    const height = 700;
    const left = window.screenX + window.outerWidth - width - 50;
    const top = window.screenY + 50;
    
    window.open(
      tidalUrl,
      'tidal_player',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  }, []);
  
  // Open in new tab (full experience)
  const openInNewTab = useCallback((tidalId: string) => {
    if (!tidalId) return;
    const tidalUrl = `https://listen.tidal.com/track/${tidalId}`;
    window.open(tidalUrl, '_blank');
  }, []);
  
  // Copy Tidal link
  const copyTidalLink = useCallback(async (tidalId: string) => {
    const tidalUrl = `https://tidal.com/browse/track/${tidalId}`;
    try {
      await navigator.clipboard.writeText(tidalUrl);
      return true;
    } catch {
      return false;
    }
  }, []);
  
  return {
    openInTidal,
    openInNewTab,
    copyTidalLink,
  };
}

