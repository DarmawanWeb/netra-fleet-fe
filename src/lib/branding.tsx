'use client';

import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useI18n } from '@/i18n';
import { api } from './api';
import { BRAND_KEY, BRAND_STYLE_ID as STYLE_ID } from './boot';
import type { Branding } from './types';

/**
 * The client's product name, colour and logo from the license (GET /api/v1/branding, public so the
 * login page has it). The colour replaces the accent of both themes, adjusted until it stays
 * readable on each; the last branding is kept in the browser and applied before paint.
 */

export const DEFAULT_BRANDING: Branding = { name: 'NETRA' };

type RGB = [number, number, number];

const parseHex = (c?: string): RGB | undefined => {
  if (!c || !/^#[0-9a-f]{6}$/i.test(c)) return undefined;
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: RGB) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

export const contrast = (a: RGB, b: RGB) => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/** Mixes c towards `toward` until it reaches `min` contrast against `bg`. */
export function readable(c: RGB, bg: RGB, toward: RGB, min = 4.5): RGB {
  const mix = (v: number, to: number, t: number) => Math.round(v + (to - v) * t);
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const mixed: RGB = [mix(c[0], toward[0], t), mix(c[1], toward[1], t), mix(c[2], toward[2], t)];
    if (contrast(mixed, bg) >= min) return mixed;
  }
  return toward;
}

// Surfaces the accent is drawn on (ink-900 of each theme in globals.css).
const DARK_SURFACE: RGB = [10, 16, 28];
const LIGHT_SURFACE: RGB = [255, 255, 255];

/** CSS overriding the accent of both themes, or '' for the default colours. */
export function brandCss(b: Branding): string {
  const light = parseHex(b.color);
  const dark = parseHex(b.color_dark) ?? light;
  if (!light || !dark) return '';
  const l = readable(light, LIGHT_SURFACE, [0, 0, 0]);
  const d = readable(dark, DARK_SURFACE, [255, 255, 255]);
  return `html.light{--accent:${l.join(' ')}}html:not(.light){--accent:${d.join(' ')}}`;
}

function apply(b: Branding) {
  const css = brandCss(b);
  let style = document.getElementById(STYLE_ID);
  if (css && !style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  if (style) style.textContent = css;
  try {
    localStorage.setItem(BRAND_KEY, JSON.stringify({ branding: b, css }));
  } catch {
    /* private mode: applied, not remembered */
  }
}

function cached(): Branding | undefined {
  try {
    return (JSON.parse(localStorage.getItem(BRAND_KEY) ?? 'null') as { branding?: Branding } | null)?.branding;
  } catch {
    return undefined;
  }
}

const BrandingContext = createContext<{ branding: Branding; refresh: () => void }>({
  branding: DEFAULT_BRANDING,
  refresh: () => undefined,
});

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const tagline = t('login.subtitle');
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const last = cached();
    if (last) setBranding(last);
    let alive = true;
    api
      .branding()
      .then((b) => {
        if (!alive) return;
        apply(b);
        setBranding(b);
      })
      .catch(() => undefined); // offline or an older server: keep the last or the default
    return () => {
      alive = false;
    };
  }, [tick]);
  // The page metadata writes the default title on navigation; the product's name goes over it.
  const pathname = usePathname();
  useEffect(() => {
    const title = `${branding.name} — ${tagline}`;
    document.title = title;
    const frame = requestAnimationFrame(() => (document.title = title));
    return () => cancelAnimationFrame(frame);
  }, [branding.name, tagline, pathname]);
  return <BrandingContext.Provider value={{ branding, refresh: () => setTick((t) => t + 1) }}>{children}</BrandingContext.Provider>;
}

export const useBranding = () => useContext(BrandingContext);
