import { extendTheme } from '@chakra-ui/react';

const theme = extendTheme({
  fonts: {
    heading: `'Inter', system-ui, -apple-system, sans-serif`,
    body: `'Inter', system-ui, -apple-system, sans-serif`,
  },
  colors: {
    brand: {
      50: '#F0FDFA',
      100: '#CCFBF1',
      200: '#99F6E4',
      300: '#5EEAD4',
      400: '#2DD4BF',
      500: '#14B8A6',
      600: '#0D9488',
      700: '#0F766E',
      800: '#115E59',
      900: '#134E4A',
    },
    ink: {
      50: '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      300: '#CBD5E1',
      400: '#94A3B8',
      500: '#64748B',
      600: '#475569',
      700: '#334155',
      800: '#1E293B',
      900: '#0F172A',
    },
    sky: {
      50: '#F0F9FF',
      100: '#E0F2FE',
      500: '#0EA5E9',
      600: '#0284C7',
      700: '#0369A1',
    },
    success: {
      50: '#F0FDF4',
      500: '#22C55E',
      600: '#16A34A',
    },
    danger: {
      50: '#FEF2F2',
      100: '#FEE2E2',
      500: '#EF4444',
      600: '#DC2626',
    },
    warning: {
      50: '#FFFBEB',
      500: '#F59E0B',
      600: '#D97706',
    },
  },
  shadows: {
    soft: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06)',
    medium: '0 2px 8px rgba(15, 23, 42, 0.06), 0 16px 40px rgba(15, 23, 42, 0.08)',
    glow: '0 0 0 1px rgba(20, 184, 166, 0.2), 0 8px 24px rgba(20, 184, 166, 0.18)',
  },
  radii: {
    card: '20px',
    pill: '999px',
  },
  styles: {
    global: {
      'html, body': {
        background: 'linear-gradient(180deg, #F8FAFC 0%, #F0FDFA 100%)',
        color: 'ink.900',
        lineHeight: 1.6,
        scrollBehavior: 'smooth',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      },
      '#root': {
        minHeight: '100vh',
      },
      '*::selection': {
        background: 'brand.200',
        color: 'brand.900',
      },
      '.leaflet-container': {
        fontFamily: 'inherit',
      },
    },
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: 600,
        borderRadius: '12px',
        letterSpacing: '-0.01em',
      },
    },
    Heading: {
      baseStyle: {
        letterSpacing: '-0.02em',
      },
    },
  },
});

export default theme;
