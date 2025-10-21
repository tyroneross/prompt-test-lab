/**
 * Design Tokens - Calm Precision Design System
 * 
 * Centralized design system tokens for consistent styling across the application.
 * Based on the specifications in COMPONENT_HIERARCHY.md and UX_SPECIFICATIONS.md
 */

// Color System
export const colors = {
  // Primary Scale - Calm Precision Blue
  primary: {
    50: '#f0f9ff',   // Light backgrounds, hover states
    100: '#e0f2fe',  // Subtle backgrounds
    200: '#bae6fd',  // Lighter interactive elements
    300: '#7dd3fc',  // Light accents
    400: '#38bdf8',  // Medium accents
    500: '#3b82f6',  // Primary actions, links
    600: '#2563eb',  // Primary hover
    700: '#1d4ed8',  // Primary active
    800: '#1e40af',  // Dark primary
    900: '#1e3a8a',  // High contrast text
    950: '#172554',  // Darkest primary
  },
  
  // Neutral Scale - Primary UI colors
  neutral: {
    50: '#fafafa',   // Page backgrounds
    100: '#f5f5f5',  // Card backgrounds
    200: '#e5e5e5',  // Subtle borders
    300: '#d4d4d8',  // Default borders
    400: '#a1a1aa',  // Placeholder text
    500: '#71717a',  // Secondary text
    600: '#525252',  // Primary text (light bg)
    700: '#404040',  // Emphasized text
    800: '#262626',  // High contrast text
    900: '#171717',  // Headings, primary text
    950: '#0a0a0a',  // Maximum contrast
  },

  // Semantic Colors
  semantic: {
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#10b981',  // Primary success
      600: '#059669',
      700: '#047857',  // Dark success
      800: '#065f46',
      900: '#064e3b',
    },
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',  // Primary warning
      600: '#d97706',
      700: '#b45309',  // Dark warning
      800: '#92400e',
      900: '#78350f',
    },
    error: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',  // Primary error
      600: '#dc2626',
      700: '#b91c1c',  // Dark error
      800: '#991b1b',
      900: '#7f1d1d',
    },
    info: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',  // Primary info (same as primary)
      600: '#2563eb',
      700: '#1d4ed8',  // Dark info
      800: '#1e40af',
      900: '#1e3a8a',
    }
  }
} as const;

// Typography Scale
export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
    mono: ['JetBrains Mono', 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'monospace'],
  },
  
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],      // 12px - Captions, labels
    sm: ['0.875rem', { lineHeight: '1.25rem' }],  // 14px - Secondary text
    base: ['1rem', { lineHeight: '1.5rem' }],     // 16px - Primary body text
    lg: ['1.125rem', { lineHeight: '1.75rem' }],  // 18px - Large body text
    xl: ['1.25rem', { lineHeight: '1.75rem' }],   // 20px - Subsection headers
    '2xl': ['1.5rem', { lineHeight: '2rem' }],    // 24px - Section headers
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px - Page titles
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }], // 36px - Large titles
  },

  fontWeight: {
    normal: '400',    // Regular text
    medium: '500',    // Emphasized text
    semibold: '600',  // Subheadings
    bold: '700',      // Headings
  },

  letterSpacing: {
    tight: '-0.025em',
    normal: '0em',
    wide: '0.025em',
  }
} as const;

// Spacing Scale (8px base)
export const spacing = {
  0: '0px',
  1: '0.25rem',  // 4px
  2: '0.5rem',   // 8px - Base unit
  3: '0.75rem',  // 12px
  4: '1rem',     // 16px - Common padding/margin
  5: '1.25rem',  // 20px
  6: '1.5rem',   // 24px - Section spacing
  8: '2rem',     // 32px - Large spacing
  10: '2.5rem',  // 40px
  12: '3rem',    // 48px - Very large spacing
  16: '4rem',    // 64px
  20: '5rem',    // 80px
  24: '6rem',    // 96px
  32: '8rem',    // 128px
  40: '10rem',   // 160px
  48: '12rem',   // 192px
  56: '14rem',   // 224px
  64: '16rem',   // 256px
} as const;

