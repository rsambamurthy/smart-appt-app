import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemePreset =
  | 'navy' | 'purple' | 'green' | 'slate'
  | 'teal' | 'crimson' | 'amber' | 'rose' | 'indigo' | 'charcoal' | 'ocean' | 'terracotta';

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
  teal: {
    label: 'Teal',
    colors: { primary: '#134e4a', accent: '#14b8a6', accentLight: '#ccfbf1' },
  },
  crimson: {
    label: 'Crimson',
    colors: { primary: '#7f1d1d', accent: '#dc2626', accentLight: '#fee2e2' },
  },
  amber: {
    label: 'Amber',
    colors: { primary: '#78350f', accent: '#f59e0b', accentLight: '#fef3c7' },
  },
  rose: {
    label: 'Rose',
    colors: { primary: '#831843', accent: '#e11d48', accentLight: '#ffe4e6' },
  },
  indigo: {
    label: 'Indigo',
    colors: { primary: '#312e81', accent: '#4f46e5', accentLight: '#e0e7ff' },
  },
  charcoal: {
    label: 'Charcoal',
    colors: { primary: '#111827', accent: '#6b7280', accentLight: '#f3f4f6' },
  },
  ocean: {
    label: 'Ocean',
    colors: { primary: '#164e63', accent: '#0891b2', accentLight: '#cffafe' },
  },
  // Matches the brand accent already used on the dues/bills screens
  // (MyBillsPage's #C4572B) — a "same as the rest of the app" option.
  terracotta: {
    label: 'Terracotta',
    colors: { primary: '#7c2d12', accent: '#C4572B', accentLight: '#fde8dc' },
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
