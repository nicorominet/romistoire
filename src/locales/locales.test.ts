import { describe, it, expect } from 'vitest';
import fr from './fr.json';
import en from './en.json';

type Texts = { [key: string]: string | Texts };

const flatten = (texts: Texts, prefix = ''): string[] =>
  Object.entries(texts).flatMap(([key, value]) =>
    typeof value === 'string' ? [prefix + key] : flatten(value, `${prefix}${key}.`));

/** Source of the app (raw text, tests left out): the client, and the server (the PDF export translates its texts). */
const sources = import.meta.glob(
  ['/src/**/*.{ts,tsx,js}', '/server/**/*.js', '!/src/**/*.test.*', '!/server/tests/**'],
  { query: '?raw', import: 'default', eager: true }
);
const code = Object.values(sources).join('\n');
// Keys written in full ("story.title") and prefixes completed at run time (t(`ages.${age}`), "pdf." + style)
const literals = new Set([...code.matchAll(/[`'"]([A-Za-z][\w-]*(?:\.[\w-]+)+)[`'"]/g)].map((m) => m[1]));
const dynamicPrefixes = [
  ...[...code.matchAll(/[`'"]([\w.]+\.)\$\{/g)].map((m) => m[1]),
  ...[...code.matchAll(/[`'"]([\w.]+\.)[`'"]\s*\+/g)].map((m) => m[1]),
];

const frKeys = flatten(fr as Texts);
const enKeys = flatten(en as Texts);

describe('Translations', () => {
  it('fr and en have the same keys', () => {
    expect(enKeys.filter((key) => !frKeys.includes(key))).toEqual([]);
    expect(frKeys.filter((key) => !enKeys.includes(key))).toEqual([]);
  });

  it('every key is used by the code (remove the dead ones from fr.json and en.json)', () => {
    const unused = frKeys.filter((key) => !literals.has(key) && !dynamicPrefixes.some((prefix) => key.startsWith(prefix)));
    expect(unused).toEqual([]);
  });

  it('keeps the {{placeholders}} of each text in both languages', () => {
    const get = (texts: Texts, key: string) => key.split('.').reduce<Texts | string>((node, part) => (node as Texts)[part], texts) as string;
    const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
    const mismatched = frKeys.filter((key) =>
      JSON.stringify(placeholders(get(fr as Texts, key))) !== JSON.stringify(placeholders(get(en as Texts, key))));
    expect(mismatched).toEqual([]);
  });
});
