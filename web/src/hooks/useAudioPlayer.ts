import { useRef, useState, useCallback, useEffect } from 'react';

interface PlaybackInfo {
  trackId: string;
  streamUrl: string;
  audioQuality?: string;
}

/**
 * Hook for playing audio in the browser.
 * Fetches stream URLs from our backend (which proxies to Tidal)
 * and plays them using HTML5 Audio.
 */
export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0); // 0-100
  const [duration, setDuration] = useState(0);
  
  // Create audio element on mount
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous'; // Some streams may need this
    audioRef.current = audio;
    
    // Event listeners
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };
    const handleTimeUpdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };
    const handleDurationChange = () => {
      setDuration(audio.duration);
    };
    const handleError = (e: Event) => {
      console.error('Audio error:', e);
      setError('Failed to play audio');
      setIsPlaying(false);
      setIsLoading(false);
    };
    
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('error', handleError);
    
    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('error', handleError);
      audio.pause();
      audio.src = '';
    };
  }, []);
  
  // Fetch stream URL from our backend
  const getStreamUrl = useCallback(async (tidalId: string): Promise<string | null> => {
    try {
      const response = await fetch(`/api/tidal/playback/${tidalId}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get playback info');
      }
      
      const data: PlaybackInfo = await response.json();
      console.log('Got playback info:', data);
      
      if (!data.streamUrl) {
        throw new Error('No stream URL available');
      }
      
      return data.streamUrl;
    } catch (err: any) {
      console.error('Failed to get stream URL:', err);
      setError(err.message);
      return null;
    }
  }, []);
  
  // Play a track by its Tidal ID
  const playTrack = useCallback(async (tidalId: string) => {
    if (!tidalId) {
      setError('No track ID provided');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // If same track, just resume
      if (currentTrackId === tidalId && audioRef.current) {
        await audioRef.current.play();
        setIsLoading(false);
        return;
      }
      
      // Get stream URL
      const streamUrl = await getStreamUrl(tidalId);
      if (!streamUrl) {
        setIsLoading(false);
        return;
      }
      
      // Play the audio
      if (audioRef.current) {
        audioRef.current.src = streamUrl;
        audioRef.current.load();
        await audioRef.current.play();
        setCurrentTrackId(tidalId);
      }
    } catch (err: any) {
      console.error('Playback error:', err);
      setError(err.message || 'Playback failed');
    } finally {
      setIsLoading(false);
    }
  }, [currentTrackId, getStreamUrl]);
  
  // Pause playback
  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);
  
  // Resume playback
  const resume = useCallback(async () => {
    if (audioRef.current && audioRef.current.src) {
      try {
        await audioRef.current.play();
      } catch (err: any) {
        console.error('Resume error:', err);
        setError(err.message);
      }
    }
  }, []);
  
  // Toggle play/pause
  const toggle = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  }, [isPlaying, pause, resume]);
  
  // Stop and reset
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setCurrentTrackId(null);
    setProgress(0);
    setIsPlaying(false);
  }, []);
  
  // Seek to position (0-100)
  const seek = useCallback((percent: number) => {
    if (audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = (percent / 100) * audioRef.current.duration;
    }
  }, []);
  
  // Set volume (0-1)
  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, []);
  
  // Get callback for when track ends (to auto-advance queue)
  const onTrackEnded = useCallback((callback: () => void) => {
    if (audioRef.current) {
      const handleEnded = () => callback();
      audioRef.current.addEventListener('ended', handleEnded);
      return () => audioRef.current?.removeEventListener('ended', handleEnded);
    }
    return () => {};
  }, []);
  
  return {
    // State
    isPlaying,
    isLoading,
    error,
    currentTrackId,
    progress,
    duration,
    
    // Controls
    playTrack,
    pause,
    resume,
    toggle,
    stop,
    seek,
    setVolume,
    onTrackEnded,
  };
}

