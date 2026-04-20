/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        neon: {
          green:  '#00ff88',
          purple: '#bf00ff',
          pink:   '#ff00aa',
          blue:   '#00aaff',
          yellow: '#ffee00',
        },
      },
      animation: {
        'grid-scroll': 'gridScroll 20s linear infinite',
        'glitch':      'glitch 0.3s ease-in-out infinite',
        'pulse-neon':  'pulseNeon 2s ease-in-out infinite',
        'float':       'float 3s ease-in-out infinite',
        'scanline':    'scanline 8s linear infinite',
      },
      keyframes: {
        gridScroll: {
          '0%':   { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '40px 40px' },
        },
        glitch: {
          '0%, 100%': { transform: 'translate(0)' },
          '20%':      { transform: 'translate(-2px, 2px)' },
          '40%':      { transform: 'translate(2px, -2px)' },
          '60%':      { transform: 'translate(-1px, 1px)' },
          '80%':      { transform: 'translate(1px, -1px)' },
        },
        pulseNeon: {
          '0%, 100%': { boxShadow: '0 0 10px #00ff88, 0 0 20px #00ff88' },
          '50%':      { boxShadow: '0 0 20px #00ff88, 0 0 40px #00ff88, 0 0 60px #00ff88' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        scanline: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
      },
    },
  },
  plugins: [],
}
