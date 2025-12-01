import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export function HomePage() {
  return (
    <div className="page page-centered">
      <div className="container" style={{ maxWidth: '600px' }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {/* Logo / Brand */}
          <div style={{ marginBottom: 'var(--space-xl)' }}>
            <motion.div
              animate={{ 
                boxShadow: [
                  '0 0 30px rgba(0, 180, 216, 0.3)',
                  '0 0 50px rgba(0, 180, 216, 0.5), 0 0 80px rgba(0, 119, 182, 0.4)',
                  '0 0 30px rgba(0, 180, 216, 0.3)',
                ]
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                width: '100px',
                height: '100px',
                margin: '0 auto var(--space-lg)',
                borderRadius: '24px',
                background: 'linear-gradient(135deg, #00b4d8 0%, #0077b6 50%, #023e8a 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Wave/tidepool icon */}
              <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'white' }}>
                <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
                <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
                <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
              </svg>
            </motion.div>
            
            <h1 style={{ marginBottom: 'var(--space-sm)' }}>
              Tide<span style={{ color: '#00b4d8' }}>Pool</span>
            </h1>
            <p className="text-secondary" style={{ fontSize: '1.125rem' }}>
              Road trips, together. Everyone picks the music.
            </p>
          </div>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
        >
          <Link to="/host" className="btn btn-primary" style={{ padding: 'var(--space-lg) var(--space-xl)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Start a Session
          </Link>
          
          <Link to="/join" className="btn btn-secondary" style={{ padding: 'var(--space-lg) var(--space-xl)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Join Session
          </Link>
        </motion.div>

        {/* Info text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          style={{ marginTop: 'var(--space-2xl)' }}
        >
          <div className="card" style={{ padding: 'var(--space-lg)' }}>
            <h3 style={{ marginBottom: 'var(--space-md)', color: 'var(--text-primary)' }}>
              How it works
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', textAlign: 'left' }}>
              <Step number={1} text="Driver starts a session and connects to car stereo" />
              <Step number={2} text="Passengers join with a 6-letter code" />
              <Step number={3} text="Everyone searches and adds songs to the queue" />
              <Step number={4} text="Music plays through the driver's phone" />
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-muted"
          style={{ marginTop: 'var(--space-2xl)', fontSize: '0.875rem' }}
        >
          Powered by Tidal • No more "pass the aux"
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="text-muted"
          style={{ marginTop: 'var(--space-sm)', fontSize: '0.75rem', opacity: 0.6 }}
        >
          🌊 TidePool
        </motion.p>
      </div>
    </div>
  );
}

function Step({ number, text }: { number: number; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)' }}>
      <div
        style={{
          width: '28px',
          height: '28px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--accent-cyan)',
          color: 'var(--accent-cyan)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.875rem',
          fontWeight: '600',
          flexShrink: 0,
        }}
      >
        {number}
      </div>
      <p className="text-secondary" style={{ marginTop: '2px' }}>{text}</p>
    </div>
  );
}

