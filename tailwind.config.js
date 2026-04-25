/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#0b1310',
        card:       '#14251a',
        card2:      '#0a130e',
        primary:    '#c6ff4a',
        secondary:  '#ffffff80',
        white:      '#ffffff',
        danger:     '#FF4444',
        border:     '#ffffff1a',
      },
    },
  },
  plugins: [],
};
