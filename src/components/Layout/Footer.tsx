import { i18n } from "@/lib/i18n";
import { useState, useEffect } from "react";
import useDarkMode from '@/hooks/useDarkMode';

const Footer = () => {
  const { t } = i18n;
  const currentYear = new Date().getFullYear();
  const darkMode = useDarkMode();
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', storedTheme === 'dark');  }, []);


  return (
    <footer className={`bg-white dark:bg-gray-800 border-t border-story-purple-100 dark:border-gray-700 mt-12 py-6`}>
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row justify-between items-center">
          <div className="text-center sm:text-left mb-4 sm:mb-0">
            <h3 className="text-xl font-bold text-story-purple dark:text-white">
              {t("app.title")}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              &copy; {currentYear} {t("footer.rights")}
            </p>
          </div>

          <div className="flex space-x-4">
            <div className="bg-story-blue-50 dark:bg-story-blue-900 p-2 rounded-full">
              <div className="w-8 h-8 flex items-center justify-center text-story-purple dark:text-story-blue-100">
                <span role="img" aria-label="Book" className="text-xl">📚</span>
              </div>
            </div>
            <div className="bg-story-green-50 dark:bg-story-green-900 p-2 rounded-full">
              <div className="w-8 h-8 flex items-center justify-center text-story-purple dark:text-story-green-100">
                <span role="img" aria-label="Pencil" className="text-xl">✏️</span>
              </div>
            </div>
            <div className="bg-story-yellow-50 dark:bg-story-yellow-900 p-2 rounded-full">
              <div className="w-8 h-8 flex items-center justify-center text-story-purple dark:text-story-yellow-100">
                <span role="img" aria-label="Palette" className="text-xl">🎨</span>
              </div>
            </div>
            <div className="bg-story-pink-50 dark:bg-story-pink-900 p-2 rounded-full">
              <div className="w-8 h-8 flex items-center justify-center text-story-purple dark:text-story-pink-100">
                <span role="img" aria-label="Star" className="text-xl">⭐</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

