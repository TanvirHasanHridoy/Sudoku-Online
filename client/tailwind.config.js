/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          light: '#f8fafc', // slate-50
          dark: '#030712',  // gray-950
        },
        panel: {
          light: '#ffffff',
          dark: '#0b0f19',  // deep custom dark blue-gray
        },
        border: {
          light: '#e2e8f0', // slate-200
          dark: '#1e293b',  // slate-800
        },
        accent: {
          light: '#4f46e5', // indigo-600
          dark: '#6366f1',  // indigo-500
          hover: '#4338ca',
        },
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'scale-in': 'scaleIn 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'pulse-subtle': 'pulseSubtle 2s infinite ease-in-out',
        'shake': 'shake 0.4s cubic-bezier(.36,.07,.19,.97) both',
        'float-emoji': 'floatEmoji 1.5s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        shake: {
          '10%, 90%': { transform: 'translate3d(-1px, 0, 0)' },
          '20%, 80%': { transform: 'translate3d(2px, 0, 0)' },
          '30%, 50%, 70%': { transform: 'translate3d(-3px, 0, 0)' },
          '40%, 60%': { transform: 'translate3d(3px, 0, 0)' },
        },
        floatEmoji: {
          '0%': { transform: 'translateY(0) scale(0.5)', opacity: '0' },
          '15%': { transform: 'translateY(-20px) scale(1.2)', opacity: '1' },
          '100%': { transform: 'translateY(-100px) scale(0.8)', opacity: '0' },
        }
      }
    },
  },
  plugins: [],
}
