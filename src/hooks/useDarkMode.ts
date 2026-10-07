import { useState, useEffect } from 'react';

const isDark = () => document.documentElement.classList.contains('dark');

/**
 * Tracks dark mode, i.e. the "dark" class on <html>.
 * Watches the class itself, so it follows every toggle (header switch, settings, other tabs via storage).
 */
const useDarkMode = () => {
  const [darkMode, setDarkMode] = useState<boolean>(isDark);

  useEffect(() => {
    const update = () => setDarkMode(isDark());

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('storage', update);

    return () => {
      observer.disconnect();
      window.removeEventListener('storage', update);
    };
  }, []);

  return darkMode;
};

export default useDarkMode;
