/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Brand
        red:     { DEFAULT: '#ff4655', dark: '#cc2233', light: '#ff6b77' },
        navy:    { DEFAULT: '#0f172a', light: '#1e293b', lighter: '#334155' },
        surface: { DEFAULT: '#131a2e', card: '#1a2340', border: '#1e2d4a' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Rajdhani', 'Inter', 'sans-serif'],
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #1a0a1e 100%)',
        'card-gradient': 'linear-gradient(145deg, #1a2340, #131a2e)',
        'red-glow': 'radial-gradient(ellipse at center, rgba(255,70,85,0.15) 0%, transparent 70%)',
      },
      boxShadow: {
        'red-glow': '0 0 20px rgba(255,70,85,0.3)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-red': 'pulseRed 2s infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp: { '0%': { opacity: 0, transform: 'translateY(20px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        pulseRed: { '0%,100%': { boxShadow: '0 0 0 0 rgba(255,70,85,0.4)' }, '50%': { boxShadow: '0 0 0 8px rgba(255,70,85,0)' } },
      },
    },
  },
  plugins: [],
}
