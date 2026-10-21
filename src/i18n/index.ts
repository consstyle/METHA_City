import { de } from './de';

/** Sprache der Oberfläche: nur Deutsch, wie MethaDesk. */
export const LOCALE = 'de';
/** Für Datums- und Zahlenformate (Schweiz). */
export const INTL_LOCALE = 'de-CH';

type DeepString<T> = { readonly [K in keyof T]: T[K] extends string ? string : DeepString<T[K]> };

/** Form des Katalogs; eine weitere Sprache müsste dieselben Schlüssel haben. */
export type Messages = DeepString<typeof de>;

export function getMessages(): Messages {
  return de;
}

/** Ersetzt {Variablen} in einem Text; fehlende bleiben sichtbar, damit sie auffallen. */
export function format(template: string, vars: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (Object.hasOwn(vars, key) ? String(vars[key]) : match));
}
