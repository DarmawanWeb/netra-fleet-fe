'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import en from './en';
import id from './id';
import type { Locale, MessageKey, Messages } from './types';

const dictionaries: Record<Locale, Messages> = { en, id };
const LOCALE_KEY = 'netra.locale';

type Vars = Record<string, string | number>;

interface I18n {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: MessageKey, vars?: Vars) => string;
  /** Translate a dynamic key (state names, categories); falls back to the raw value. */
  tx: (prefix: string, value: string | null | undefined, vars?: Vars) => string;
  intl: string;
}

const I18nContext = createContext<I18n | null>(null);

function lookup(dict: Messages, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

const fill = (text: string, vars?: Vars) => (vars ? text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : text);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  useEffect(() => {
    const saved = localStorage.getItem(LOCALE_KEY);
    if (saved === 'en' || saved === 'id') setLocaleState(saved);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    localStorage.setItem(LOCALE_KEY, l);
    setLocaleState(l);
  }, []);

  const value = useMemo<I18n>(() => {
    const dict = dictionaries[locale];
    const t = (key: MessageKey, vars?: Vars) => fill(lookup(dict, key) ?? lookup(en, key) ?? key, vars);
    const tx = (prefix: string, value: string | null | undefined, vars?: Vars) => {
      if (!value) return '—';
      const text = lookup(dict, `${prefix}.${value}`) ?? lookup(en, `${prefix}.${value}`);
      return text ? fill(text, vars) : value.replace(/_/g, ' ');
    };
    return { locale, setLocale, t, tx, intl: locale === 'id' ? 'id-ID' : 'en-GB' };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n outside I18nProvider');
  return ctx;
}

export type { Locale, MessageKey };
