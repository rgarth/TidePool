import { motion } from 'framer-motion';
import { SpinnerIcon } from './Icons';

interface SpinnerProps {
  size?: number;
  /** Duration of one full rotation in seconds */
  duration?: number;
}

/**
 * Animated rotating spinner.
 * Uses SpinnerIcon with continuous rotation animation.
 */
export function Spinner({ size = 24, duration = 1 }: SpinnerProps) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration, repeat: Infinity, ease: 'linear' }}
      style={{ display: 'inline-flex' }}
    >
      <SpinnerIcon size={size} />
    </motion.div>
  );
}

/**
 * Full-page loading spinner (centered).
 */
export function PageSpinner() {
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

