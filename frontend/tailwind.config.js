/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#e9fbf0',
          100: '#c9f6da',
          200: '#94edb8',
          300: '#5fe296',
          400: '#33d977',
          500: '#25D366',
          600: '#1bb255',
          700: '#178c45',
          800: '#136f39',
          900: '#0f5a30',
        },
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
}
