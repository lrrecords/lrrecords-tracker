import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // LRRecords brand palette — swap these hexes for exact values
        // picked from the logo file once you drop it into /public/logo.
        navy: {
          DEFAULT: '#0B1E3D',
          50: '#EEF1F7',
          100: '#D3DAE9',
          200: '#A7B5D3',
          300: '#7B90BD',
          400: '#4F6BA7',
          500: '#2B4A87',
          600: '#1B356A',
          700: '#13284F',
          800: '#0B1E3D',
          900: '#060F20',
          950: '#03080F',
        },
        orange: {
          DEFAULT: '#F5820D',
          50: '#FFF3E6',
          100: '#FFE1C0',
          200: '#FFC685',
          300: '#FFAA4A',
          400: '#FC9722',
          500: '#F5820D',
          600: '#CC6606',
          700: '#9C4E05',
          800: '#6B3603',
          900: '#3D1E02',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(11,30,61,0.08), 0 1px 2px rgba(11,30,61,0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
