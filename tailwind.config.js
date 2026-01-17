/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme')

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        navy: '#0D1B2A',
        'navy-dark': '#1B263B',
        slate: '#415A77',
        'slate-light': '#778DA9',
        pearl: '#E6ECF2',
        gold: '#D4AF37',
        'gold-light': '#E6C45A',
        danger: '#B3541E',
      },
      fontFamily: {
        sans: ['"Assistant"', '"Alef"', ...defaultTheme.fontFamily.sans],
      },
      borderRadius: {
        card: '18px',
      },
      boxShadow: {
        'card-xl': '0 25px 60px rgba(13, 27, 42, 0.08)',
      },
    },
  },
  plugins: [],
}

