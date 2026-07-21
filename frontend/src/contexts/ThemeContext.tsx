import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemePreset = 'navy' | 'purple' | 'green' | 'slate';

interface ThemeColors {
  primary: string;
  accent: string;
  accentLight: string;
}

export const PRESETS: Record<ThemePreset, { label: string; colors: ThemeColors }> = {
  navy: {
    label: 'Navy Blue',
    colors: { primary: '#0c2d72', accent: '#1a6bcc', accentLight: '#e0ecff' },
  },
  purple: {
    label: 'Purple',
    colors: { primary: '#1e1b4b', accent: '#7c3aed', accentLight: '#ede9fe' },
  },
  green: {
    label: 'Forest',
    colors: { primary: '#064e3b', accent: '#059669', accentLight: '#d1fae5' },
  },
  slate: {
    label: 'Slate',
    colors: { primary: '#0f172a', accent: '#3b82f6', accentLight: '#dbeafe' },
  },
};

function applyTheme(preset: ThemePreset) {
  const { colors } = PRESETS[preset];
  const root = document.documentElement;
  root.style.setProperty('--theme-primary', colors.primary);
  root.style.setProperty('--theme-accent', colors.accent);
  root.style.setProperty('--theme-accent-light', colors.accentLight);
}

interface ThemeCtx {
  preset: ThemePreset;
  setPreset: (p: ThemePreset) => void;
}

const ThemeContext = createContext<ThemeCtx>({ preset: 'navy', setPreset: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preset, setPresetState] = useState<ThemePreset>(() => {
    const saved = localStorage.getItem('sa-theme') as ThemePreset | null;
    return saved && saved in PRESETS ? saved : 'navy';
  });

  const setPreset = (p: ThemePreset) => {
    setPresetState(p);
    localStorage.setItem('sa-theme', p);
  };

  useEffect(() => {
    applyTheme(preset);
  }, [preset]);

  return (
    <ThemeContext.Provider value={{ preset, setPreset }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
