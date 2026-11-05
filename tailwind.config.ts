import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      borderColor: { DEFAULT: 'rgb(var(--border-default) / <alpha-value>)' },
      ringColor: { DEFAULT: 'rgb(var(--focus-ring) / <alpha-value>)' },
      ringOffsetColor: { DEFAULT: 'rgb(var(--surface-panel) / <alpha-value>)' },
      boxShadow: { panel: 'var(--shadow-panel)', control: 'var(--shadow-control)' },
      fontFamily: {
        sans: ['Cal Sans', 'system-ui', 'sans-serif'],
        heading: ['Cal Sans', 'system-ui', 'sans-serif'],
      },
      fontWeight: {
        normal: '500',
        medium: '500',
      },
      colors: {
        'switch-off': 'rgb(var(--switch-off) / <alpha-value>)',
        'switch-edge': 'rgb(var(--switch-edge) / <alpha-value>)',
        'caution-bg': 'rgb(var(--caution-bg) / <alpha-value>)',
        'caution-text': 'rgb(var(--caution-text) / <alpha-value>)',
        'caution-border': 'rgb(var(--caution-border) / <alpha-value>)',
        'notice-bg': 'rgb(var(--notice-bg) / <alpha-value>)',
        'notice-text': 'rgb(var(--notice-text) / <alpha-value>)',
        'notice-border': 'rgb(var(--notice-border) / <alpha-value>)',
        'success-solid': 'rgb(var(--success-solid) / <alpha-value>)',
        'warning-solid': 'rgb(var(--warning-solid) / <alpha-value>)',
        'error-solid': 'rgb(var(--error-solid) / <alpha-value>)',
        'info-solid': 'rgb(var(--info-solid) / <alpha-value>)',

        contrast: 'rgb(var(--surface-contrast) / <alpha-value>)',
        'page': 'rgb(var(--surface-page) / <alpha-value>)',
        'panel': 'rgb(var(--surface-panel) / <alpha-value>)',
        'raised': 'rgb(var(--surface-raised) / <alpha-value>)',
        'muted': 'rgb(var(--surface-muted) / <alpha-value>)',
        'hover': 'rgb(var(--surface-hover) / <alpha-value>)',
        'selected': 'rgb(var(--surface-selected) / <alpha-value>)',
        'overlay': 'rgb(var(--surface-overlay) / <alpha-value>)',
        'primary': 'rgb(var(--text-primary) / <alpha-value>)',
        'secondary': 'rgb(var(--text-secondary) / <alpha-value>)',
        'on-accent': 'rgb(var(--text-on-accent) / <alpha-value>)',
        'inverse': 'rgb(var(--text-inverse) / <alpha-value>)',
        'default': 'rgb(var(--border-default) / <alpha-value>)',
        'strong': 'rgb(var(--border-strong) / <alpha-value>)',
        'focus': 'rgb(var(--focus-ring) / <alpha-value>)',
        'accent': 'rgb(var(--accent) / <alpha-value>)',
        'accent-hover': 'rgb(var(--accent-hover) / <alpha-value>)',
        'accent-subtle': 'rgb(var(--accent-subtle) / <alpha-value>)',
        'accent-text': 'rgb(var(--accent-text) / <alpha-value>)',
        'scrim': 'rgb(var(--scrim) / <alpha-value>)',
        'chart-grid': 'rgb(var(--chart-grid) / <alpha-value>)',
        'chart-axis': 'rgb(var(--chart-axis) / <alpha-value>)',
        'success-bg': 'rgb(var(--success-bg) / <alpha-value>)',
        'success-text': 'rgb(var(--success-text) / <alpha-value>)',
        'success-border': 'rgb(var(--success-border) / <alpha-value>)',
        'warning-bg': 'rgb(var(--warning-bg) / <alpha-value>)',
        'warning-text': 'rgb(var(--warning-text) / <alpha-value>)',
        'warning-border': 'rgb(var(--warning-border) / <alpha-value>)',
        'error-bg': 'rgb(var(--error-bg) / <alpha-value>)',
        'error-text': 'rgb(var(--error-text) / <alpha-value>)',
        'error-border': 'rgb(var(--error-border) / <alpha-value>)',
        'info-bg': 'rgb(var(--info-bg) / <alpha-value>)',
        'info-text': 'rgb(var(--info-text) / <alpha-value>)',
        'info-border': 'rgb(var(--info-border) / <alpha-value>)',
        'muted-foreground': 'rgb(var(--text-muted) / <alpha-value>)',

        // GAKIT Brand Colors
        'gakit-maroon': '#7A0019',
        'gakit-maroon-light': '#9B1C31',
        maroon: {
          50: '#FDF2F4',
          100: '#FCE7EB',
          200: '#F8C9D2',
          300: '#F0A9B6',
          400: '#E07A8C',
          500: '#C94E67',
          600: '#A9314D',
          700: '#7A0019',
          800: '#5E0013',
          900: '#43000E',
        },
        
        // Hazard Status Colors
        'hazard-critical': '#EF4444',  // Red - Critical/Impassable
        'hazard-deepest': '#7A0019',    // Maroon - Overhead flood depth
        'hazard-pending': '#F59E0B',    // Amber - Pending reports
        'hazard-safe': '#10B981',       // Green - Safe routes
        
        // Canvas Neutrals
        'canvas-white': '#FFFFFF',
        'canvas-light': '#F8FAFC',
        'canvas-lighter': '#F1F5F9',
        'canvas-grey': '#E2E8F0',
      },
    },
  },
  plugins: [],
};

export default config;
