import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';

interface ShareModalProps {
  isOpen: boolean;
  sessionId?: string;
  copied: boolean;
  onClose: () => void;
  onCopyLink: () => void;
}

export function ShareModal({ isOpen, sessionId, copied, onClose, onCopyLink }: ShareModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: 'var(--space-lg)',
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{ maxWidth: '400px', width: '100%', padding: 'var(--space-xl)' }}
          >
            <h3 style={{ marginBottom: 'var(--space-lg)', textAlign: 'center' }}>Invite Friends</h3>
            
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-lg)' }}>
              <QRCodeSVG
                value={`${window.location.origin}/join/${sessionId}`}
                size={180}
                bgColor="transparent"
                fgColor="#22d3ee"
              />
            </div>
            
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
              <p className="text-secondary" style={{ marginBottom: 'var(--space-sm)' }}>Code</p>
              <code style={{ fontSize: '2rem', letterSpacing: '0.2em', fontWeight: '700', color: 'var(--accent-cyan)' }}>
                {sessionId}
              </code>
            </div>
            
            <button onClick={onCopyLink} className="btn btn-primary" style={{ width: '100%' }}>
              {copied ? 'Copied!' : 'Copy Invite Link'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

