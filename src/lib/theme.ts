import { STORAGE_KEYS } from "@/constants";

type Theme = "dark" | "light";

const systemTheme = (): Theme =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

/**
 * Theme chosen in the settings, or the OS preference when none was chosen.
 */
const storedTheme = (): Theme => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.THEME);
    if (stored === "dark" || stored === "light") return stored;
  } catch (e) {
    /* storage unavailable */
  }
  return systemTheme();
};

const apply = (theme: Theme) => document.documentElement.classList.toggle("dark", theme === "dark");

/** Applies the saved theme on <html>: called once at startup, before the first render. */
export const initTheme = () => apply(storedTheme());

/** Applies and saves the theme. useDarkMode() follows the <html> class. */
export const setTheme = (theme: Theme) => {
  apply(theme);
  try { localStorage.setItem(STORAGE_KEYS.THEME, theme); } catch (e) { /* storage unavailable */ }
};

/** Forgets the saved choice and goes back to the OS preference. */
export const resetTheme = () => {
  try { localStorage.removeItem(STORAGE_KEYS.THEME); } catch (e) { /* storage unavailable */ }
  apply(systemTheme());
};
