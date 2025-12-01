import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export function HostPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreateSession = async () => {
    if (!name.trim()) {
      setError('Give your pool a name');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName: name.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data = await response.json();
      
      // Store host info in sessionStorage
      sessionStorage.setItem('userName', name.trim());
      sessionStorage.setItem('isHost', 'true');
      
      // Navigate to the session
      navigate(`/session/${data.sessionId}`);
    } catch (err) {
      setError('Failed to create session. Please try again.');
      setIsCreating(false);
    }
  };

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
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--bg-primary)' }}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              
              <h2 style={{ marginBottom: 'var(--space-sm)' }}>Start a Pool</h2>
              <p className="text-secondary">
                You'll be the DJ. Connect to the car stereo and let passengers queue songs.
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
                  Name this pool
                </label>
                <input
                  id="name"
                  type="text"
                  className="input input-lg"
                  placeholder="Vegas Road Trip, Lake House Weekend..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
                  autoFocus
                />
                <p className="text-muted" style={{ marginTop: 'var(--space-sm)', fontSize: '0.75rem' }}>
                  Trip name, destination, or your name
                </p>
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
                onClick={handleCreateSession}
                disabled={isCreating}
                style={{
                  padding: 'var(--space-lg)',
                  marginTop: 'var(--space-sm)',
                  opacity: isCreating ? 0.7 : 1,
                }}
              >
                {isCreating ? (
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
                    Creating...
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Create Session
                  </>
                )}
              </button>
            </div>
          </div>

          <p className="text-muted" style={{ marginTop: 'var(--space-xl)', fontSize: '0.875rem' }}>
            A unique code will be generated for others to join
          </p>
        </motion.div>
      </div>
    </div>
  );
}

