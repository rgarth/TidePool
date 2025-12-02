import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { WaveLogoIcon, PlayCircleIcon, JoinIcon } from '../components/Icons';

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
              <WaveLogoIcon size={56} />
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
            <PlayCircleIcon size={24} />
            Host Playlist
          </Link>
          
          <Link to="/join" className="btn btn-secondary" style={{ padding: 'var(--space-lg) var(--space-xl)' }}>
            <JoinIcon size={24} />
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
