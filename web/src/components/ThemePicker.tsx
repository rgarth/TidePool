import { useState } from 'react';
import { THEME_COLORS, getStoredTheme, setStoredTheme, applyTheme } from '../theme';

export function ThemePicker() {
  const [currentTheme, setCurrentTheme] = useState(getStoredTheme);

  const handleSelect = (themeId: string) => {
    setCurrentTheme(themeId);
    setStoredTheme(themeId);
    applyTheme(themeId);
  };

  return (
    <div className="theme-picker">
      <div className="theme-picker-label">Accent Color</div>
      <div className="theme-picker-grid">
        {THEME_COLORS.map((theme) => (
          <button
            key={theme.id}
            onClick={() => handleSelect(theme.id)}
            title={theme.name}
            className={`theme-swatch ${currentTheme === theme.id ? 'theme-swatch-active' : ''}`}
            style={{
              '--swatch-color': theme.accent,
              '--swatch-glow': theme.glow,
            } as React.CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}
