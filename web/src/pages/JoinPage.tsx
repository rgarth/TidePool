import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BackArrowIcon, MusicIcon, JoinIcon } from '../components/Icons';
import { Spinner } from '../components/Spinner';
import { API_URL } from '../config';

export function JoinPage() {
  const navigate = useNavigate();
  const { sessionId: urlSessionId } = useParams();
  
  const [name, setName] = useState('');
  const [sessionCode, setSessionCode] = useState(urlSessionId?.toUpperCase() || '');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleCodeChange = (value: string) => {
    setSessionCode(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
  };

  const handleNameChange = (value: string) => {
    // Limit length and remove control characters
    const sanitized = value
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control chars
      .slice(0, 50);
    setName(sanitized);
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
      const response = await fetch(`${API_URL}/api/sessions/${sessionCode}`);
      
      if (!response.ok) {
        throw new Error('Session not found');
      }

      sessionStorage.setItem('userName', name.trim());
      sessionStorage.setItem('isHost', 'false');
      navigate(`/session/${sessionCode}`);
    } catch (err) {
      setError('Playlist not found. Check the code and try again.');
      setIsJoining(false);
    }
  };

  useEffect(() => {
    if (urlSessionId) {
      setSessionCode(urlSessionId.toUpperCase());
    }
  }, [urlSessionId]);

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
            {/* Music icon */}
            <div className="flex justify-center mb-lg">
              <div className="flex items-center justify-center" style={{
                width: 64,
                height: 64,
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-teal))',
              }}>
                <MusicIcon size={32} color="var(--bg-primary)" />
              </div>
            </div>
            
            <h2 className="mb-sm">Join Playlist</h2>
            <p className="text-secondary mb-xl">
              Enter the 6-letter code to start adding songs
            </p>

            <div className="flex flex-col gap-md" style={{ textAlign: 'left' }}>
              <div>
                <label htmlFor="code" className="text-secondary text-sm mb-sm" style={{ display: 'block' }}>
                  Playlist Code
                </label>
                <input
                  id="code"
                  type="text"
                  className="input text-center text-mono"
                  placeholder="ABC123"
                  value={sessionCode}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && nameInputRef.current?.focus()}
                  autoFocus={!urlSessionId}
                  style={{
                    fontSize: '1.5rem',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                  }}
                />
              </div>

              <div>
                <label htmlFor="name" className="text-secondary text-sm mb-sm" style={{ display: 'block' }}>
                  Your Name
                </label>
                <input
                  ref={nameInputRef}
                  id="name"
                  type="text"
                  className="input"
                  placeholder="Enter your name..."
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinSession()}
                  maxLength={50}
                  autoFocus={!!urlSessionId}
                />
              </div>

              {error && (
                <motion.p
                  className="text-error text-sm text-center"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {error}
                </motion.p>
              )}

              <button
                className="btn btn-primary btn-lg btn-block mt-sm"
                onClick={handleJoinSession}
                disabled={isJoining}
              >
                {isJoining ? (
                  <>
                    <Spinner size={20} />
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
