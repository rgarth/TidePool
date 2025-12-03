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
    accent: '#5eead4',    // Bright teal
    secondary: '#14b8a6', // Teal
    deep: '#0d9488',      // Dark teal
    glow: 'rgba(94, 234, 212, 0.5)',
  },
  {
    id: 'gold',
    name: 'Gold',
    accent: '#fcd34d',    // Bright gold
    secondary: '#f59e0b', // Amber
    deep: '#d97706',      // Dark amber
    glow: 'rgba(252, 211, 77, 0.5)',
  },
  {
    id: 'orange',
    name: 'Orange',
    accent: '#fb923c',    // Bright orange
    secondary: '#ea580c', // Deep orange
    deep: '#c2410c',      // Dark orange
    glow: 'rgba(251, 146, 60, 0.5)',
  },
  {
    id: 'coral',
    name: 'Coral',
    accent: '#f87171',    // Light coral
    secondary: '#dc2626', // Red
    deep: '#b91c1c',      // Dark red
    glow: 'rgba(248, 113, 113, 0.5)',
  },
  {
    id: 'pink',
    name: 'Hot Pink',
    accent: '#f472b6',    // Pink
    secondary: '#db2777', // Deep pink
    deep: '#be185d',      // Dark pink
    glow: 'rgba(244, 114, 182, 0.5)',
  },
  {
    id: 'violet',
    name: 'Violet',
    accent: '#c084fc',    // Light violet
    secondary: '#9333ea', // Purple
    deep: '#7c3aed',      // Dark purple
    glow: 'rgba(192, 132, 252, 0.5)',
  },
  {
    id: 'blue',
    name: 'Electric Blue',
    accent: '#60a5fa',    // Light blue
    secondary: '#2563eb', // Blue
    deep: '#1d4ed8',      // Dark blue
    glow: 'rgba(96, 165, 250, 0.5)',
  },
  {
    id: 'green',
    name: 'Neon Green',
    accent: '#4ade80',    // Light green
    secondary: '#16a34a', // Green
    deep: '#15803d',      // Dark green
    glow: 'rgba(74, 222, 128, 0.5)',
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