// Border Radius
export const borderRadius = {
  none: '0px',
  xs: '0.0625rem',  // 1px
  sm: '0.125rem',   // 2px
  base: '0.25rem',  // 4px - Default radius
  md: '0.375rem',   // 6px - Cards, buttons
  lg: '0.5rem',     // 8px - Large elements
  xl: '0.75rem',    // 12px
  '2xl': '1rem',    // 16px - Very large elements
  '3xl': '1.5rem',  // 24px
  full: '9999px',   // Circular
} as const;

// Shadow System
export const shadows = {
  none: '0 0 #0000',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',           // Subtle elevation
  base: '0 2px 8px 0 rgb(0 0 0 / 0.06)',         // Default shadow
  md: '0 4px 16px 0 rgb(0 0 0 / 0.08)',          // Medium elevation
  lg: '0 8px 32px 0 rgb(0 0 0 / 0.12)',          // High elevation
  xl: '0 16px 48px 0 rgb(0 0 0 / 0.16)',         // Maximum elevation
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.06)',  // Inset shadows
} as const;

// Animation & Transitions
export const animation = {
  duration: {
    fast: '150ms',    // Quick transitions
    normal: '200ms',  // Default duration
    slow: '300ms',    // Slower transitions
    slower: '500ms',  // Modal/drawer animations
  },
  
  easing: {
    linear: 'linear',
    out: 'cubic-bezier(0, 0, 0.2, 1)',          // ease-out
    in: 'cubic-bezier(0.4, 0, 1, 1)',           // ease-in
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',      // ease-in-out
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)', // bounce
  }
} as const;

// Z-Index Scale
export const zIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
} as const;

// Breakpoints (mobile-first)
export const breakpoints = {
  sm: '640px',   // Small tablets, large phones
  md: '768px',   // Tablets
  lg: '1024px',  // Small desktops, large tablets
  xl: '1280px',  // Large desktops
  '2xl': '1536px' // Extra large screens
} as const;

// Component-specific tokens
export const components = {
  button: {
    height: {
      sm: '2rem',     // 32px
      md: '2.5rem',   // 40px
      lg: '3rem',     // 48px
    },
    padding: {
      sm: '0.5rem 0.75rem',   // 8px 12px
      md: '0.625rem 1rem',    // 10px 16px
      lg: '0.75rem 1.5rem',   // 12px 24px
    },
    minWidth: {
      sm: '4rem',   // 64px
      md: '5rem',   // 80px
      lg: '6rem',   // 96px
    }
  },
  
  input: {
    height: {
      sm: '2rem',     // 32px
      md: '2.5rem',   // 40px
      lg: '3rem',     // 48px
    },
    padding: {
      sm: '0.25rem 0.5rem',   // 4px 8px
      md: '0.5rem 0.75rem',   // 8px 12px
      lg: '0.75rem 1rem',     // 12px 16px
    }
  },
  
  card: {
    padding: {
      sm: '1rem',     // 16px
      md: '1.5rem',   // 24px
      lg: '2rem',     // 32px
    }
  }
} as const;

// Accessibility tokens
export const accessibility = {
  // Minimum contrast ratios (WCAG 2.2 AA)
  contrast: {
    normal: 4.5,  // Normal text
    large: 3,     // Large text (18pt+ or 14pt+ bold)
    enhanced: 7,  // AAA level
  },
  
  // Focus indicators
  focus: {
    width: '2px',
    style: 'solid',
    offset: '2px',
    color: colors.primary[600],
  },
  
  // Touch targets (minimum 44px)
  touchTarget: {
    minSize: '2.75rem', // 44px
  }
} as const;

// Export convenience functions
export const getColor = (color: string) => {
  const [group, shade] = color.split('-');
  if (group === 'primary') return colors.primary[shade as unknown as keyof typeof colors.primary];
  if (group === 'neutral') return colors.neutral[shade as unknown as keyof typeof colors.neutral];
  if (group === 'success') return colors.semantic.success[shade as unknown as keyof typeof colors.semantic.success];
  if (group === 'warning') return colors.semantic.warning[shade as unknown as keyof typeof colors.semantic.warning];
  if (group === 'error') return colors.semantic.error[shade as unknown as keyof typeof colors.semantic.error];
  if (group === 'info') return colors.semantic.info[shade as unknown as keyof typeof colors.semantic.info];
  return color;
};

export const getFontSize = (size: keyof typeof typography.fontSize) => {
  return typography.fontSize[size];
};

export const getSpacing = (size: keyof typeof spacing) => {
  return spacing[size];
};

