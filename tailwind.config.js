/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1a1d29',
        paper: '#f7f6f3',
        accent: '#3d5a80',
        high: '#c0392b',
        medium: '#d68910',
        low: '#1e8449',
      },
    },
  },
  plugins: [],
};
