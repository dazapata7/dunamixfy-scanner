/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#00D9C0',
          50: '#e6fffe',
          100: '#b3fff9',
          200: '#80fff4',
          300: '#4dffef',
          400: '#1affe9',
          500: '#00D9C0',
          600: '#00b3a0',
          700: '#008d80',
          800: '#006760',
          900: '#004140',
        },
        dark: {
          DEFAULT: '#0a0e1a',
          900: '#0a0e1a',
          800: '#1a1f2e',
          700: '#2a2f3e',
          600: '#3a3f4e',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
