import fs from 'fs';
import path from 'path';

let translations = null;
let initialLocale = "fr";

const i18n = {
  t: (key, params = {}) => {
    if (!translations) {
      console.warn('Translations not loaded yet');
      return key;
    }
    const locale = i18n.getCurrentLocale();
    let text = translations[locale]?.[key] || translations["en"]?.[key] || key;

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
      const localesPath = path.join(process.cwd(), 'src', 'locales');
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
