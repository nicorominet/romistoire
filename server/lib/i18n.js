import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// src/locales, found from this file (not from the working directory the server was started in)
const LOCALES_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales');

let translations = null;
let initialLocale = "fr";

/**
 * Value of a key in a locale file: nested ("pdf.tocTitle" -> { pdf: { tocTitle } }), or flat for older keys.
 * @returns {string|undefined}
 */
const lookup = (messages, key) => {
  if (!messages) return undefined;
  if (typeof messages[key] === 'string') return messages[key];
  const value = key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), messages);
  return typeof value === 'string' ? value : undefined;
};

const i18n = {
  t: (key, params = {}) => {
    if (!translations) {
      console.warn('Translations not loaded yet');
      return key;
    }
    const locale = i18n.getCurrentLocale();
    let text = lookup(translations[locale], key) || lookup(translations["en"], key) || key;

    Object.entries(params).forEach(([paramKey, value]) => {
      text = text.replace(`{{${paramKey}}}`, value);
    });

    return text;
  },

  changeLocale: (locale) => {
    if (translations?.[locale]) {
      initialLocale = locale;
      return true;
    }
    console.error(`Locale '${locale}' is not supported`);
    return false;
  },

  getCurrentLocale: () => initialLocale,

  getAvailableLocales: () => Object.keys(translations || {}),

  isLoaded: () => translations !== null
};

async function loadLocales() {
  try {
      const localesPath = LOCALES_PATH;
      const en = JSON.parse(fs.readFileSync(path.join(localesPath, 'en.json'), 'utf8'));
      const fr = JSON.parse(fs.readFileSync(path.join(localesPath, 'fr.json'), 'utf8'));
      
      translations = {
        en,
        fr,
      };
      
      return true;
  } catch (err) {
    console.error("Failed to load locales:", err);
    translations = { 
      en: {},
      fr: {}
    };
    return false;
  }
}

// Initialize translations
const init = async () => {
  await loadLocales();
  return i18n;
};

export { i18n, init };
