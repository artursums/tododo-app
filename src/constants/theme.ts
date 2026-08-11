/**
 * tododo Design System
 * Same token structure as Purra (so ported components drop in), a distinct look:
 * a calm indigo/violet primary with a warm coral accent — "shared life", not zen.
 * Supports light and dark modes.
 */

// Light theme colors
export const LIGHT_COLORS = {
  // Backgrounds
  bg: '#F7F7FB',
  card: '#FFFFFF',

  // Text hierarchy
  text: '#1B1B2F',
  textSecondary: '#5B5B72',
  textMuted: '#9A9AB0',

  // Primary accent — indigo
  accent: '#6366F1',
  accentLight: '#E0E1FB',
  accentDark: '#4F46E5',

  // Warm secondary accent — coral (used for highlights / CTAs)
  coral: '#FB7185',

  // Member/category tints
  tint1: '#6366F1', // indigo
  tint2: '#FB7185', // coral
  tint3: '#F59E0B', // amber
  tint4: '#10B981', // emerald
  tint5: '#0EA5E9', // sky

  // Utility
  white: '#FFFFFF',
  black: '#000000',
  border: '#E7E7F0',
  overlay: 'rgba(20, 20, 40, 0.4)',

  // Legacy support (keeps ported components that reference these happy)
  primary: '#6366F1',
  primaryLight: '#E0E1FB',
  secondary: '#FB7185',
  secondaryLight: '#FFE4E9',
  bgCard: '#FFFFFF',
  bgElevated: '#FFFFFF',
  borderLight: '#F0F0F6',
  borderDark: '#E7E7F0',
  gray: '#5B5B72',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
}

// Dark theme colors
export const DARK_COLORS: typeof LIGHT_COLORS = {
  // Backgrounds
  bg: '#0E0E16',
  card: '#1A1A26',

  // Text hierarchy
  text: '#F2F2F7',
  textSecondary: '#A6A6BD',
  textMuted: '#6E6E86',

  // Primary accent — indigo (brighter for dark)
  accent: '#818CF8',
  accentLight: '#312E81',
  accentDark: '#6366F1',

  // Warm secondary accent — coral
  coral: '#FB7185',

  // Member/category tints (adjusted for dark)
  tint1: '#818CF8',
  tint2: '#FB7185',
  tint3: '#FBBF24',
  tint4: '#34D399',
  tint5: '#38BDF8',

  // Utility
  white: '#FFFFFF',
  black: '#000000',
  border: '#2A2A3A',
  overlay: 'rgba(0, 0, 0, 0.6)',

  // Legacy support
  primary: '#818CF8',
  primaryLight: '#312E81',
  secondary: '#FB7185',
  secondaryLight: '#4C1D2B',
  bgCard: '#1A1A26',
  bgElevated: '#252534',
  borderLight: '#2A2A3A',
  borderDark: '#3A3A4A',
  gray: '#A6A6BD',
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
}

// Default export (light mode) — overridden at runtime by ThemeContext
export let COLORS = LIGHT_COLORS

export const BORDER_WIDTH = 1

/**
 * Distinct, friendly colors assigned to household members and event categories.
 * Picked for good separation in both light and dark. Index into this by member
 * join-order (wraps around).
 */
export const MEMBER_COLORS = [
  '#6366F1', // indigo
  '#FB7185', // coral
  '#10B981', // emerald
  '#F59E0B', // amber
  '#0EA5E9', // sky
  '#A855F7', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
] as const

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}

export const TYPOGRAPHY = {
  title: { size: 32, weight: '600' as const, letterSpacing: -0.5 },
  heading: { size: 20, weight: '600' as const, letterSpacing: -0.3 },
  body: { size: 16, weight: '400' as const, letterSpacing: 0 },
  caption: { size: 13, weight: '500' as const, letterSpacing: 0.2 },
}

// Legacy font sizes for backwards compatibility with ported components
export const FONT_SIZES = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 22,
  xxl: 28,
  xxxl: 34,
}

export const RADIUS = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  full: 9999,
}

// Minimal shadows (RN boxShadow syntax)
export const SHADOWS = {
  sm: { boxShadow: '0 2px 8px rgba(20, 20, 40, 0.05)' },
  md: { boxShadow: '0 4px 12px rgba(20, 20, 40, 0.07)' },
  lg: { boxShadow: '0 6px 16px rgba(20, 20, 40, 0.09)' },
}
