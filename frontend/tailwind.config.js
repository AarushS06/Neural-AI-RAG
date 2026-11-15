/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        warm: {
          bg: '#F5F1EA',
          card: '#FCFAF7',
          surface: '#FFFFFF',
          border: 'rgba(230, 223, 213, 0.85)',
          muted: '#8A8275',
          text: '#111111',
          subtext: '#4A463F',
        },
        dark: {
          bg: '#0B1211',
          card: '#121A19',
          surface: '#182422',
          border: 'rgba(38, 54, 51, 0.75)',
          muted: '#7F918E',
          text: '#F5F1EA',
          subtext: '#B0C2BE',
        },
        accent: {
          DEFAULT: '#0F5B54',
          hover: '#13746B',
          light: '#E2F0EE',
          dark: '#1C8278',
          subtle: '#14B8A6',
          glow: 'rgba(20, 184, 166, 0.22)',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Instrument Serif', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
        'full': '9999px',
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(18, 18, 18, 0.04), 0 2px 6px -1px rgba(18, 18, 18, 0.02)',
        'lift': '0 16px 36px -6px rgba(18, 18, 18, 0.08), 0 6px 14px -2px rgba(18, 18, 18, 0.04)',
        'glow': '0 0 30px -5px rgba(20, 184, 166, 0.25)',
        'spotlight': '0 0 40px -10px rgba(15, 91, 84, 0.35)',
      },
      animation: {
        'marquee': 'marquee 28s linear infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'blob': 'blob 7s infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(20px, -30px) scale(1.06)' },
          '66%': { transform: 'translate(-15px, 15px) scale(0.95)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
