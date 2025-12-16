
let translations = null;
let initialLocale = "fr";

const i18n = {
  t: (key, params = {}) => {
    if (!translations) {
      console.warn('Translations not loaded yet');
      return key;
    }
    const locale = i18n.getCurrentLocale();
    
    const get = (obj, path) => {
        if (!obj) return undefined;
        const nested = path.split('.').reduce((acc, part) => acc && acc[part], obj);
        if (nested) return nested;
        return obj[path];
    };
    
    let text = get(translations[locale], key) || get(translations["en"], key) || key;

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
      // Browser environment only
      const [enResponse, frResponse] = await Promise.all([
        fetch('/src/locales/en.json', {
          headers: {
            'Accept': 'application/json'
          }
        }),
        fetch('/src/locales/fr.json', {
          headers: {
            'Accept': 'application/json'
          }
        })
      ]);

      if (!enResponse.ok || !frResponse.ok) {
        throw new Error('Failed to load one or more locale files');
      }

      const [en, fr] = await Promise.all([
        enResponse.json(),
        frResponse.json()
      ]);

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