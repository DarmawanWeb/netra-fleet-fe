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
        // Status colours are theme variables: darker steps in light mode keep them above 4.5:1.
        warn: 'rgb(var(--warn) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        ok: 'rgb(var(--ok) / <alpha-value>)',
      },
      fontFamily: { mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'] },
      screens: {
        // Full-height "wall" layout of the dashboard: wide and tall enough to fit without scrolling.
        wall: { raw: '(min-width: 1280px) and (min-height: 700px)' },
      },
    },
  },
  plugins: [],
};

export default config;
