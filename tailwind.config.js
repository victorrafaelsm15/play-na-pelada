/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        turf: { 950: '#082219', 900: '#0B2E24', 800: '#0F3D30', 700: '#155240', 600: '#1D6B52', 500: '#2B8566' },
        chalk: { DEFAULT: '#F2F4F1', line: '#DDE3DE', soft: '#E8ECE8' },
        ink: { DEFAULT: '#14211C', soft: '#33443C', muted: '#5B6B63' },
        card: { DEFAULT: '#FFC72C', deep: '#E8AE00', ink: '#2E2200' },
        whistle: { DEFAULT: '#E0442F', soft: '#FCE5E1' }
      },
      fontFamily: {
        display: ['"Barlow Condensed"', '"Arial Narrow"', 'sans-serif'],
        sans: ['Figtree', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif']
      },
      borderRadius: { xl2: '1.25rem' },
      boxShadow: { lift: '0 1px 0 rgba(20,33,28,.06), 0 8px 24px -12px rgba(15,61,48,.25)' },
      keyframes: {
        rise: { '0%': { opacity: 0, transform: 'translateY(12px)' }, '100%': { opacity: 1, transform: 'none' } },
        pop: { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.18)' }, '100%': { transform: 'scale(1)' } },
        flash: { '0%,100%': { opacity: 1 }, '50%': { opacity: .35 } }
      },
      animation: { rise: 'rise .35s ease-out both', pop: 'pop .35s ease-out', flash: 'flash 1s ease-in-out infinite' }
    }
  },
  plugins: []
};
