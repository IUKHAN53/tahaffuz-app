import { MD3LightTheme, type MD3Theme } from 'react-native-paper';

// Tahaffuz brand tokens (from Claude Design "Tahaffuz Logo" brief).
export const brand = {
  ink: '#07203F',
  inkMid: '#0B2C55',
  indigo: '#143C6C',
  indigoSoft: '#2A4D7E',
  cream: '#F4EEE3',
  creamWarm: '#EFE7D6',
  paper: '#FAF6EE',
  amber: '#E0A24A',
  amberDark: '#CC8A36',
  sky: '#BFD7EE',
  outline: 'rgba(7,32,63,0.12)',
};

export const paperTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 6,
  colors: {
    ...MD3LightTheme.colors,
    primary: brand.indigo,
    onPrimary: brand.cream,
    primaryContainer: brand.sky,
    onPrimaryContainer: brand.ink,
    secondary: brand.amber,
    onSecondary: brand.ink,
    secondaryContainer: '#F7DDB0',
    onSecondaryContainer: '#4A2E10',
    tertiary: brand.indigoSoft,
    background: brand.cream,
    onBackground: brand.ink,
    surface: brand.paper,
    onSurface: brand.ink,
    surfaceVariant: brand.creamWarm,
    onSurfaceVariant: brand.indigoSoft,
    outline: brand.outline,
    outlineVariant: 'rgba(7,32,63,0.06)',
    error: '#B3261E',
    onError: '#ffffff',
    elevation: {
      level0: 'transparent',
      level1: '#F7F2E8',
      level2: '#F2ECDE',
      level3: '#EDE6D4',
      level4: '#EBE3CF',
      level5: '#E7DEC7',
    },
  },
};

export const palette = {
  userBubble: brand.ink,
  userBubbleText: brand.cream,
  botBubble: '#FFFFFF',
  botBubbleText: brand.ink,
  citation: brand.sky,
  citationText: brand.ink,
  bg: paperTheme.colors.background,
  divider: paperTheme.colors.outlineVariant,
  accent: brand.amber,
};
