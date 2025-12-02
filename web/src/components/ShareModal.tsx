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
  const copyCode = () => {
    if (sessionId) {
      navigator.clipboard.writeText(sessionId);
    }
  };

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
            className="modal text-center"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-lg">Invite Friends</h3>
            
            <div className="flex justify-center mb-lg">
              <QRCodeSVG
                value={`${window.location.origin}/join/${sessionId}`}
                size={160}
                bgColor="transparent"
                fgColor="#3ee0f5"
              />
            </div>
            
            <p className="text-secondary text-sm mb-xs">Code</p>
            <code 
              className="session-code-lg mb-lg" 
              style={{ display: 'inline-block', cursor: 'pointer' }}
              onClick={copyCode}
            >
              {sessionId}
            </code>
            
            <button className="btn btn-primary btn-block mt-lg" onClick={onCopyLink}>
              {copied ? 'Copied' : 'Copy Invite Link'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
