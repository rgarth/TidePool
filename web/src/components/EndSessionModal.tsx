import { motion, AnimatePresence } from 'framer-motion';
import { CloseIcon, WarningIcon } from './Icons';

interface EndSessionModalProps {
  isOpen: boolean;
  sessionCode: string;
  onClose: () => void;
  onConfirm: () => void;
  isEnding?: boolean;
}

export function EndSessionModal({ isOpen, sessionCode, onClose, onConfirm, isEnding }: EndSessionModalProps) {
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
            className="modal modal-sm"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={onClose}>
              <CloseIcon size={20} />
            </button>
            
            <div className="flex justify-center mb-lg">
              <div className="flex items-center justify-center" style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
              }}>
                <WarningIcon size={28} color="var(--text-error)" />
              </div>
            </div>
            
            <h3 className="text-center mb-sm">End Session?</h3>
            
            <p className="text-secondary text-center mb-lg">
              This will permanently end session <code className="text-accent">{sessionCode}</code>. 
              All participants will be disconnected and won't be able to add songs anymore.
            </p>
            
            <p className="text-muted text-sm text-center mb-xl">
              The Tidal playlist will remain in your library — only the TidePool session ends.
            </p>
            
            <div className="flex gap-sm">
              <button 
                className="btn btn-secondary flex-1" 
                onClick={onClose}
                disabled={isEnding}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger flex-1" 
                onClick={onConfirm}
                disabled={isEnding}
              >
                {isEnding ? 'Ending...' : 'End Session'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

