import { useState, useCallback } from 'react';

interface UseShareProps {
  sessionId?: string;
  playlistUrl?: string;
}

export function useShare({ sessionId, playlistUrl }: UseShareProps) {
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);

  const openShareModal = useCallback(() => {
    setShowShare(true);
  }, []);

  const closeShareModal = useCallback(() => {
    setShowShare(false);
  }, []);

  const copyJoinUrl = useCallback(async () => {
    const joinUrl = `${window.location.origin}/join/${sessionId}`;
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [sessionId]);

  const openInTidal = useCallback(() => {
    if (playlistUrl) {
      window.open(playlistUrl, '_blank');
    }
  }, [playlistUrl]);

  return {
    showShare,
    copied,
    openShareModal,
    closeShareModal,
    copyJoinUrl,
    openInTidal,
  };
}

