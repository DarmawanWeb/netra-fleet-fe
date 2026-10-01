import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#05080f', 900: '#0a101c', 800: '#101929', 700: '#18243a', 600: '#24334f', 500: '#3a4b6b' },
        accent: { DEFAULT: '#22d3ee', soft: '#0e7490' },
        warn: '#f59e0b',
        danger: '#ef4444',
        ok: '#22c55e',
      },
      fontFamily: { mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'] },
    },
  },
  plugins: [],
};

export default config;
