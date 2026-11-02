import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: { 500: '#6366F1', 600: '#8B5CF6' },
        panel: { light: '#FFFFFF', dark: '#191A20' },
      },
      fontFamily: {
        sans: ['"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        serif: ['"Songti SC"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Menlo', 'monospace'],
        hand: ['"LXGW WenKai"', 'cursive'],
      },
      boxShadow: {
        card: '0 18px 48px -12px rgba(15, 23, 42, 0.28)',
        panel: '0 1px 0 rgba(15,23,42,0.06)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: { 'fade-up': 'fade-up .25s ease-out both' },
    },
  },
  plugins: [],
} satisfies Config
