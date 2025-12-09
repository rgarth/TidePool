import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../hooks/useSocket';
import { useSearch } from '../hooks/useSearch';
import { useAuth } from '../hooks/useAuth';
import { usePlaylistActions } from '../hooks/usePlaylistActions';
import { useShare } from '../hooks/useShare';
import { PlaylistPicker } from '../components/PlaylistPicker';
import { SessionPickerView } from '../components/SessionPickerView';
import { SessionHeader } from '../components/SessionHeader';
import { SearchResults } from '../components/SearchResults';
import { PlaylistView } from '../components/PlaylistView';
import { ParticipantsList } from '../components/ParticipantsList';
import { ShareModal } from '../components/ShareModal';
import { LogoutModal } from '../components/LogoutModal';
import { EditPlaylistModal } from '../components/EditPlaylistModal';
import { EndSessionModal } from '../components/EndSessionModal';
import { BottomBar } from '../components/BottomBar';
import { PageSpinner } from '../components/Spinner';
import { setHostToken, clearHostToken, apiFetch } from '../config';

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
    sessionExpired,
    joinSession,
    setPlaylist,
    startLoading,
    clearUnavailableFlag,
  } = useSocket();

  // Search functionality - use empty string when no sessionId
  const { searchQuery, setSearchQuery, searchResults, isSearching, clearSearch } = useSearch(sessionId || '');
  
  // UI state
  const [activeTab, setActiveTab] = useState<'playlist' | 'participants'>('playlist');
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [userDescription, setUserDescription] = useState('');
  const [isCancellingSession, setIsCancellingSession] = useState(false);
  
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

  // Handle logout
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
      clearHostToken();
      navigate('/');
    } catch (err) {
      console.error('Logout failed:', err);
      // Navigate anyway - token is cleared locally
      clearHostToken();
      navigate('/');
    }
  };

  // Handle end session
  const handleEndSession = async () => {
    setIsEndingSession(true);
    try {
      await apiFetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      navigate('/');
    } catch (err) {
      console.error('Failed to end session:', err);
      // Navigate anyway
      navigate('/');
    }
  };

  // Handle cancel new session (before playlist is set)
  const handleCancelSession = async () => {
    setIsCancellingSession(true);
    try {
      await apiFetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
    navigate('/session');
  };

  // Handle playlist edit (name and description)
  const handleEditPlaylist = async (name: string, description: string) => {
    if (!sessionState?.tidalPlaylistId) return;
    
    setIsSavingEdit(true);
    try {
      const response = await apiFetch(`/api/tidal/playlists/${sessionState.tidalPlaylistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          userDescription: description,
          sessionId,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update playlist');
      }
      
      // Store description locally for future edits
      setUserDescription(description);
      if (sessionId) {
        sessionStorage.setItem(`tidepool_desc_${sessionId}`, description);
      }
      
      setShowEditModal(false);
    } catch (err) {
      console.error('Failed to update playlist:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Load user description from sessionStorage
  useEffect(() => {
    if (sessionId) {
      const saved = sessionStorage.getItem(`tidepool_desc_${sessionId}`);
      if (saved) {
        setUserDescription(saved);
      }
    }
  }, [sessionId]);

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

  // If no sessionId, show the picker view (must be after all hooks)
  if (!sessionId) {
    return <SessionPickerView />;
  }

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
        existingPlaylistId={playlist.existingPlaylistId}
        newPlaylistName={playlist.newPlaylistName}
        existingPlaylistError={playlist.existingPlaylistError}
        isLoadingExisting={playlist.isLoadingExisting}
        isCreatingPlaylist={playlist.isCreatingPlaylist}
        hasLinkedPlaylist={!!sessionState.tidalPlaylistId}
        isCancelling={isCancellingSession}
        onClose={() => setShowPlaylistPicker(false)}
        onCancel={handleCancelSession}
        onCreateNewPlaylist={async () => {
          const success = await playlist.createPlaylist();
          if (success) setShowPlaylistPicker(false);
        }}
        onUseExistingPlaylist={async () => {
          const success = await playlist.loadExistingPlaylist();
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
        searchDisabled={playlistDeleted || !!sessionExpired}
        onRefresh={playlist.refreshPlaylist}
        onChangeSession={() => navigate('/session')}
        onShare={share.openShareModal}
        onEndSession={() => setShowEndSessionModal(true)}
        onLogout={() => setShowLogoutModal(true)}
        onEdit={() => setShowEditModal(true)}
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
                sessionExpired={sessionExpired}
                onSelectNewPlaylist={() => {
                  clearUnavailableFlag();
                  navigate('/session');
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
        isPublic={sessionState.isPublic ?? true}
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

      <LogoutModal
        isOpen={showLogoutModal}
        isLoggingOut={isLoggingOut}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
      />

      <EditPlaylistModal
        isOpen={showEditModal}
        currentName={sessionState.name}
        currentDescription={userDescription}
        isSaving={isSavingEdit}
        onClose={() => setShowEditModal(false)}
        onSave={handleEditPlaylist}
      />

      <EndSessionModal
        isOpen={showEndSessionModal}
        sessionCode={sessionId || ''}
        isEnding={isEndingSession}
        onClose={() => setShowEndSessionModal(false)}
        onConfirm={handleEndSession}
      />
    </div>
  );
}
