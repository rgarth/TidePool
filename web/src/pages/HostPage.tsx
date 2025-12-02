import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { BackArrowIcon, TidalLogo, PlayCircleIcon } from '../components/Icons';
import { PageSpinner } from '../components/Spinner';
import { API_URL } from '../config';

export function HostPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isChecking } = useAuth();

  const handleLoginAndCreate = async (forceReauth = false) => {
    try {
      const response = await fetch(`${API_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName: '' }),
      });

      if (!response.ok) throw new Error('Failed to create session');

      const data = await response.json();
      
      sessionStorage.setItem('userName', 'Host');
      sessionStorage.setItem('isHost', 'true');
      
      if (isAuthenticated && !forceReauth) {
        navigate(`/session/${data.sessionId}`);
      } else {
        window.location.href = `${API_URL}/api/auth/login?sessionId=${data.sessionId}`;
      }
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
          {/* Back button */}
          <button onClick={() => navigate('/')} className="btn btn-ghost mb-xl">
            <BackArrowIcon size={20} />
            Back
          </button>

          <div className="card text-center">
            {/* Tidal icon */}
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
              Connect your Tidal account to host a collaborative playlist session.
            </p>

            {/* Connection Status */}
            <div className={`card card-compact mb-lg ${isAuthenticated ? '' : ''}`} style={{
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
                  <button
                    onClick={() => handleLoginAndCreate(true)}
                    className="btn btn-ghost btn-sm text-muted"
                  >
                    Re-auth
                  </button>
                )}
              </div>
              {!isAuthenticated && (
                <p className="text-muted text-sm mt-sm" style={{ textAlign: 'left' }}>
                  You'll need to login to your Tidal account to host a playlist.
                </p>
              )}
            </div>

            <button
              className="btn btn-primary btn-lg btn-block"
              onClick={() => handleLoginAndCreate()}
            >
              {isAuthenticated ? (
                <>
                  <PlayCircleIcon size={20} />
                  Start Hosting
                </>
              ) : (
                <>
                  <TidalLogo size={20} />
                  Connect Tidal Account
                </>
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
    </div>
  );
}
