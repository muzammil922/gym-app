// IronForge — iOS spacing & typography tokens
// Per Apple HIG typography.md: default body=17pt, minimum=11pt
// Per Apple HIG layout.md: safe areas, standard margins, 44pt touch targets
// Per Apple HIG buttons.md: minimum hit area 44×44pt

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
} as const;

export const radii = {
  sm: 8,    // chips, tags, small elements
  md: 12,   // input fields, small cards
  lg: 16,   // cards (iOS standard grouped cell)
  xl: 20,   // large cards
  xxl: 28,  // sheets, bottom modals
  full: 999,
} as const;

// iOS HIG: minimum touch target = 44×44pt (not 48)
export const touchTarget = 44;

// iOS Dynamic Type scale — Large (default) per typography.md
export const typography = {
  largeTitle: { fontSize: 34, fontWeight: '700' as const, letterSpacing: 0.37 },
  title1:     { fontSize: 28, fontWeight: '700' as const, letterSpacing: 0.36 },
  title2:     { fontSize: 22, fontWeight: '700' as const, letterSpacing: 0.35 },
  title3:     { fontSize: 20, fontWeight: '600' as const, letterSpacing: 0.38 },
  headline:   { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.43 },
  body:       { fontSize: 17, fontWeight: '400' as const, letterSpacing: -0.43 },
  callout:    { fontSize: 16, fontWeight: '400' as const, letterSpacing: -0.32 },
  subhead:    { fontSize: 15, fontWeight: '400' as const, letterSpacing: -0.24 },
  footnote:   { fontSize: 13, fontWeight: '400' as const, letterSpacing: -0.08 },
  caption1:   { fontSize: 12, fontWeight: '400' as const, letterSpacing: 0 },
  caption2:   { fontSize: 11, fontWeight: '400' as const, letterSpacing: 0.07 },
  // Legacy aliases for backward compatibility
  display: 34,
  title: 28,
  heading: 20,
  body_px: 17,
  caption: 13,
  small: 11,
} as const;
