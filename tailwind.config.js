/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./script.js",
    "./games/**/*.html",
    "./games/**/*.js",
    "./tools/**/*.html",
    "./tools/**/*.js"
  ],
  theme: {
    extend: {
      // Custom Colors
      colors: {
        pink: '#ff4785',
        orange: '#ff7e33',
        green: '#00d063',
        blue: '#1ea7fd',
        dark: '#1e293b',
        chalk: '#f8fafc',
        // 'act' tool
        engPink: "#ff4785",
        engOrange: "#ff7e33",
        engGreen: "#00d063",
        engBlue: "#1ea7fd",
        engDark: "#111827",
        engChalk: "#f8fafc",
        engYellow: "#FACC15",
        // class-tally, bingo, card-maker, team-picker
        brand: {
          pink: '#ff4785',
          orange: '#ff7e33',
          green: '#00d063',
          blue: '#1ea7fd',
          dark: '#1e293b',
          chalk: '#f8fafc'
        },
        slate: {
          850: '#151f32',
        },
        surface: 'rgba(255, 255, 255, 0.85)',
        border: 'rgba(203, 213, 225, 0.6)',
        purple: '#7C4DFF',
        kk: {
          pink: '#FF6B95',
          orange: '#FF8C42',
          green: '#00E676',
          blue: '#2979FF',
          dark: '#1e293b',
          chalk: '#f8fafc'
        },
        e1: {
          pink: '#FF6B95',
          orange: '#FF8C42',
          green: '#00E676',
          blue: '#2979FF',
          dark: '#1e293b',
          chalk: '#f8fafc'
        },
        kkpink: '#FF6B95',
        kkorange: '#FF8C42',
        kkgreen: '#00E676',
        kkblue: '#2979FF',
        kkdark: '#1e293b',
        kkchalk: '#f8fafc',

      },

      // Typography
      fontFamily: {
        heading: ['Fredoka', 'sans-serif'],
        headings: ['Fredoka', 'sans-serif'],
        body: ['Nunito', 'sans-serif'],
        sans: ['Fredoka', 'sans-serif'],
        mono: ['Share Tech Mono', 'monospace'],
      },

      screens: {
        'xs': '475px',
        '3xl': '1600px',
        '4xl': '1920px',
      },

      // Effects
      boxShadow: {
        'hard-sm': '2px 2px 0px 0px rgba(30, 41, 59, 1)',
        'hard': '4px 4px 0px 0px rgba(30, 41, 59, 1)',
        'hard-hover': '6px 6px 0px 0px rgba(30, 41, 59, 1)',
        'hard-md': '6px 6px 0px 0px rgba(30, 41, 59, 1)',
        'hard-lg': '8px 8px 0px 0px rgba(30, 41, 59, 1)',
        'hard-xl': '12px 12px 0px 0px rgba(30, 41, 59, 1)',
        'neobrutal': '6px 6px 0px 0px rgba(30, 41, 59, 1)',
        'neobrutal-sm': '3px 3px 0px 0px rgba(30, 41, 59, 1)',
        'neobrutal-inset': 'inset 4px 4px 0px 0px rgba(30, 41, 59, 0.1)',
        'brutal': '4px 4px 0px 0px rgba(17, 24, 39, 1)',
        'brutal-sm': '2px 2px 0px 0px rgba(17, 24, 39, 1)',
        'brutal-dark': '4px 4px 0px 0px rgba(100, 116, 139, 1)',
        'brutal-sm-dark': '2px 2px 0px 0px rgba(100, 116, 139, 1)',
        'brutal-hover': '6px 6px 0px 0px rgba(17, 24, 39, 1)',
        'brutal-hover-dark': '6px 6px 0px 0px rgba(100, 116, 139, 1)',
        'neon-sm': '2px 2px 0px 0px rgba(0, 0, 0, 0.5)',
        'neon': '4px 4px 0px 0px rgba(0, 0, 0, 0.5)',
        'neo': '0 10px 15px -3px rgba(51, 65, 85, 0.15), 0 4px 6px -2px rgba(51, 65, 85, 0.15)',
        'neo-sm': '0 4px 6px -1px rgba(51, 65, 85, 0.15), 0 2px 4px -1px rgba(51, 65, 85, 0.15)',
        'neo-lg': '0 20px 25px -5px rgba(51, 65, 85, 0.15), 0 10px 10px -5px rgba(51, 65, 85, 0.15)',
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'glow': '0 0 15px rgba(249, 115, 22, 0.3)',
        'inner-light': 'inset 0 2px 4px 0 rgba(255, 255, 255, 0.3)',
        'inner-neo': 'inset 3px 3px 0px 0px rgba(203, 213, 225, 0.3)',
        'card': '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)',
        "tab-inactive": "inset 0 -4px 0 0 rgba(17, 24, 39, 0.2)",
      },

      // Animations
      animation: {
        'pop-in': 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        'slide-down': 'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'shake': 'shake 0.4s cubic-bezier(.36,.07,.19,.97) both',
        'pulse-card': 'pulseCard 1.5s infinite',
        'slide-up': 'slideUp 0.3s ease-out forwards',
        'slide-up-fade': 'slideUpFade 0.3s ease-out forwards',
        'bounce-sm': 'bounce-sm 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'blob': 'blob 7s infinite',
        'float-1': 'float-icon-1 20s infinite linear',
        'float-2': 'float-icon-2 25s infinite linear reverse',
        'float-3': 'float-icon-3 15s infinite linear',
      },

      keyframes: {
        'bounce-slight': {
          '0%, 100%': { transform: 'translateY(-3%)' },
          '50%': { transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        popIn: {
            '0%': { transform: 'scale(0.9) translateY(10px)', opacity: '0' },
            '100%': { transform: 'scale(1) translateY(0)', opacity: '1' }
        },
        'slide-down': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        slideDown: {
            '0%': { transform: 'translateY(-20px)', opacity: '0' },
            '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        slideUp: {
            '0%': { transform: 'translateY(20px)', opacity: '0' },
            '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        shake: {
            '10%, 90%': { transform: 'translate3d(-1px, 0, 0)' },
            '20%, 80%': { transform: 'translate3d(2px, 0, 0)' },
            '30%, 50%, 70%': { transform: 'translate3d(-4px, 0, 0)' },
            '40%, 60%': { transform: 'translate3d(4px, 0, 0)' }
        },
        pulseCard: {
            '0%, 100%': { boxShadow: '0 0 0 0px rgba(249, 115, 22, 0.4)' },
            '50%': { boxShadow: '0 0 0 8px rgba(249, 115, 22, 0)' }
        },
        'bounce-sm': {
            '0%': { transform: 'scale(0.8)', opacity: '0' },
            '100%': { transform: 'scale(1)', opacity: '1' },
        },
        slideUpFade: {
            '0%': { transform: 'translateY(100%)', opacity: '0' },
            '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        blob: {
            '0%': { transform: 'translate(0px, 0px) scale(1)' },
            '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
            '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
            '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        'float-icon-1': {
            '0%': { transform: 'translate(0, 0) rotate(0deg)' },
            '33%': { transform: 'translate(30px, -50px) rotate(120deg)' },
            '66%': { transform: 'translate(-20px, 20px) rotate(240deg)' },
            '100%': { transform: 'translate(0, 0) rotate(360deg)' },
        },
        'float-icon-2': {
            '0%': { transform: 'translate(0, 0) rotate(0deg)' },
            '50%': { transform: 'translate(-40px, -30px) rotate(-180deg)' },
            '100%': { transform: 'translate(0, 0) rotate(-360deg)' },
        },
        'float-icon-3': {
            '0%': { transform: 'translate(0, 0) scale(1)' },
            '50%': { transform: 'translate(20px, 40px) scale(1.2)' },
            '100%': { transform: 'translate(0, 0) scale(1)' },
        }
      }
    }
  },
  plugins: [],
}
