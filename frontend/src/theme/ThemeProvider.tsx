import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, ThemeColors } from './colors';
import { radii, spacing, touchTarget, typography } from './spacing';
import { useSettingsStore } from '@/src/store/settings-store';

type ThemeValue = {
  colors: ThemeColors;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  touchTarget: typeof touchTarget;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const mode = useSettingsStore((s) => s.themeMode);

  const isDark = mode === 'system' ? scheme === 'dark' : mode === 'dark';

  const value = useMemo<ThemeValue>(
    () => ({
      colors: isDark ? darkColors : lightColors,
      spacing,
      radii,
      typography,
      touchTarget,
      isDark,
    }),
    [isDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
