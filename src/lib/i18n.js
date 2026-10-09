import { useSyncExternalStore } from "react";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import obf from "@/locales/obf.json";
import { STORAGE_KEYS } from "@/constants";

// Bundled at build time: a runtime fetch of /src/locales only works with the Vite dev server
const translations = { en, fr, obf };
const DEFAULT_LOCALE = "fr";

const readStoredLocale = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LOCALE);
    return stored && translations[stored] ? stored : DEFAULT_LOCALE;
  } catch (e) {
    return DEFAULT_LOCALE;
  }
};

let currentLocale = readStoredLocale();
const listeners = new Set();

const i18n = {
  t: (key, params = {}) => {
    const get = (obj, path) => {
        if (!obj) return undefined;
        const nested = path.split('.').reduce((acc, part) => acc && acc[part], obj);
        if (nested) return nested;
        return obj[path];
    };

    let text = get(translations[currentLocale], key) || get(translations["en"], key) || key;

    Object.entries(params).forEach(([paramKey, value]) => {
      text = text.replace(`{{${paramKey}}}`, value);
    });

    return text;
  },

  /**
   * Switches the UI language, persists it and notifies subscribers (re-renders the app).
   * @param {string} locale - "fr", "en" or "obf".
   * @returns {boolean} false if the locale is unknown.
   */
  changeLocale: (locale) => {
    if (!translations[locale]) {
      console.error(`Locale '${locale}' is not supported`);
      return false;
    }
    currentLocale = locale;
    try { localStorage.setItem(STORAGE_KEYS.LOCALE, locale); } catch (e) { /* storage unavailable */ }
    document.documentElement.lang = locale === "obf" ? DEFAULT_LOCALE : locale;
    listeners.forEach((listener) => listener());
    return true;
  },

  getCurrentLocale: () => currentLocale,

  getAvailableLocales: () => Object.keys(translations),

  /**
   * @param {() => void} listener - Called after every locale change.
   * @returns {() => void} Unsubscribe function.
   */
  subscribe: (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  isLoaded: () => true
};

/**
 * Current locale as React state: the calling component re-renders (with its children) on change.
 * @returns {string} Current locale.
 */
const useLocale = () => useSyncExternalStore(i18n.subscribe, i18n.getCurrentLocale);

// Kept async for the bootstrap in main.tsx
const init = async () => {
  document.documentElement.lang = currentLocale === "obf" ? DEFAULT_LOCALE : currentLocale;
  return i18n;
};

export { i18n, init, useLocale };
