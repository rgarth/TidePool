// Theme configuration and utilities

export interface ThemeColor {
  id: string;
  name: string;
  accent: string;      // Brightest - main accent (--accent-cyan)
  secondary: string;   // Mid tone - gradient end (--accent-teal)
  deep: string;        // Darkest - deep accents (--accent-deep)
  glow: string;        // Glow/shadow color (with alpha)
}

export const THEME_COLORS: ThemeColor[] = [
  {
    id: 'cyan',
    name: 'Cyan',
    accent: '#3ee0f5',
    secondary: '#14c8de',
    deep: '#0891b2',
    glow: 'rgba(62, 224, 245, 0.5)',
  },
  {
    id: 'gold',
    name: 'Gold',
    accent: '#f5d03e',
    secondary: '#deb514',
    deep: '#b8860b',
    glow: 'rgba(245, 208, 62, 0.5)',
  },
  {
    id: 'orange',
    name: 'Orange',
    accent: '#f5943e',
    secondary: '#de7014',
    deep: '#b85c00',
    glow: 'rgba(245, 148, 62, 0.5)',
  },
  {
    id: 'coral',
    name: 'Coral',
    accent: '#f55e5e',
    secondary: '#de3a3a',
    deep: '#b22222',
    glow: 'rgba(245, 94, 94, 0.5)',
  },
  {
    id: 'pink',
    name: 'Hot Pink',
    accent: '#f53ee0',
    secondary: '#de14c8',
    deep: '#a0108f',
    glow: 'rgba(245, 62, 224, 0.5)',
  },
  {
    id: 'violet',
    name: 'Violet',
    accent: '#a855f7',
    secondary: '#8b3fde',
    deep: '#6b21a8',
    glow: 'rgba(168, 85, 247, 0.5)',
  },
  {
    id: 'blue',
    name: 'Electric Blue',
    accent: '#3e8ff5',
    secondary: '#1470de',
    deep: '#0050b3',
    glow: 'rgba(62, 143, 245, 0.5)',
  },
  {
    id: 'green',
    name: 'Neon Green',
    accent: '#3ef578',
    secondary: '#14de50',
    deep: '#0d9640',
    glow: 'rgba(62, 245, 120, 0.5)',
  },
];

const THEME_STORAGE_KEY = 'tidepool_theme';

export function getStoredTheme(): string {
  return localStorage.getItem(THEME_STORAGE_KEY) || 'cyan';
}

export function setStoredTheme(themeId: string): void {
  localStorage.setItem(THEME_STORAGE_KEY, themeId);
}

// Convert hex to rgba
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function applyTheme(themeId: string): void {
  const theme = THEME_COLORS.find(t => t.id === themeId) || THEME_COLORS[0];
  const root = document.documentElement;
  
  // Update all accent-related CSS variables (3 shades for gradients)
  root.style.setProperty('--accent-cyan', theme.accent);     // Brightest
  root.style.setProperty('--accent-teal', theme.secondary);  // Mid tone
  root.style.setProperty('--accent-deep', theme.deep);       // Darkest
  root.style.setProperty('--shadow-glow', `0 0 20px ${theme.glow}`);
  root.style.setProperty('--shadow-glow-strong', `0 0 30px ${theme.glow.replace('0.5', '0.6')}`);
  root.style.setProperty('--gradient-glow', `linear-gradient(135deg, ${theme.accent} 0%, ${theme.secondary} 100%)`);
  
  // Background ambient glow
  root.style.setProperty('--bg-glow-primary', hexToRgba(theme.accent, 0.1));
  root.style.setProperty('--bg-glow-secondary', hexToRgba(theme.secondary, 0.15));
}

// Initialize theme on load
export function initTheme(): void {
  const themeId = getStoredTheme();
  applyTheme(themeId);
}
