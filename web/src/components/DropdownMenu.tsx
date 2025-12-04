import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MenuIcon } from './Icons';

interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  submenu?: React.ReactNode;
}

interface DropdownMenuProps {
  items: MenuItem[];
  trigger?: React.ReactNode;
}

export function DropdownMenu({ items, trigger }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setOpenSubmenu(null);
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setOpenSubmenu(null);
      }
    }
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  return (
    <div className="dropdown" ref={menuRef}>
      <button
        className="btn btn-ghost btn-icon"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {trigger || <MenuIcon size={20} />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="dropdown-menu"
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            {items.map((item, index) => (
              <div
                key={index}
                className="dropdown-item-wrapper"
                onMouseEnter={() => item.submenu && setOpenSubmenu(index)}
                onMouseLeave={() => item.submenu && setOpenSubmenu(null)}
                style={{ position: 'relative' }}
              >
                <button
                  className={`dropdown-item ${item.danger ? 'dropdown-item-danger' : ''}`}
                  onClick={() => {
                    if (!item.disabled && item.onClick) {
                      item.onClick();
                      setIsOpen(false);
                    }
                  }}
                  disabled={item.disabled}
                  style={{ width: '100%', justifyContent: 'space-between' }}
                >
                  <span className="flex items-center gap-sm">
                    {item.icon}
                    {item.label}
                  </span>
                  {item.submenu && <span style={{ opacity: 0.5 }}>›</span>}
                </button>
                
                {/* Submenu */}
                <AnimatePresence>
                  {item.submenu && openSubmenu === index && (
                    <motion.div
                      className="dropdown-submenu"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.1 }}
                    >
                      {item.submenu}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


