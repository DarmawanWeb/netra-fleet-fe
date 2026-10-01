import type en from './en';

/** Same shape as the English dictionary with string leaves. */
type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };
export type Messages = Shape<typeof en>;

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

/** Every translation key, e.g. "map.title". */
export type MessageKey = Leaves<typeof en>;
export type Locale = 'en' | 'id';
