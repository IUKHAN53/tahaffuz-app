import { MD3LightTheme, type MD3Theme } from 'react-native-paper';

/**
 * Tika Dost design tokens — from the Claude Design "Tika Dost Mockups" brief.
 * Friendly healthcare look: teal primary, warm amber actions, off-white
 * surfaces, generous 20px radii, coral reserved strictly for overdue/alerts.
 */
export const tika = {
  // Light theme (primary deliverable)
  bg: '#F7FAF9',
  card: '#FFFFFF',
  ink: '#0B2440',
  inkSoft: 'rgba(11,36,64,0.6)',
  inkFaint: 'rgba(11,36,64,0.4)',
  teal: '#0E7C66',
  tealBright: '#1B9E82',
  tealDeep: '#0B5A4B',
  mint: '#E8F3EE',
  amber: '#F4A02C',
  coral: '#E5674B', // overdue / alerts ONLY
  inputPill: '#F1F6F4',
  shadow: '#0B2440',

  // Dark variant tokens (kept ready; app currently ships light-only)
  dark: {
    bg: '#0C1E1A',
    card: '#143028',
    chip: '#1A3B31',
    header: '#10281F',
    text: '#EAF4F0',
    teal: '#2CBF9C',
    coral: '#F08A72',
  },
};

/**
 * Legacy token names, remapped onto the new palette so screens that still
 * reference `brand.*` (Bookmarks, Register, Scan, Schedule, Search, Memory)
 * pick up the new look without a rewrite. Contrast relationships preserved:
 * ink stays the dark tone, cream stays the light tone.
 */
export const brand = {
  ink: tika.ink,
  inkMid: tika.tealDeep,
  indigo: tika.teal,
  indigoSoft: '#4A6B60',
  cream: tika.bg,
  creamWarm: tika.mint,
  paper: tika.card,
  amber: tika.amber,
  amberDark: '#D9880F',
  sky: tika.mint,
  outline: 'rgba(11,36,64,0.12)',
};

export const paperTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 12,
  colors: {
    ...MD3LightTheme.colors,
    primary: tika.teal,
    onPrimary: '#FFFFFF',
    primaryContainer: tika.mint,
    onPrimaryContainer: tika.ink,
    secondary: tika.amber,
    onSecondary: '#FFFFFF',
    secondaryContainer: '#FCEBD2',
    onSecondaryContainer: '#5C3D0C',
    tertiary: tika.tealBright,
    background: tika.bg,
    onBackground: tika.ink,
    surface: tika.card,
    onSurface: tika.ink,
    surfaceVariant: tika.mint,
    onSurfaceVariant: brand.indigoSoft,
    outline: brand.outline,
    outlineVariant: 'rgba(11,36,64,0.06)',
    error: tika.coral,
    onError: '#ffffff',
    elevation: {
      level0: 'transparent',
      level1: '#F2F8F5',
      level2: '#EDF5F1',
      level3: '#E8F3EE',
      level4: '#E5F1EB',
      level5: '#E0EEE7',
    },
  },
};

export const palette = {
  userBubble: tika.teal,
  userBubbleText: '#FFFFFF',
  botBubble: tika.card,
  botBubbleText: tika.ink,
  citation: tika.mint,
  citationText: tika.ink,
  bg: tika.bg,
  divider: 'rgba(11,36,64,0.06)',
  accent: tika.amber,
};
