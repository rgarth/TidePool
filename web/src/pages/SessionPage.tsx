import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../hooks/useSocket';
import { useSearch } from '../hooks/useSearch';
import { useAuth } from '../hooks/useAuth';
import { usePlaylistActions } from '../hooks/usePlaylistActions';
import { useShare } from '../hooks/useShare';
import { PlaylistPicker } from '../components/PlaylistPicker';
import { SessionHeader } from '../components/SessionHeader';
import { SearchResults } from '../components/SearchResults';
import { PlaylistView } from '../components/PlaylistView';
import { ParticipantsList } from '../components/ParticipantsList';
import { ShareModal } from '../components/ShareModal';
import { BottomBar } from '../components/BottomBar';
import { PageSpinner } from '../components/Spinner';
import { setHostToken } from '../config';

export function SessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Socket connection and session state
  const {
    isConnected,
    sessionState,
    error,
    isAwaitingSync,
    playlistDeleted,
    joinSession,
    setPlaylist,
    startLoading,
    clearUnavailableFlag,
  } = useSocket();

  // Search functionality
  const { searchQuery, setSearchQuery, searchResults, isSearching, clearSearch } = useSearch(sessionId);
  
  // UI state
  const [activeTab, setActiveTab] = useState<'playlist' | 'participants'>('playlist');
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  
  // Auth handling
  const authSuccess = searchParams.get('auth') === 'success';
  const urlToken = searchParams.get('token');
  const { isAuthenticated } = useAuth({ delayCheck: authSuccess && urlToken ? 100 : 0 });
  
  // Playlist operations
  const playlist = usePlaylistActions({
    sessionId,
    playlistId: sessionState?.tidalPlaylistId,
    onPlaylistSet: setPlaylist,
    onStartLoading: startLoading,
    onClearSearch: clearSearch,
  });
  
  // Share functionality
  const share = useShare({
    sessionId,
    playlistUrl: sessionState?.tidalPlaylistUrl,
  });

  // Extract and store token from URL (for cross-origin auth)
  useEffect(() => {
    if (authSuccess && urlToken) {
      setHostToken(urlToken);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('token');
      navigate(`/session/${sessionId}?${newParams.toString()}`, { replace: true });
    }
  }, [authSuccess, urlToken, navigate, sessionId, searchParams]);

  // Show playlist picker for host if no playlist linked yet
  useEffect(() => {
    if (sessionState?.isHost && isAuthenticated && !sessionState.tidalPlaylistId) {
      setShowPlaylistPicker(true);
    }
  }, [sessionState?.isHost, isAuthenticated, sessionState?.tidalPlaylistId]);

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
    if (error?.includes('not found')) {
      navigate('/', { replace: true });
    }
  }, [error, navigate]);

  // Computed loading state
  const isLoadingPlaylist = isAwaitingSync || playlist.isLoading;

  // Loading state - no session yet
  if (!sessionState) {
    return <PageSpinner />;
  }

  // Playlist picker for host
  if (showPlaylistPicker && sessionState.isHost) {
    return (
      <PlaylistPicker
        sessionId={sessionId}
        lastPlaylistId={playlist.lastPlaylistId}
        existingPlaylistId={playlist.existingPlaylistId}
        newPlaylistName={playlist.newPlaylistName}
        existingPlaylistError={playlist.existingPlaylistError}
        isLoadingExisting={playlist.isLoadingExisting}
        isCreatingPlaylist={playlist.isCreatingPlaylist}
        hasLinkedPlaylist={!!sessionState.tidalPlaylistId}
        onClose={() => setShowPlaylistPicker(false)}
        onCreateNewPlaylist={async () => {
          const success = await playlist.createPlaylist();
          if (success) setShowPlaylistPicker(false);
        }}
        onUseExistingPlaylist={async (id) => {
          const success = await playlist.loadExistingPlaylist(id);
          if (success) setShowPlaylistPicker(false);
        }}
        onNewPlaylistNameChange={playlist.setNewPlaylistName}
        onExistingPlaylistIdChange={playlist.setExistingPlaylistId}
      />
    );
  }

  return (
    <div className="page" style={{ height: '100vh' }}>
      <SessionHeader
        sessionName={sessionState.name}
        isHost={sessionState.isHost}
        hasPlaylist={!!sessionState.tidalPlaylistId}
        isRefreshing={playlist.isRefreshing}
        trackCount={sessionState.tracks.length}
        participantCount={sessionState.participants.length}
        activeTab={activeTab}
        searchQuery={searchQuery}
        searchDisabled={playlistDeleted}
        onRefresh={playlist.refreshPlaylist}
        onOpenPlaylistPicker={() => setShowPlaylistPicker(true)}
        onShare={share.openShareModal}
        onExit={() => navigate('/')}
        onSearchChange={setSearchQuery}
        onClearSearch={clearSearch}
        onTabChange={setActiveTab}
      />

      <main className="container page-content" style={{ overflow: 'auto' }}>
        <SearchResults
          searchQuery={searchQuery}
          searchResults={searchResults}
          isSearching={isSearching}
          addingTrackId={playlist.addingTrackId}
          addError={playlist.addError}
          onAddTrack={playlist.addTrack}
          onClearSearch={clearSearch}
        />

        <AnimatePresence mode="wait">
          {activeTab === 'playlist' ? (
            <motion.div key="playlist" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PlaylistView
                tracks={sessionState.tracks}
                isLoading={isLoadingPlaylist}
                isHost={sessionState.isHost}
                deletingTrackId={playlist.deletingTrackId}
                onDeleteTrack={playlist.deleteTrack}
                isUnavailable={playlistDeleted}
                onSelectNewPlaylist={() => {
                  clearUnavailableFlag();
                  setShowPlaylistPicker(true);
                }}
              />
            </motion.div>
          ) : (
            <motion.div key="participants" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ParticipantsList participants={sessionState.participants} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomBar
        isHost={sessionState.isHost}
        hasPlaylist={!!sessionState.tidalPlaylistId}
        onOpenInTidal={share.openInTidal}
      />

      <ShareModal
        isOpen={share.showShare}
        sessionId={sessionId}
        copied={share.copied}
        onClose={share.closeShareModal}
        onCopyLink={share.copyJoinUrl}
        onCopyCode={share.copyCode}
      />
    </div>
  );
}
