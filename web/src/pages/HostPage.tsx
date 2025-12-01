import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export function HostPage() {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if already logged in to Tidal
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/status', {
          credentials: 'include',
        });
        const data = await response.json();
        setIsAuthenticated(data.authenticated);
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        setIsChecking(false);
      }
    };
    checkAuth();
  }, []);

  const handleLoginAndCreate = async (forceReauth = false) => {
    // Create session first, then redirect to Tidal login
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName: '' }), // Will get random name
      });

      if (!response.ok) throw new Error('Failed to create session');

      const data = await response.json();
      
      // Store host info
      sessionStorage.setItem('userName', 'Host');
      sessionStorage.setItem('isHost', 'true');
      
      if (isAuthenticated && !forceReauth) {
        // Already logged in, go straight to session
        navigate(`/session/${data.sessionId}`);
      } else {
        // Need to login - redirect to Tidal auth
        window.location.href = `/api/auth/login?sessionId=${data.sessionId}`;
      }
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleReauth = () => {
    handleLoginAndCreate(true);
  };

  if (isChecking) {
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
      </div>
    );
  }

  return (
    <div className="page page-centered">
      <div className="container" style={{ maxWidth: '480px' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Back button */}
          <button
            onClick={() => navigate('/')}
            className="btn btn-ghost"
            style={{ marginBottom: 'var(--space-xl)', alignSelf: 'flex-start' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div className="card">
            <div style={{ marginBottom: 'var(--space-xl)' }}>
              {/* Tidal-style icon */}
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  margin: '0 auto var(--space-lg)',
                  borderRadius: '16px',
                  background: 'var(--gradient-glow)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--bg-primary)' }}>
                  <path d="M4 4L8 8L4 12L0 8ZM12 4L16 8L12 12L8 8ZM20 4L24 8L20 12L16 8ZM12 12L16 16L12 20L8 16Z"/>
                </svg>
              </div>
              
              <h2 style={{ marginBottom: 'var(--space-sm)' }}>Host a Playlist</h2>
              <p className="text-secondary">
                Connect your Tidal account to host a collaborative playlist session.
              </p>
            </div>

            {/* Tidal Connection Status */}
            <div
              style={{
                padding: 'var(--space-md)',
                marginBottom: 'var(--space-lg)',
                borderRadius: 'var(--radius-md)',
                background: isAuthenticated ? 'rgba(0, 180, 160, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${isAuthenticated ? 'rgba(0, 180, 160, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  {/* Status indicator */}
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: isAuthenticated ? '#00b4a0' : 'var(--text-muted)',
                      boxShadow: isAuthenticated ? '0 0 8px rgba(0, 180, 160, 0.5)' : 'none',
                    }}
                  />
                  <span style={{ 
                    fontWeight: 500,
                    color: isAuthenticated ? '#00b4a0' : 'var(--text-secondary)',
                  }}>
                    {isAuthenticated ? 'Connected to Tidal' : 'Not connected'}
                  </span>
                </div>
                {isAuthenticated && (
                  <button
                    onClick={handleReauth}
                    className="btn btn-ghost"
                    style={{ 
                      padding: '4px 8px', 
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Re-authenticate
                  </button>
                )}
              </div>
              {!isAuthenticated && (
                <p className="text-muted" style={{ marginTop: 'var(--space-sm)', fontSize: '0.8rem' }}>
                  You'll need to login to your Tidal account to host a playlist.
                </p>
              )}
            </div>

            <button
              className="btn btn-primary"
              onClick={() => handleLoginAndCreate()}
              style={{
                width: '100%',
                padding: 'var(--space-lg)',
              }}
            >
              {isAuthenticated ? (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="10 8 16 12 10 16 10 8" />
                  </svg>
                  Start Hosting
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px' }}>
                    <path d="M4 4L8 8L4 12L0 8ZM12 4L16 8L12 12L8 8ZM20 4L24 8L20 12L16 8ZM12 12L16 16L12 20L8 16Z"/>
                  </svg>
                  Connect Tidal Account
                </>
              )}
            </button>
          </div>

          <p className="text-muted" style={{ marginTop: 'var(--space-xl)', fontSize: '0.875rem' }}>
            {isAuthenticated 
              ? "You'll get a code to share with your friends"
              : "You'll be redirected to Tidal to authorize TidePool"
            }
          </p>
        </motion.div>
      </div>
    </div>
  );
}
