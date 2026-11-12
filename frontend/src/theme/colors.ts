// IronForge — iOS-Native Design System (Liquid Glass)
// Aligned with Apple Human Interface Guidelines and reference UI

export const palette = {
  // Brand — Dark Teal / Pine & Emerald (Reference image aesthetic)
  brand: '#0F766E',
  brandDark: '#115E59',
  brandLight: '#2DD4BF',
  brandMuted: '#CCFBF1',

  cta: '#2DD4BF',

  // Semantic colors
  systemGreen: '#10B981',
  systemRed: '#EF4444',
  systemOrange: '#F59E0B',
  systemBlue: '#3B82F6',
  systemYellow: '#FBBF24',
};

export const lightColors = {
  // Backgrounds
  background: '#F3F7F6',
  surface: '#FFFFFF',
  surfaceSecondary: '#EBF1F0',
  surfaceMuted: '#E0EAE8',
  surfaceElevated: '#FFFFFF',

  // Borders & separators
  border: '#D1DDD9',
  borderStrong: '#B5C7C3',

  // Text
  text: '#111827',
  textSecondary: '#4B5563',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',

  // Brand
  primary: palette.brand,
  primaryMuted: '#CCFBF1',
  cta: palette.brand,

  // Semantic states
  danger: palette.systemRed,
  warning: palette.systemOrange,
  success: palette.systemGreen,
  info: palette.systemBlue,

  // UI chrome
  overlay: 'rgba(0, 0, 0, 0.4)',
  tabBar: '#FFFFFF',
  input: '#FFFFFF',
  skeleton: '#E0EAE8',
};

export const darkColors = {
  // Deep Pine / Teal Slate backgrounds matching reference image
  background: '#0B1312',
  surface: '#132220',
  surfaceSecondary: '#1A2C29',
  surfaceMuted: '#243734',
  surfaceElevated: '#1E322F',

  // Borders (Clean glass edge specular lines)
  border: 'rgba(255, 255, 255, 0.12)',
  borderStrong: 'rgba(255, 255, 255, 0.22)',

  // Text (Crisp white primary, soft mint slate secondary)
  text: '#FFFFFF',
  textSecondary: '#94A6A3',
  textTertiary: '#647673',
  textInverse: '#0B1312',

  // Brand
  primary: '#2DD4BF',
  primaryMuted: 'rgba(45, 212, 191, 0.15)',
  cta: '#2DD4BF',

  // Semantic states
  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  info: '#3B82F6',

  // UI chrome
  overlay: 'rgba(0, 0, 0, 0.7)',
  tabBar: 'rgba(11, 19, 18, 0.95)',
  input: 'rgba(255, 255, 255, 0.08)',
  skeleton: 'rgba(255, 255, 255, 0.08)',
};

export type ThemeColors = typeof lightColors;
