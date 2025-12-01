import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { useSocket } from '../hooks/useSocket';
import type { SearchResult, Track, Playlist } from '../types';

export function SessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const {
    isConnected,
    sessionState,
    error,
    joinSession,
    addToQueue,
    removeFromQueue,
    playbackControl,
  } = useSocket();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [activeTab, setActiveTab] = useState<'queue' | 'participants'>('queue');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Playlists state
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<SearchResult[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);

  // Share modal state
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);

  // Join session on mount
  useEffect(() => {
    if (isConnected && sessionId) {
      const userName = sessionStorage.getItem('userName') || 'Guest';
      const isHost = sessionStorage.getItem('isHost') === 'true';
      joinSession(sessionId, userName, isHost);
    }
  }, [isConnected, sessionId, joinSession]);

  // Handle connection errors
  useEffect(() => {
    if (error) {
      console.error('Socket error:', error);
      // Redirect to home if session not found
      if (error.includes('not found')) {
        navigate('/', { replace: true });
      }
    }
  }, [error, navigate]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/tidal/search?query=${encodeURIComponent(searchQuery)}`);
        const data = await response.json();
        setSearchResults(data.tracks || []);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleAddTrack = (track: SearchResult, position: 'end' | 'next') => {
    addToQueue(track, position);
    setSearchQuery('');
    setSearchResults([]);
    setShowSearch(false);
  };

  const handleOpenPlaylists = async () => {
    setShowPlaylists(true);
    setIsLoadingPlaylists(true);
    try {
      const response = await fetch('/api/tidal/playlists');
      const data = await response.json();
      setPlaylists(data.playlists || []);
    } catch (err) {
      console.error('Failed to load playlists:', err);
    } finally {
      setIsLoadingPlaylists(false);
    }
  };

  const handleSelectPlaylist = async (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setIsLoadingTracks(true);
    try {
      const response = await fetch(`/api/tidal/playlists/${playlist.id}/tracks`);
      const data = await response.json();
      setPlaylistTracks(data.tracks || []);
    } catch (err) {
      console.error('Failed to load playlist tracks:', err);
    } finally {
      setIsLoadingTracks(false);
    }
  };

  const handleAddPlaylistTrack = (track: SearchResult, position: 'end' | 'next') => {
    addToQueue(track, position);
  };

  const handleAddAllTracks = () => {
    playlistTracks.forEach((track) => {
      addToQueue(track, 'end');
    });
    setShowPlaylists(false);
    setSelectedPlaylist(null);
    setPlaylistTracks([]);
  };

  const handleClosePlaylists = () => {
    setShowPlaylists(false);
    setSelectedPlaylist(null);
    setPlaylistTracks([]);
  };

  // Share functionality
  const shareUrl = `${window.location.origin}/join/${sessionId}`;
  const shareText = `Join my music session! Code: ${sessionId}`;

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: sessionState?.name || 'Join my music session',
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or error
        console.log('Share cancelled or failed');
      }
    } else {
      // Fallback to copy
      handleCopyLink();
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(sessionId || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentTrack = sessionState?.queue[sessionState.currentTrackIndex];

  if (!isConnected) {
    return (
      <div className="page page-centered">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--bg-elevated)',
            borderTopColor: 'var(--accent-cyan)',
            borderRadius: '50%',
          }}
        />
        <p className="text-secondary mt-md">Connecting...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page page-centered">
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              margin: '0 auto var(--space-lg)',
              borderRadius: '50%',
              background: 'var(--bg-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-amber)' }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 style={{ marginBottom: 'var(--space-sm)' }}>Session Not Found</h2>
          <p className="text-secondary" style={{ marginBottom: 'var(--space-xl)' }}>
            This session may have expired or the code is incorrect.
          </p>
          <button onClick={() => navigate('/')} className="btn btn-primary">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (!sessionState) {
    return (
      <div className="page page-centered">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--bg-elevated)',
            borderTopColor: 'var(--accent-cyan)',
            borderRadius: '50%',
          }}
        />
        <p className="text-secondary" style={{ marginTop: 'var(--space-md)' }}>Loading session...</p>
      </div>
    );
  }

  return (
    <div className="page" style={{ paddingBottom: currentTrack ? '140px' : '0' }}>
      {/* Header */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          background: 'linear-gradient(to bottom, var(--bg-primary) 0%, var(--bg-primary) 80%, transparent 100%)',
          padding: 'var(--space-md) var(--space-lg)',
          zIndex: 50,
        }}
      >
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>{sessionState.name}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <span className="session-code" style={{ fontSize: '1rem', padding: 'var(--space-xs) var(--space-sm)', letterSpacing: '0.15em' }}>
                  {sessionId}
                </span>
                {sessionState.isHost && (
                  <span
                    style={{
                      padding: '4px 8px',
                      background: 'var(--accent-amber)',
                      color: 'var(--bg-primary)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                    }}
                  >
                    HOST
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button
                onClick={() => setShowShare(true)}
                className="btn btn-secondary btn-sm"
                title="Share session"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                Share
              </button>
              <button
                onClick={() => navigate('/')}
                className="btn btn-ghost btn-sm"
              >
                Leave
              </button>
            </div>
          </div>

          {/* Tab buttons */}
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button
              className={`btn btn-sm ${activeTab === 'queue' ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('queue')}
            >
              Queue ({sessionState.queue.length})
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'participants' ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('participants')}
            >
              People ({sessionState.participants.length})
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container" style={{ flex: 1 }}>
        <AnimatePresence mode="wait">
          {activeTab === 'queue' ? (
            <motion.div
              key="queue"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Queue list */}
              {sessionState.queue.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                  <div
                    style={{
                      width: '80px',
                      height: '80px',
                      margin: '0 auto var(--space-lg)',
                      borderRadius: '50%',
                      background: 'var(--bg-elevated)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                  </div>
                  <h3 className="text-secondary" style={{ marginBottom: 'var(--space-sm)' }}>
                    Queue is empty
                  </h3>
                  <p className="text-muted">Search for songs to add them to the queue</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                  {sessionState.queue.map((track, index) => (
                    <QueueItem
                      key={track.id}
                      track={track}
                      index={index}
                      isCurrent={index === sessionState.currentTrackIndex}
                      isPlaying={sessionState.isPlaying && index === sessionState.currentTrackIndex}
                      onPlay={() => playbackControl('jump', index)}
                      onRemove={() => removeFromQueue(track.id)}
                      formatDuration={formatDuration}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="participants"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {sessionState.participants.map((name, index) => (
                  <div
                    key={index}
                    className="card"
                    style={{
                      padding: 'var(--space-md)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-md)',
                    }}
                  >
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: `hsl(${(index * 60) % 360}, 70%, 50%)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '600',
                        color: 'white',
                      }}
                    >
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <span>{name}</span>
                    {index === 0 && (
                      <span
                        style={{
                          marginLeft: 'auto',
                          padding: '4px 8px',
                          background: 'var(--accent-amber)',
                          color: 'var(--bg-primary)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                        }}
                      >
                        HOST
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* FAB buttons */}
      <div
        style={{
          position: 'fixed',
          bottom: currentTrack ? '160px' : '24px',
          right: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-md)',
          zIndex: 40,
        }}
      >
        {/* My Playlists FAB (host only) */}
        {sessionState.isHost && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleOpenPlaylists}
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--accent-amber)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(255, 184, 0, 0.2)',
            }}
            title="My Playlists"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-amber)' }}>
              <path d="M21 15V6" />
              <path d="M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
              <path d="M12 12H3" />
              <path d="M16 6H3" />
              <path d="M12 18H3" />
            </svg>
          </motion.button>
        )}

        {/* Search FAB */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowSearch(true)}
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'var(--gradient-glow)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow-cyan)',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--bg-primary)' }}>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </motion.button>
      </div>

      {/* Search modal */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(10px)',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: 'var(--space-lg)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                <button onClick={() => setShowSearch(false)} className="btn btn-ghost btn-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
                <input
                  type="text"
                  className="input input-lg"
                  placeholder="Search for songs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-lg)' }}>
              {isSearching && (
                <div style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    style={{
                      width: '30px',
                      height: '30px',
                      margin: '0 auto',
                      border: '2px solid var(--bg-elevated)',
                      borderTopColor: 'var(--accent-cyan)',
                      borderRadius: '50%',
                    }}
                  />
                </div>
              )}

              {!isSearching && searchResults.length === 0 && searchQuery.length >= 2 && (
                <p className="text-muted" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                  No results found
                </p>
              )}

              {!isSearching && searchResults.length === 0 && searchQuery.length < 2 && (
                <p className="text-muted" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                  Type at least 2 characters to search
                </p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {searchResults.map((track) => (
                  <SearchResultItem
                    key={track.id}
                    track={track}
                    onAddToQueue={() => handleAddTrack(track, 'end')}
                    onPlayNext={() => handleAddTrack(track, 'next')}
                    formatDuration={formatDuration}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share modal */}
      <AnimatePresence>
        {showShare && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowShare(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(10px)',
              zIndex: 110,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-lg)',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="card"
              style={{
                maxWidth: '400px',
                width: '100%',
                padding: 'var(--space-xl)',
                textAlign: 'center',
              }}
            >
              {/* Header */}
              <div style={{ marginBottom: 'var(--space-xl)' }}>
                <h2 style={{ marginBottom: 'var(--space-sm)' }}>Share Session</h2>
                <p className="text-secondary">Invite others to join your music queue</p>
              </div>

              {/* QR Code */}
              <div
                style={{
                  background: 'white',
                  padding: 'var(--space-lg)',
                  borderRadius: 'var(--radius-lg)',
                  display: 'inline-block',
                  marginBottom: 'var(--space-lg)',
                }}
              >
                <QRCodeSVG
                  value={shareUrl}
                  size={180}
                  level="M"
                  includeMargin={false}
                />
              </div>

              {/* Session Code */}
              <div style={{ marginBottom: 'var(--space-xl)' }}>
                <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: 'var(--space-sm)' }}>
                  Or enter code manually:
                </p>
                <div
                  onClick={handleCopyCode}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '2rem',
                    fontWeight: '600',
                    letterSpacing: '0.2em',
                    color: 'var(--accent-cyan)',
                    cursor: 'pointer',
                    padding: 'var(--space-md)',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--accent-cyan)',
                    transition: 'all 0.2s',
                  }}
                  title="Click to copy"
                >
                  {sessionId}
                </div>
              </div>

              {/* Share buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {/* Native Share (mobile) */}
                {'share' in navigator && (
                  <button
                    onClick={handleNativeShare}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: 'var(--space-lg)' }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                    Share via...
                  </button>
                )}

                {/* Copy Link */}
                <button
                  onClick={handleCopyLink}
                  className="btn btn-secondary"
                  style={{ width: '100%', padding: 'var(--space-lg)' }}
                >
                  {copied ? (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-green)' }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span style={{ color: 'var(--accent-green)' }}>Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copy Link
                    </>
                  )}
                </button>
              </div>

              {/* Close */}
              <button
                onClick={() => setShowShare(false)}
                className="btn btn-ghost"
                style={{ marginTop: 'var(--space-lg)' }}
              >
                Done
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Playlists modal (host only) */}
      <AnimatePresence>
        {showPlaylists && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.9)',
              backdropFilter: 'blur(10px)',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: 'var(--space-lg)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                <button 
                  onClick={selectedPlaylist ? () => { setSelectedPlaylist(null); setPlaylistTracks([]); } : handleClosePlaylists} 
                  className="btn btn-ghost btn-icon"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {selectedPlaylist ? (
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    ) : (
                      <path d="M18 6 6 18M6 6l12 12" />
                    )}
                  </svg>
                </button>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: '1.25rem', marginBottom: '2px' }}>
                    {selectedPlaylist ? selectedPlaylist.name : 'My Playlists'}
                  </h2>
                  {selectedPlaylist && (
                    <p className="text-secondary" style={{ fontSize: '0.875rem' }}>
                      {selectedPlaylist.trackCount} tracks • {selectedPlaylist.description}
                    </p>
                  )}
                </div>
                {selectedPlaylist && (
                  <button
                    onClick={handleAddAllTracks}
                    className="btn btn-primary btn-sm"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Add All
                  </button>
                )}
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-lg)' }}>
              {/* Loading state */}
              {(isLoadingPlaylists || isLoadingTracks) && (
                <div style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    style={{
                      width: '30px',
                      height: '30px',
                      margin: '0 auto',
                      border: '2px solid var(--bg-elevated)',
                      borderTopColor: 'var(--accent-amber)',
                      borderRadius: '50%',
                    }}
                  />
                </div>
              )}

              {/* Playlists list */}
              {!isLoadingPlaylists && !selectedPlaylist && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                  {playlists.map((playlist) => (
                    <motion.div
                      key={playlist.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="card"
                      onClick={() => handleSelectPlaylist(playlist)}
                      style={{
                        padding: 'var(--space-md)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-md)',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s',
                      }}
                      whileHover={{ borderColor: 'var(--accent-amber)' }}
                    >
                      <img
                        src={playlist.imageUrl}
                        alt={playlist.name}
                        style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: 'var(--radius-sm)',
                          objectFit: 'cover',
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                          {playlist.name}
                        </div>
                        <div className="text-secondary" style={{ fontSize: '0.875rem' }}>
                          {playlist.trackCount} tracks
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {playlist.description}
                        </div>
                      </div>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Playlist tracks */}
              {!isLoadingTracks && selectedPlaylist && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                  {playlistTracks.map((track, index) => (
                    <motion.div
                      key={track.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="card"
                      style={{
                        padding: 'var(--space-md)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-md)',
                      }}
                    >
                      <div
                        style={{
                          width: '32px',
                          textAlign: 'center',
                          color: 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.875rem',
                        }}
                      >
                        {index + 1}
                      </div>
                      <img
                        src={track.albumArt}
                        alt={track.album}
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: 'var(--radius-sm)',
                          objectFit: 'cover',
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: '500',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {track.title}
                        </div>
                        <div
                          className="text-secondary"
                          style={{
                            fontSize: '0.875rem',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {track.artist}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                        <button
                          onClick={() => handleAddPlaylistTrack(track, 'next')}
                          className="btn btn-primary btn-sm"
                          title="Play Next"
                        >
                          Next
                        </button>
                        <button
                          onClick={() => handleAddPlaylistTrack(track, 'end')}
                          className="btn btn-secondary btn-sm"
                          title="Add to Queue"
                        >
                          Add
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Now Playing bar */}
      {currentTrack && (
        <NowPlayingBar
          track={currentTrack}
          isPlaying={sessionState.isPlaying}
          isHost={sessionState.isHost}
          onPlay={() => playbackControl('play')}
          onPause={() => playbackControl('pause')}
          onNext={() => playbackControl('next')}
          onPrevious={() => playbackControl('previous')}
          formatDuration={formatDuration}
        />
      )}
    </div>
  );
}

// Queue item component
function QueueItem({
  track,
  index,
  isCurrent,
  isPlaying,
  onPlay,
  onRemove,
  formatDuration,
}: {
  track: Track;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onRemove: () => void;
  formatDuration: (s: number) => string;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
      style={{
        padding: 'var(--space-md)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-md)',
        borderColor: isCurrent ? 'var(--accent-cyan)' : undefined,
        boxShadow: isCurrent ? '0 0 20px rgba(0, 240, 255, 0.2)' : undefined,
      }}
    >
      {/* Index / Play indicator */}
      <div
        style={{
          width: '32px',
          textAlign: 'center',
          color: isCurrent ? 'var(--accent-cyan)' : 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.875rem',
        }}
      >
        {isPlaying ? (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            ▶
          </motion.div>
        ) : (
          index + 1
        )}
      </div>

      {/* Album art */}
      <img
        src={track.albumArt}
        alt={track.album}
        style={{
          width: '48px',
          height: '48px',
          borderRadius: 'var(--radius-sm)',
          objectFit: 'cover',
        }}
      />

      {/* Track info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: '500',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: isCurrent ? 'var(--accent-cyan)' : 'var(--text-primary)',
          }}
        >
          {track.title}
        </div>
        <div
          className="text-secondary"
          style={{
            fontSize: '0.875rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {track.artist}
        </div>
        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
          Added by {track.addedBy}
        </div>
      </div>

      {/* Duration */}
      <span className="text-muted" style={{ fontSize: '0.875rem', fontFamily: 'var(--font-mono)' }}>
        {formatDuration(track.duration)}
      </span>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
        <button onClick={onPlay} className="btn btn-ghost btn-sm" title="Play now">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>
        <button onClick={onRemove} className="btn btn-ghost btn-sm" title="Remove">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}

// Search result component
function SearchResultItem({
  track,
  onAddToQueue,
  onPlayNext,
  formatDuration,
}: {
  track: SearchResult;
  onAddToQueue: () => void;
  onPlayNext: () => void;
  formatDuration: (s: number) => string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
      style={{
        padding: 'var(--space-md)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-md)',
      }}
    >
      {/* Album art */}
      <img
        src={track.albumArt}
        alt={track.album}
        style={{
          width: '56px',
          height: '56px',
          borderRadius: 'var(--radius-sm)',
          objectFit: 'cover',
        }}
      />

      {/* Track info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: '500',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {track.title}
        </div>
        <div
          className="text-secondary"
          style={{
            fontSize: '0.875rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {track.artist} • {track.album}
        </div>
        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
          {formatDuration(track.duration)}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
        <button
          onClick={onPlayNext}
          className="btn btn-primary btn-sm"
          style={{ whiteSpace: 'nowrap' }}
        >
          Play Next
        </button>
        <button
          onClick={onAddToQueue}
          className="btn btn-secondary btn-sm"
          style={{ whiteSpace: 'nowrap' }}
        >
          Add to Queue
        </button>
      </div>
    </motion.div>
  );
}

// Now playing bar
function NowPlayingBar({
  track,
  isPlaying,
  isHost,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  formatDuration,
}: {
  track: Track;
  isPlaying: boolean;
  isHost: boolean;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  formatDuration: (s: number) => string;
}) {
  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="now-playing"
    >
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          {/* Album art */}
          <motion.img
            animate={isPlaying ? { rotate: 360 } : {}}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            src={track.albumArt}
            alt={track.album}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: isPlaying ? '50%' : 'var(--radius-sm)',
              objectFit: 'cover',
              transition: 'border-radius 0.3s',
            }}
          />

          {/* Track info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: '500',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                color: 'var(--accent-cyan)',
              }}
            >
              {track.title}
            </div>
            <div
              className="text-secondary"
              style={{
                fontSize: '0.875rem',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {track.artist}
            </div>
          </div>

          {/* Playback controls (host only) */}
          {isHost && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <button onClick={onPrevious} className="btn btn-ghost btn-icon" style={{ width: '40px', height: '40px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="19 20 9 12 19 4 19 20" />
                  <line x1="5" y1="19" x2="5" y2="5" />
                </svg>
              </button>
              
              <button
                onClick={isPlaying ? onPause : onPlay}
                className="btn btn-primary btn-icon"
                style={{ width: '48px', height: '48px' }}
              >
                {isPlaying ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                )}
              </button>
              
              <button onClick={onNext} className="btn btn-ghost btn-icon" style={{ width: '40px', height: '40px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 4 15 12 5 20 5 4" />
                  <line x1="19" y1="5" x2="19" y2="19" />
                </svg>
              </button>
            </div>
          )}

          {/* Duration for non-hosts */}
          {!isHost && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              {isPlaying && (
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{ color: 'var(--accent-green)', fontSize: '0.875rem' }}
                >
                  ● Playing
                </motion.div>
              )}
              <span className="text-muted" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
                {formatDuration(track.duration)}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

