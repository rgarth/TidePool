import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { BackArrowIcon, TidalLogo, PlayCircleIcon, ReloadIcon, CloseIcon, WarningIcon, LinkIcon, CopyIcon, CheckIcon, TrashIcon } from './Icons';
import { PageSpinner } from './Spinner';
import { EndSessionModal } from './EndSessionModal';
import { API_URL, apiFetch, clearHostToken, setHostToken } from '../config';

interface ExistingSession {
  id: string;
  name: string;
  playlistName?: string;
  playlistId?: string;
  trackCount: number;
  participantCount: number;
  createdAt: string;
}

export function SessionPickerView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Check for auth callback params
  const authSuccess = searchParams.get('auth') === 'success';
  const urlToken = searchParams.get('token');
  
  // Delay auth check slightly if we just got a token from URL
  const { isAuthenticated, isChecking, hostToken, username } = useAuth({
    delayCheck: authSuccess && urlToken ? 100 : 0
  });
  const [existingSessions, setExistingSessions] = useState<ExistingSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [hubCopied, setHubCopied] = useState(false);
  const [sessionToEnd, setSessionToEnd] = useState<ExistingSession | null>(null);
  const [isEndingSession, setIsEndingSession] = useState(false);
  
  // Hidden feature: ?resume=CODE allows reusing a session code after server restart
  const resumeCode = searchParams.get('resume');
  
  // Extract and store token from URL (for cross-origin auth)
  useEffect(() => {
    if (authSuccess && urlToken) {
      setHostToken(urlToken);
      // Clean up URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('token');
      newParams.delete('auth');
      const newUrl = newParams.toString() ? `/session?${newParams.toString()}` : '/session';
      navigate(newUrl, { replace: true });
    }
  }, [authSuccess, urlToken, navigate, searchParams]);

  // Fetch existing sessions when authenticated
  useEffect(() => {
    if (isAuthenticated && hostToken) {
      setIsLoadingSessions(true);
      fetch(`${API_URL}/api/sessions/mine`, {
        headers: {
          'X-Host-Token': hostToken,
        },
        credentials: 'include',
      })
        .then(res => res.json())
        .then(data => {
          setExistingSessions(data.sessions || []);
        })
        .catch(err => {
          console.error('Failed to fetch sessions:', err);
        })
        .finally(() => {
          setIsLoadingSessions(false);
        });
    }
  }, [isAuthenticated, hostToken]);

  const handleResumeSession = (sessionId: string) => {
    sessionStorage.setItem('userName', 'Host');
    sessionStorage.setItem('isHost', 'true');
    navigate(`/session/${sessionId}`);
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Disconnect failed:', err);
    }
    clearHostToken();
    setExistingSessions([]);
    setShowDisconnectModal(false);
    window.location.reload();
  };

  const handleEndSession = async () => {
    if (!sessionToEnd) return;
    setIsEndingSession(true);
    try {
      await apiFetch(`/api/sessions/${sessionToEnd.id}`, { method: 'DELETE' });
      setExistingSessions(prev => prev.filter(s => s.id !== sessionToEnd.id));
    } catch (err) {
      console.error('Failed to end session:', err);
    } finally {
      setIsEndingSession(false);
      setSessionToEnd(null);
    }
  };

  const hubUrl = username ? `${window.location.origin}/u/${username}` : null;
  
  const copyHubUrl = async () => {
    if (!hubUrl) return;
    try {
      await navigator.clipboard.writeText(hubUrl);
      setHubCopied(true);
      setTimeout(() => setHubCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCreateNew = async (forceReauth = false) => {
    // If not authenticated, just redirect to OAuth without creating a session first
    // After OAuth, user will land back at /session and can see their existing sessions
    if (!isAuthenticated || forceReauth) {
      sessionStorage.setItem('userName', 'Host');
      sessionStorage.setItem('isHost', 'true');
      window.location.href = `${API_URL}/api/auth/login`;
      return;
    }
    
    // Already authenticated - create session and navigate
    try {
      const response = await fetch(`${API_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          hostName: '',
          resumeCode: resumeCode || undefined,
        }),
      });

      if (!response.ok) throw new Error('Failed to create session');

      const data = await response.json();
      
      sessionStorage.setItem('userName', 'Host');
      sessionStorage.setItem('isHost', 'true');
      navigate(`/session/${data.sessionId}`);
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  if (isChecking) {
    return <PageSpinner />;
  }

  return (
    <div className="page page-centered">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <button onClick={() => navigate('/')} className="btn btn-ghost mb-xl">
            <BackArrowIcon size={20} />
            Back
          </button>

          <div className="card text-center">
            <div className="flex justify-center mb-lg">
              <div className="flex items-center justify-center" style={{
                width: 64,
                height: 64,
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-teal))',
              }}>
                <TidalLogo size={32} color="var(--bg-primary)" />
              </div>
            </div>
            
            <h2 className="mb-sm">Host a Playlist</h2>
            <p className="text-secondary mb-xl">
              {isAuthenticated 
                ? 'Resume an existing session or start a new one'
                : 'Connect your Tidal account to host a collaborative playlist session.'
              }
            </p>

            {/* Connection Status */}
            <div className="card card-compact mb-lg" style={{
              background: isAuthenticated ? 'rgba(0, 180, 160, 0.1)' : 'rgba(255, 255, 255, 0.03)',
              borderColor: isAuthenticated ? 'rgba(0, 180, 160, 0.3)' : 'rgba(255, 255, 255, 0.1)',
            }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-sm">
                  <div style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: isAuthenticated ? '#00b4a0' : 'var(--text-muted)',
                    boxShadow: isAuthenticated ? '0 0 8px rgba(0, 180, 160, 0.5)' : 'none',
                  }} />
                  <span className="text-medium" style={{ 
                    color: isAuthenticated ? '#00b4a0' : 'var(--text-secondary)',
                  }}>
                    {isAuthenticated ? 'Connected to Tidal' : 'Not connected'}
                  </span>
                </div>
                {isAuthenticated && (
                  <div className="flex gap-xs">
                    <button
                      onClick={() => handleCreateNew(true)}
                      className="btn btn-ghost btn-sm text-muted"
                    >
                      Re-auth
                    </button>
                    <button
                      onClick={() => setShowDisconnectModal(true)}
                      className="btn btn-ghost btn-sm text-muted"
                    >
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
              {!isAuthenticated && (
                <p className="text-muted text-sm mt-sm" style={{ textAlign: 'left' }}>
                  You'll need to login to your Tidal account to host a playlist.
                </p>
              )}
            </div>

            {/* Existing Sessions */}
            {isAuthenticated && existingSessions.length > 0 && (
              <div className="mb-lg">
                <p className="text-secondary text-sm mb-sm" style={{ textAlign: 'left' }}>
                  Your active sessions
                </p>
                <div className="flex flex-col gap-sm">
                  {existingSessions.map((session) => (
                    <div key={session.id} className="session-list-item">
                      <button
                        className="session-list-item-main"
                        onClick={() => handleResumeSession(session.id)}
                      >
                        <ReloadIcon size={18} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="truncate text-medium">{session.name}</div>
                          <div className="text-muted text-xs" style={{ marginTop: 2 }}>
                            Code: {session.id} · {session.trackCount} tracks
                          </div>
                        </div>
                      </button>
                      <button
                        className="session-list-item-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSessionToEnd(session);
                        }}
                        title="End session"
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                
                <div className="flex items-center gap-md mt-lg">
                  <div className="flex-1" style={{ height: 1, background: 'var(--bg-elevated)' }} />
                  <span className="text-muted text-sm">or</span>
                  <div className="flex-1" style={{ height: 1, background: 'var(--bg-elevated)' }} />
                </div>
              </div>
            )}

            {isLoadingSessions && isAuthenticated && (
              <p className="text-muted text-sm mb-lg">Checking for active sessions...</p>
            )}

            {/* Share session hub */}
            {isAuthenticated && username && existingSessions.length > 0 && (
              <div className="hub-share-box mb-lg">
                <div className="flex items-center gap-sm mb-sm">
                  <LinkIcon size={16} />
                  <span className="text-secondary text-sm">Share all your sessions</span>
                </div>
                <div className="flex gap-sm">
                  <input
                    type="text"
                    className="input flex-1 text-sm"
                    value={hubUrl || ''}
                    readOnly
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                  <button
                    className="btn btn-secondary"
                    onClick={copyHubUrl}
                    style={{ minWidth: 80 }}
                  >
                    {hubCopied ? (
                      <><CheckIcon size={16} /> Copied</>
                    ) : (
                      <><CopyIcon size={16} /> Copy</>
                    )}
                  </button>
                </div>
                <p className="text-muted text-xs mt-sm">
                  Anyone with this link can see and join any of your active sessions
                </p>
              </div>
            )}

            <button
              className="btn btn-primary btn-lg btn-block"
              onClick={() => handleCreateNew()}
            >
              {isAuthenticated ? (
                <><PlayCircleIcon size={20} /> Start New Session</>
              ) : (
                <><TidalLogo size={20} /> Connect Tidal Account</>
              )}
            </button>
          </div>

          <p className="text-muted text-sm text-center mt-xl">
            {isAuthenticated 
              ? "You'll get a code to share with your friends"
              : "You'll be redirected to Tidal to authorize TidePool"
            }
          </p>
        </motion.div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showDisconnectModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDisconnectModal(false)}
          >
            <motion.div
              className="modal modal-sm"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button className="modal-close" onClick={() => setShowDisconnectModal(false)}>
                <CloseIcon size={20} />
              </button>
              
              <div className="flex justify-center mb-lg">
                <div className="flex items-center justify-center" style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.15)',
                }}>
                  <WarningIcon size={28} color="var(--text-error)" />
                </div>
              </div>
              
              <h3 className="text-center mb-sm">Disconnect from Tidal?</h3>
              <p className="text-secondary text-center mb-lg">
                All your active TidePool sessions will end immediately.
              </p>
              <p className="text-muted text-sm text-center mb-xl">
                Your Tidal playlists will remain in your library.
              </p>
              
              <div className="flex gap-sm">
                <button className="btn btn-secondary flex-1" onClick={() => setShowDisconnectModal(false)} disabled={isDisconnecting}>
                  Cancel
                </button>
                <button className="btn btn-danger flex-1" onClick={handleDisconnect} disabled={isDisconnecting}>
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>

      <EndSessionModal
        isOpen={!!sessionToEnd}
        sessionCode={sessionToEnd?.id || ''}
        sessionName={sessionToEnd?.name}
        isEnding={isEndingSession}
        onClose={() => setSessionToEnd(null)}
        onConfirm={handleEndSession}
      />
    </div>
  );
}

