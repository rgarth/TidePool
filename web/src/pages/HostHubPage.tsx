import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BackArrowIcon, MusicNoteIcon } from '../components/Icons';
import { PageSpinner } from '../components/Spinner';
import { API_URL } from '../config';

interface HostSession {
  id: string;
  name: string;
  trackCount: number;
}

interface HostInfo {
  username: string | null;
}

export function HostHubPage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  
  const [host, setHost] = useState<HostInfo | null>(null);
  const [sessions, setSessions] = useState<HostSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;
    
    const fetchHostSessions = async () => {
      try {
        const response = await fetch(`${API_URL}/api/sessions/host/${encodeURIComponent(username)}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Host not found');
          } else {
            setError('Failed to load sessions');
          }
          return;
        }
        
        const data = await response.json();
        setHost(data.host);
        setSessions(data.sessions);
      } catch (err) {
        console.error('Failed to fetch host sessions:', err);
        setError('Failed to load sessions');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchHostSessions();
  }, [username]);

  const handleJoinSession = (sessionId: string) => {
    navigate(`/join/${sessionId}`);
  };

  if (isLoading) {
    return <PageSpinner />;
  }

  if (error) {
    return (
      <div className="page page-centered">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <button onClick={() => navigate('/')} className="btn btn-ghost mb-xl">
              <BackArrowIcon size={20} />
              Back
            </button>
            
            <div className="card text-center">
              <h2 className="mb-sm">Oops!</h2>
              <p className="text-secondary">{error}</p>
            </div>
          </motion.div>
        </div>
      </div>
    );
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

          <div className="card">
            <div className="text-center mb-xl">
              <h2 className="mb-xs">
                {host?.username ? `${host.username}'s Sessions` : 'Active Sessions'}
              </h2>
              <p className="text-secondary">
                Choose a session to join and start adding songs
              </p>
            </div>

            {sessions.length === 0 ? (
              <div className="text-center py-xl">
                <p className="text-muted">No active sessions right now</p>
                <p className="text-muted text-sm mt-sm">
                  Check back later or ask the host to start a session
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-md">
                {sessions.map((session, index) => (
                  <motion.button
                    key={session.id}
                    className="session-card"
                    onClick={() => handleJoinSession(session.id)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="session-card-icon">
                      <MusicNoteIcon size={24} />
                    </div>
                    <div className="session-card-info">
                      <div className="session-card-name">{session.name}</div>
                      <div className="session-card-meta">
                        {session.trackCount} {session.trackCount === 1 ? 'track' : 'tracks'}
                      </div>
                    </div>
                    <div className="session-card-arrow">→</div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

