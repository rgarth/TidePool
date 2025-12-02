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
            <div
              style={{
                width: '100px',
                height: '100px',
                margin: '0 auto var(--space-lg)',
                borderRadius: '24px',
                background: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 50%, #000000 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Pixel art wave icon - centered: y spans 3-25 in 28-unit viewBox */}
              <svg width="56" height="56" viewBox="0 0 28 28" fill="white">
                {/* Top wave - pixel art squares */}
                <rect x="2" y="3" width="3" height="3" />
                <rect x="5" y="6" width="3" height="3" />
                <rect x="8" y="3" width="3" height="3" />
                <rect x="11" y="6" width="3" height="3" />
                <rect x="14" y="3" width="3" height="3" />
                <rect x="17" y="6" width="3" height="3" />
                <rect x="20" y="3" width="3" height="3" />
                <rect x="23" y="6" width="3" height="3" />
                {/* Middle wave */}
                <rect x="2" y="11" width="3" height="3" />
                <rect x="5" y="14" width="3" height="3" />
                <rect x="8" y="11" width="3" height="3" />
                <rect x="11" y="14" width="3" height="3" />
                <rect x="14" y="11" width="3" height="3" />
                <rect x="17" y="14" width="3" height="3" />
                <rect x="20" y="11" width="3" height="3" />
                <rect x="23" y="14" width="3" height="3" />
                {/* Bottom wave */}
                <rect x="2" y="19" width="3" height="3" />
                <rect x="5" y="22" width="3" height="3" />
                <rect x="8" y="19" width="3" height="3" />
                <rect x="11" y="22" width="3" height="3" />
                <rect x="14" y="19" width="3" height="3" />
                <rect x="17" y="22" width="3" height="3" />
                <rect x="20" y="19" width="3" height="3" />
                <rect x="23" y="22" width="3" height="3" />
              </svg>
            </div>
            
            <h1 style={{ 
              marginBottom: 'var(--space-sm)',
              fontFamily: 'var(--font-logo)',
              fontWeight: 200,
              fontSize: '3rem',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'white',
            }}>
              TidePool
            </h1>
            <p className="text-secondary" style={{ fontSize: '1.125rem' }}>
              Collaborative playlists for road trips
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
              <circle cx="12" cy="12" r="10" />
              <polygon points="10 8 16 12 10 16 10 8" />
            </svg>
            Host Playlist
          </Link>
          
          <Link to="/join" className="btn btn-secondary" style={{ padding: 'var(--space-lg) var(--space-xl)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Join Playlist
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
              <Step number={1} text="Host connects their Tidal account" />
              <Step number={2} text="Host creates or selects a playlist to share" />
              <Step number={3} text="Friends join with the code and add songs" />
              <Step number={4} text="Host plays the playlist in Tidal" />
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
          Powered by Tidal • Build playlists together
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
