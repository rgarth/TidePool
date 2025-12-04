import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloseIcon } from './Icons';

const MAX_DESCRIPTION = 300;

interface EditPlaylistModalProps {
  isOpen: boolean;
  currentName: string;
  currentDescription: string;
  isSaving: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
}

export function EditPlaylistModal({
  isOpen,
  currentName,
  currentDescription,
  isSaving,
  onClose,
  onSave,
}: EditPlaylistModalProps) {
  const [name, setName] = useState(currentName);
  const [description, setDescription] = useState(currentDescription);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName(currentName);
      setDescription(currentDescription);
    }
  }, [isOpen, currentName, currentDescription]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim(), description.trim());
    }
  };

  const remainingChars = MAX_DESCRIPTION - description.length;

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
            <button
              className="modal-close"
              onClick={onClose}
              title="Cancel"
              style={{ position: 'absolute', top: 16, right: 16 }}
            >
              <CloseIcon size={20} />
            </button>

            <h3 className="mb-lg">Edit Playlist</h3>

            <form onSubmit={handleSubmit}>
              {/* Name field */}
              <div className="mb-lg">
                <label className="text-secondary text-sm mb-sm" style={{ display: 'block' }}>
                  Playlist Name
                </label>
                <input
                  type="text"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter playlist name"
                  maxLength={100}
                  autoFocus
                />
              </div>

              {/* Description field */}
              <div className="mb-lg">
                <label className="text-secondary text-sm mb-sm" style={{ display: 'block' }}>
                  Description <span className="text-muted">(optional)</span>
                </label>
                <textarea
                  className="input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION))}
                  placeholder="Add a description for this playlist..."
                  rows={3}
                  style={{ resize: 'vertical', minHeight: '80px' }}
                />
                <div className="flex justify-between mt-xs">
                  <span className="text-muted text-xs">
                    Shown before contributor credits
                  </span>
                  <span className={`text-xs ${remainingChars < 50 ? 'text-error' : 'text-muted'}`}>
                    {remainingChars} left
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-sm">
                <button
                  type="button"
                  className="btn btn-secondary flex-1"
                  onClick={onClose}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1"
                  disabled={!name.trim() || isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

