// Reusable SVG icons

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

// Close/X icon
export function CloseIcon({ size = 20, color = 'currentColor', strokeWidth = 2, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} style={style}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

// Tidal logo (4 diamonds)
export function TidalLogo({ size = 32, color = 'currentColor', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style}>
      <path d="M4 4L8 8L4 12L0 8ZM12 4L16 8L12 12L8 8ZM20 4L24 8L20 12L16 8ZM12 12L16 16L12 20L8 16Z"/>
    </svg>
  );
}

// Refresh icon (circular arrow)
export function RefreshIcon({ size = 18, color = 'currentColor', strokeWidth = 2, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} style={style}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

// Simple refresh (one direction)
export function ReloadIcon({ size = 18, color = 'currentColor', strokeWidth = 2, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} style={style}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

// Loading spinner (partial circle)
export function SpinnerIcon({ size = 24, color = 'currentColor', strokeWidth = 2, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} style={style}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

// Music note icon
export function MusicIcon({ size = 40, color = 'currentColor', strokeWidth = 1.5, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} style={style}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

// Menu/hamburger icon
export function MenuIcon({ size = 18, color = 'currentColor', strokeWidth = 2, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} style={style}>
      <path d="M3 6h18" />
      <path d="M3 12h18" />
      <path d="M3 18h18" />
    </svg>
  );
}

// Switch/swap icon (for switching playlists)
export function SwitchIcon({ size = 18, color = 'currentColor', strokeWidth = 2, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M16 3l4 4-4 4" />
      <path d="M20 7H4" />
      <path d="M8 21l-4-4 4-4" />
      <path d="M4 17h16" />
    </svg>
  );
}

// Exit/logout icon
export function ExitIcon({ size = 18, color = 'currentColor', strokeWidth = 2, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} style={style}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

// Search icon
export function SearchIcon({ size = 20, color = 'currentColor', strokeWidth = 2, style, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} style={style} className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

// Trash/delete icon
export function TrashIcon({ size = 18, color = 'currentColor', strokeWidth = 2, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} style={style}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

// Back arrow icon
export function BackArrowIcon({ size = 20, color = 'currentColor', strokeWidth = 2, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

// Arrow right icon
export function ArrowRightIcon({ size = 20, color = 'currentColor', strokeWidth = 2, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

// Play circle icon (host playlist)
export function PlayCircleIcon({ size = 24, color = 'currentColor', strokeWidth = 2, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" />
    </svg>
  );
}

// Join/Enter icon (door with arrow)
export function JoinIcon({ size = 20, color = 'currentColor', strokeWidth = 2, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );
}

// Pixel art wave logo (TidePool brand)
export function WaveLogoIcon({ size = 56, color = 'white', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill={color} style={style}>
      {/* Top wave - pixel art squares */}
      <rect x="2" y="3" width="3" height="3" />
      <rect x="5" y="6" width="3" height="3" />
      <rect x="8" y="3" width="3" height="3" />
      <rect x="11" y="6" width="3" height="3" />
      <rect x="14" y="3" width="3" height="3" />
      <rect x="17" y="6" width="3" height="3" />
      <rect x="20" y="3" width="3" height="3" />
      <rect x="23" y="6" width="3" height="3" />
      {/* Middle wave */}
      <rect x="2" y="11" width="3" height="3" />
      <rect x="5" y="14" width="3" height="3" />
      <rect x="8" y="11" width="3" height="3" />
      <rect x="11" y="14" width="3" height="3" />
      <rect x="14" y="11" width="3" height="3" />
      <rect x="17" y="14" width="3" height="3" />
      <rect x="20" y="11" width="3" height="3" />
      <rect x="23" y="14" width="3" height="3" />
      {/* Bottom wave */}
      <rect x="2" y="19" width="3" height="3" />
      <rect x="5" y="22" width="3" height="3" />
      <rect x="8" y="19" width="3" height="3" />
      <rect x="11" y="22" width="3" height="3" />
      <rect x="14" y="19" width="3" height="3" />
      <rect x="17" y="22" width="3" height="3" />
      <rect x="20" y="19" width="3" height="3" />
      <rect x="23" y="22" width="3" height="3" />
    </svg>
  );
}

// Info icon (circle with i)
export function InfoIcon({ size = 16, color = 'currentColor', strokeWidth = 2, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} style={style}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

// Logout icon (power off / disconnect)
export function LogoutIcon({ size = 18, color = 'currentColor', strokeWidth = 2, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  );
}

// Palette icon (for theme picker)
export function PaletteIcon({ size = 18, color = 'currentColor', strokeWidth = 2, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <circle cx="13.5" cy="6.5" r="1.5" fill={color} stroke="none" />
      <circle cx="17.5" cy="10.5" r="1.5" fill={color} stroke="none" />
      <circle cx="8.5" cy="7.5" r="1.5" fill={color} stroke="none" />
      <circle cx="6.5" cy="12.5" r="1.5" fill={color} stroke="none" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z" />
    </svg>
  );
}

