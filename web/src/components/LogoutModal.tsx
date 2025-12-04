import { motion, AnimatePresence } from 'framer-motion';
import { LogoutIcon } from './Icons';

interface LogoutModalProps {
  isOpen: boolean;
  isLoggingOut: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function LogoutModal({ isOpen, isLoggingOut, onClose, onConfirm }: LogoutModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative' }}
          >
            {/* Icon */}
            <div className="flex justify-center mb-lg">
              <div className="flex items-center justify-center" style={{
                width: 64,
                height: 64,
                borderRadius: 'var(--radius-full)',
                background: 'rgba(255, 107, 107, 0.15)',
                color: 'var(--color-error)',
              }}>
                <LogoutIcon size={32} />
              </div>
            </div>

            <h3 className="text-center mb-sm">Disconnect from Tidal?</h3>
            
            <p className="text-secondary text-center mb-lg">
              This will log you out and end your session.
            </p>
            
            <div className="session-info-box mb-xl">
              <p className="text-muted text-sm">
                <strong style={{ color: 'var(--text-secondary)' }}>What happens:</strong>
              </p>
              <ul className="text-muted text-sm mt-sm" style={{ paddingLeft: '1.25rem', margin: 0 }}>
                <li>Anyone with the invite link will no longer be able to add songs</li>
                <li>The playlist itself remains in your Tidal account</li>
                <li>You can start a new session anytime</li>
              </ul>
            </div>

            <div className="flex flex-col gap-sm">
              <button
                className="btn btn-block"
                onClick={onConfirm}
                disabled={isLoggingOut}
                style={{
                  background: 'var(--color-error)',
                  color: 'white',
                }}
              >
                {isLoggingOut ? 'Logging out...' : 'Yes, disconnect'}
              </button>
              <button
                className="btn btn-secondary btn-block"
                onClick={onClose}
                disabled={isLoggingOut}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

