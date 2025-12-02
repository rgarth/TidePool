import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { WaveLogoIcon, PlayCircleIcon, JoinIcon } from '../components/Icons';

export function HomePage() {
  return (
    <div className="page page-centered">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {/* Logo / Brand */}
          <div className="mb-xl text-center">
            <div className="flex justify-center mb-lg">
              <div className="flex items-center justify-center" style={{
                width: 100,
                height: 100,
                borderRadius: 'var(--radius-xl)',
                background: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 50%, #000 100%)',
              }}>
                <WaveLogoIcon size={56} />
              </div>
            </div>
            
            <h1 style={{ 
              fontWeight: 200,
              fontSize: '2.5rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}>
              TidePool
            </h1>
            <p className="text-secondary text-lg mt-sm">
              Collaborative playlists for road trips
            </p>
          </div>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          className="flex flex-col gap-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
        >
          <Link to="/host" className="btn btn-primary btn-lg btn-block">
            <PlayCircleIcon size={22} />
            Host Playlist
          </Link>
          
          <Link to="/join" className="btn btn-secondary btn-lg btn-block">
            <JoinIcon size={22} />
            Join Playlist
          </Link>
        </motion.div>

        {/* Info text */}
        <motion.div
          className="mt-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <div className="card">
            <h3 className="mb-md">How it works</h3>
            <div className="flex flex-col gap-md" style={{ textAlign: 'left' }}>
              <Step number={1} text="Host connects their Tidal account" />
              <Step number={2} text="Host creates or selects a playlist to share" />
              <Step number={3} text="Friends join with the code and add songs" />
              <Step number={4} text="Host plays the playlist in Tidal" />
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.p
          className="text-muted text-sm text-center mt-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          Powered by Tidal • Build playlists together
        </motion.p>
      </div>
    </div>
  );
}

function Step({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex items-start gap-md">
      <div className="flex-shrink-0 flex items-center justify-center text-sm text-bold text-accent" style={{
        width: 28,
        height: 28,
        borderRadius: 'var(--radius-full)',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--accent-cyan)',
      }}>
        {number}
      </div>
      <p className="text-secondary" style={{ marginTop: 2 }}>{text}</p>
    </div>
  );
}
