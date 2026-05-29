/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fdf4f0',
          100: '#fce9e1',
          200: '#fad3c3',
          300: '#f6b49b',
          400: '#f08b67',
          500: '#eb6a3d',
          600: '#e44f25',
          700: '#bd3c1b',
          800: '#9b3119',
          900: '#7d2916',
          950: '#421209',
        }
      }
    },
  },
  plugins: [],
}