export const getBorderRadius = (size: keyof typeof borderRadius) => {
  return borderRadius[size];
};

export const getShadow = (size: keyof typeof shadows) => {
  return shadows[size];
};

// Simplified Mockup Themes
export const mockupThemes = {
  zen: {
    // Ultra-minimal theme for zen focus mockup
    colors: {
      background: colors.neutral[50],
      surface: '#ffffff',
      primary: colors.primary[600],
      text: colors.neutral[900],
      textSecondary: colors.neutral[600],
      border: colors.neutral[200],
      borderSubtle: colors.neutral[100],
    },
    spacing: {
      // Increased spacing for zen theme
      section: spacing[16],      // 64px - Large section spacing
      content: spacing[12],      // 48px - Content spacing
      element: spacing[8],       // 32px - Element spacing
      compact: spacing[6],       // 24px - Compact spacing
    },
    typography: {
      hero: typography.fontSize['4xl'],
      title: typography.fontSize['3xl'],
      heading: typography.fontSize['2xl'],
      body: typography.fontSize.lg,
      caption: typography.fontSize.base,
    }
  },
  
  dashboard: {
    // Balanced theme for dashboard mockup
    colors: {
      background: colors.neutral[50],
      surface: '#ffffff',
      surfaceElevated: '#ffffff',
      primary: colors.primary[600],
      text: colors.neutral[900],
      textSecondary: colors.neutral[600],
      textMuted: colors.neutral[500],
      border: colors.neutral[200],
      borderSubtle: colors.neutral[100],
      accent: colors.primary[50],
    },
    spacing: {
      section: spacing[8],       // 32px - Section spacing
      content: spacing[6],       // 24px - Content spacing
      element: spacing[4],       // 16px - Element spacing
      compact: spacing[3],       // 12px - Compact spacing
      sidebar: spacing[6],       // 24px - Sidebar spacing
    },
    typography: {
      title: typography.fontSize['2xl'],
      heading: typography.fontSize.xl,
      subheading: typography.fontSize.lg,
      body: typography.fontSize.base,
      caption: typography.fontSize.sm,
      label: typography.fontSize.xs,
    }
  },
  
  mobile: {
    // Mobile-optimized theme
    colors: {
      background: colors.neutral[50],
      surface: '#ffffff',
      primary: colors.primary[600],
      text: colors.neutral[900],
      textSecondary: colors.neutral[600],
      border: colors.neutral[200],
      borderLight: colors.neutral[100],
      active: colors.primary[50],
    },
    spacing: {
      section: spacing[4],       // 16px - Mobile section spacing
      content: spacing[4],       // 16px - Mobile content spacing
      element: spacing[3],       // 12px - Mobile element spacing
      tight: spacing[2],         // 8px - Tight spacing
      touch: accessibility.touchTarget.minSize, // 44px - Touch targets
    },
    typography: {
      title: typography.fontSize.xl,
      heading: typography.fontSize.lg,
      body: typography.fontSize.base,
      caption: typography.fontSize.sm,
      label: typography.fontSize.xs,
    }
  }
} as const;

// Mockup-specific component tokens
export const mockupComponents = {
  zen: {
    promptInput: {
      minHeight: '12rem',       // 192px - Large prompt input
      padding: spacing[8],      // 32px - Generous padding
      fontSize: typography.fontSize.lg,
      borderRadius: borderRadius['2xl'],
    },
    actionButton: {
      height: components.button.height.lg,
      padding: '1rem 3rem',     // Extra wide padding
      fontSize: typography.fontSize.lg,
    }
  },
  
  dashboard: {
    sidebar: {
      width: '20rem',           // 320px - Sidebar width
      padding: spacing[6],      // 24px - Sidebar padding
    },
    card: {
      padding: components.card.padding.md,
      borderRadius: borderRadius.lg,
    }
  },
  
  mobile: {
    bottomNav: {
      height: '5rem',           // 80px - Bottom nav height
      padding: spacing[2],      // 8px - Bottom nav padding
    },
    touchTarget: {
      minHeight: accessibility.touchTarget.minSize,
      minWidth: accessibility.touchTarget.minSize,
    }
  }
} as const;

// Export all tokens as default
export default {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  animation,
  zIndex,
  breakpoints,
  components,
  accessibility,
  mockupThemes,
  mockupComponents,
};