import type { Config } from 'tailwindcss';

/** Palette driven by CSS variables so one set of classes renders both themes (see globals.css). */
const scale = (name: string, steps: number[]) =>
  Object.fromEntries(steps.map((s) => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`]));

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: scale('ink', [950, 900, 800, 700, 600, 500]),
        slate: scale('slate', [50, 100, 200, 300, 400, 500, 600, 700]),
        accent: { DEFAULT: 'rgb(var(--accent) / <alpha-value>)', soft: '#0e7490' },
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
