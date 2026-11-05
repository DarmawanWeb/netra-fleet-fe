/**
 * Inline scripts for <head> that run before paint, in a module without 'use client' so the root
 * layout (a server component) gets the strings themselves.
 */

export const THEME_KEY = 'netra.theme';
export const BRAND_KEY = 'netra.branding';
export const BRAND_STYLE_ID = 'netra-brand';

/** Applies the saved theme (no flash). */
const themeScript = `try{var t=localStorage.getItem('${THEME_KEY}')||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.className=t}catch(e){}`;

/** Applies the last branding colours (no flash); see branding.tsx. */
const brandScript = `try{var b=JSON.parse(localStorage.getItem('${BRAND_KEY}')||'null');if(b&&b.css){var s=document.createElement('style');s.id='${BRAND_STYLE_ID}';s.textContent=b.css;document.head.appendChild(s)}}catch(e){}`;

export const bootScript = themeScript + brandScript;
