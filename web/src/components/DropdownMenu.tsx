import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MenuIcon } from './Icons';

interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  submenu?: React.ReactNode | ((closeMenu: () => void) => React.ReactNode);
}

interface DropdownMenuProps {
  items: MenuItem[];
  trigger?: React.ReactNode;
}

export function DropdownMenu({ items, trigger }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSubmenu, setExpandedSubmenu] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Reset expanded submenu when menu opens
  const handleToggleMenu = () => {
    if (!isOpen) {
      setExpandedSubmenu(null);
    }
    setIsOpen(!isOpen);
  };

  // Close everything
  const closeMenu = () => {
    setIsOpen(false);
    setExpandedSubmenu(null);
  };

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setExpandedSubmenu(null);
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
        setExpandedSubmenu(null);
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
        onClick={handleToggleMenu}
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
              <div key={index}>
                <button
                  className={`dropdown-item ${item.danger ? 'dropdown-item-danger' : ''}`}
                  onClick={() => {
                    if (item.submenu) {
                      // Toggle submenu expansion
                      setExpandedSubmenu(expandedSubmenu === index ? null : index);
                    } else if (!item.disabled && item.onClick) {
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
                  {item.submenu && (
                    <span style={{ 
                      opacity: 0.5, 
                      transform: expandedSubmenu === index ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.15s ease',
                    }}>
                      ›
                    </span>
                  )}
                </button>
                
                {/* Collapsible submenu */}
                <AnimatePresence>
                  {item.submenu && expandedSubmenu === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      style={{ overflow: 'hidden' }}
                    >
                      {typeof item.submenu === 'function' 
                        ? item.submenu(closeMenu) 
                        : item.submenu}
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


