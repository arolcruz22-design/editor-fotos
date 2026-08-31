/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        studio: {
          bg: '#0b0f14',
          panel: '#121821',
          border: '#1f2833',
          accent: '#f0a023',
          accent2: '#4fa3f5',
        },
      },
    },
  },
  plugins: [],
};
