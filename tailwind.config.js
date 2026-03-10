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
          DEFAULT: '#0afdbd',
          50:  '#e6fffb',
          100: '#b3fff5',
          200: '#80ffee',
          300: '#4dffe8',
          400: '#0bfec1',
          500: '#0afdbd',
          600: '#0BB588',
          700: '#008f6b',
          800: '#006b50',
          900: '#004d3a',
        },
        dark: {
          DEFAULT: '#13111C',
          950: '#0a0a0f',
          900: '#13111C',
          800: '#202126',
          700: '#2a2f3e',
          600: '#3a3f4e',
          500: '#4a4f5e',
        }
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        accent: ['Bai Jamjuree', 'sans-serif'],
        mono: ['Fira Code', 'SF Mono', 'Consolas', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
        '3xl': '64px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(10, 253, 189, 0.1)',
        'glass-lg': '0 20px 60px 0 rgba(10, 253, 189, 0.15)',
        'inner-glass': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
      },
    },
  },
  plugins: [],
}
