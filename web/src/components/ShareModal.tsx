import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';

// Get current accent color from CSS variable
function getAccentColor(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--accent-cyan').trim() || '#3ee0f5';
}

interface ShareModalProps {
  isOpen: boolean;
  sessionId?: string;
  copied: boolean;
  onClose: () => void;
  onCopyLink: () => void;
  onCopyCode: () => void;
}

export function ShareModal({ isOpen, sessionId, copied, onClose, onCopyLink, onCopyCode }: ShareModalProps) {
  const [accentColor, setAccentColor] = useState(getAccentColor);

  // Update color when modal opens (in case theme changed)
  useEffect(() => {
    if (isOpen) {
      setAccentColor(getAccentColor());
    }
  }, [isOpen]);

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
                fgColor={accentColor}
              />
            </div>
            
            <p className="text-secondary text-sm mb-xs">Code</p>
            <code 
              className="session-code-lg mb-lg" 
              style={{ display: 'inline-block', cursor: 'pointer' }}
              onClick={onCopyCode}
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
