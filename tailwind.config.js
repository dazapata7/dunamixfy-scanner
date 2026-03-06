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
          DEFAULT: '#00E5BF',
          50: '#e6fffb',
          100: '#b3fff5',
          200: '#80ffee',
          300: '#4dffe8',
          400: '#1affe1',
          500: '#00E5BF',
          600: '#00bf9f',
          700: '#00997f',
          800: '#00735f',
          900: '#004d40',
        },
        cyan: {
          DEFAULT: '#00E5BF',
          400: '#1affe1',
          500: '#00E5BF',
          600: '#00bf9f',
        },
        purple: {
          400: '#a855f7',
          500: '#9333ea',
          600: '#7e22ce',
        },
        dark: {
          DEFAULT: '#0a0e1a',
          950: '#05070d',
          900: '#0a0e1a',
          800: '#1a1f2e',
          700: '#2a2f3e',
          600: '#3a3f4e',
          500: '#4a4f5e',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['Fira Code', 'SF Mono', 'Consolas', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
        '3xl': '64px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 229, 191, 0.1)',
        'glass-lg': '0 20px 60px 0 rgba(0, 229, 191, 0.15)',
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
