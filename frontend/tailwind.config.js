/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "App.tsx",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      // Your African-inspired color palette
      colors: {
        // Primary colors
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#2563EB', // Trust Blue - Main primary
          600: '#1d4ed8',
          700: '#1e40af', // Dark primary
          800: '#1e3a8a',
          900: '#1e3a8a',
        },
        secondary: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10B981', // Success Green
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        accent: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#F59E0B', // Sunset Orange
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#DC2626', // Alert Red
          600: '#b91c1c',
          700: '#991b1b',
          800: '#7f1d1d',
          900: '#63171b',
        },
        // African market-inspired additional colors
        market: {
          earth: '#a16207', // Brown earth tone
          gold: '#fbbf24', // Gold accent
          sun: '#f59e0b', // Bright sun
          leaf: '#059669', // Green leaf
          sky: '#0ea5e9', // Clear sky
        },
        // Extended background colors
        background: {
          light: '#F8FAFC',
          dark: '#0F172A',
          paper: '#FFFFFF',
          'paper-dark': '#1E293B',
        }
      },
      
      // African-inspired typography
      fontFamily: {
        'sans': [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif'
        ],
        'display': [
          'Inter',
          'system-ui',
          'sans-serif'
        ],
        // African language support (optional)
        'african': [
          'Noto Sans',
          'sans-serif' // Supports African scripts
        ]
      },
      
      // Custom animations
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.5s ease-out',
      },
      
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(-100%)', opacity: 0 },
          '100%': { transform: 'translateX(0)', opacity: 1 },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
      },
      
      // Custom spacing for touch-friendly UI
      spacing: {
        'touch': '44px', // Minimum touch target size
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      
      // Border radius
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      
      // Box shadows
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'elevated': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'inner-light': 'inset 0 2px 4px 0 rgba(255, 255, 255, 0.06)',
      },
      
      // Custom container for better mobile layout
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          sm: '2rem',
          lg: '4rem',
          xl: '5rem',
          '2xl': '6rem',
        },
      },
      
      // Extended screens for better responsive design
      screens: {
        'xs': '475px',
        '3xl': '1920px',
      },
      
      // Custom gradients
      backgroundImage: {
        'gradient-african': 'linear-gradient(135deg, #f59e0b 0%, #10b981 100%)',
        'gradient-sunset': 'linear-gradient(135deg, #f59e0b 0%, #dc2626 100%)',
        'gradient-ocean': 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
      },
    },
  },
  
  plugins: [
    require('@tailwindcss/forms'), // Better form styles
    require('@tailwindcss/typography'), // Better typography
    require('@tailwindcss/aspect-ratio'), // Aspect ratio utilities
    
    // DaisyUI for African-friendly UI components
    require('daisyui'),
  ],
  
  // DaisyUI Configuration
  daisyui: {
    themes: [
      {
        'afripos-light': {
          'primary': '#2563EB', // Trust Blue
          'primary-focus': '#1d4ed8',
          'primary-content': '#ffffff',
          
          'secondary': '#10B981', // Success Green
          'secondary-focus': '#059669',
          'secondary-content': '#ffffff',
          
          'accent': '#F59E0B', // Sunset Orange
          'accent-focus': '#d97706',
          'accent-content': '#ffffff',
          
          'neutral': '#3d4451',
          'neutral-focus': '#2a2e37',
          'neutral-content': '#ffffff',
          
          'base-100': '#ffffff',
          'base-200': '#f9fafb',
          'base-300': '#f3f4f6',
          'base-content': '#1f2937',
          
          'info': '#3b82f6',
          'success': '#10b981',
          'warning': '#f59e0b',
          'error': '#dc2626',
          
          '--rounded-box': '1rem',
          '--rounded-btn': '0.5rem',
          '--rounded-badge': '1.9rem',
          '--animation-btn': '0.25s',
          '--animation-input': '0.2s',
          '--btn-focus-scale': '0.95',
          '--border-btn': '1px',
          '--tab-border': '1px',
        },
        
        'afripos-dark': {
          'primary': '#3b82f6',
          'primary-focus': '#2563EB',
          'primary-content': '#ffffff',
          
          'secondary': '#10b981',
          'secondary-focus': '#059669',
          'secondary-content': '#ffffff',
          
          'accent': '#f59e0b',
          'accent-focus': '#d97706',
          'accent-content': '#ffffff',
          
          'neutral': '#2a2e37',
          'neutral-focus': '#16181d',
          'neutral-content': '#ffffff',
          
          'base-100': '#0F172A', // Dark background
          'base-200': '#1E293B',
          'base-300': '#334155',
          'base-content': '#f1f5f9',
          
          'info': '#3b82f6',
          'success': '#10b981',
          'warning': '#f59e0b',
          'error': '#dc2626',
          
          '--rounded-box': '1rem',
          '--rounded-btn': '0.5rem',
          '--rounded-badge': '1.9rem',
          '--animation-btn': '0.25s',
          '--animation-input': '0.2s',
          '--btn-focus-scale': '0.95',
          '--border-btn': '1px',
          '--tab-border': '1px',
        }
      }
    ],
    darkTheme: "afripos-dark",
    base: true,
    styled: true,
    utils: true,
    prefix: "",
    logs: true,
    themeRoot: ":root",
  },
}