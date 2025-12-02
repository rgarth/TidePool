import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BackArrowIcon, MusicIcon, JoinIcon } from '../components/Icons';
import { API_URL } from '../config';

export function JoinPage() {
  const navigate = useNavigate();
  const { sessionId: urlSessionId } = useParams();
  
  const [name, setName] = useState('');
  const [sessionCode, setSessionCode] = useState(urlSessionId?.toUpperCase() || '');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  // Auto-uppercase the session code
  const handleCodeChange = (value: string) => {
    setSessionCode(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
  };

  const handleJoinSession = async () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (sessionCode.length !== 6) {
      setError('Session code must be 6 characters');
      return;
    }

    setIsJoining(true);
    setError('');

    try {
      // Verify the session exists
      const response = await fetch(`${API_URL}/api/sessions/${sessionCode}`);
      
      if (!response.ok) {
        throw new Error('Session not found');
      }

      // Store user info
      sessionStorage.setItem('userName', name.trim());
      sessionStorage.setItem('isHost', 'false');
      
      // Navigate to the session
      navigate(`/session/${sessionCode}`);
    } catch (err) {
      setError('Playlist not found. Check the code and try again.');
      setIsJoining(false);
    }
  };

  // If we came from a direct link, pre-fill the code
  useEffect(() => {
    if (urlSessionId) {
      setSessionCode(urlSessionId.toUpperCase());
    }
  }, [urlSessionId]);

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
            <BackArrowIcon size={20} />
            Back
          </button>

          <div className="card">
            <div style={{ marginBottom: 'var(--space-xl)' }}>
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
                <MusicIcon size={32} style={{ color: 'var(--bg-primary)' }} />
              </div>
              
              <h2 style={{ marginBottom: 'var(--space-sm)' }}>Join Playlist</h2>
              <p className="text-secondary">
                Enter the 6-letter code to start adding songs
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div>
                <label
                  htmlFor="name"
                  style={{
                    display: 'block',
                    marginBottom: 'var(--space-sm)',
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Your Name
                </label>
                <input
                  id="name"
                  type="text"
                  className="input"
                  placeholder="Enter your name..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus={!urlSessionId}
                />
              </div>

              <div>
                <label
                  htmlFor="code"
                  style={{
                    display: 'block',
                    marginBottom: 'var(--space-sm)',
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Playlist Code
                </label>
                <input
                  id="code"
                  type="text"
                  className="input"
                  placeholder="ABC123"
                  value={sessionCode}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinSession()}
                  autoFocus={!!urlSessionId}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '1.5rem',
                    letterSpacing: '0.2em',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                  }}
                />
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    color: 'var(--accent-magenta)',
                    fontSize: '0.875rem',
                    textAlign: 'center',
                  }}
                >
                  {error}
                </motion.p>
              )}

              <button
                className="btn btn-primary"
                onClick={handleJoinSession}
                disabled={isJoining}
                style={{
                  padding: 'var(--space-lg)',
                  marginTop: 'var(--space-sm)',
                  opacity: isJoining ? 0.7 : 1,
                }}
              >
                {isJoining ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      style={{
                        width: '20px',
                        height: '20px',
                        border: '2px solid transparent',
                        borderTopColor: 'currentColor',
                        borderRadius: '50%',
                      }}
                    />
                    Joining...
                  </>
                ) : (
                  <>
                    <JoinIcon size={20} />
                    Join
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
