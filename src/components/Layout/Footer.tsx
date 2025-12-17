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
    <footer className="w-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-t border-white/20 dark:border-white/5 py-3">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
            <h3 className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-700 to-gray-500 dark:from-gray-200 dark:to-gray-400">
              {t("app.title")}
            </h3>
            <span className="text-xs text-gray-400 dark:text-gray-500">|</span>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              &copy; {currentYear} {t("footer.rights")}
            </p>
        </div>

        <div className="flex gap-2">
           {['📚', '✏️', '🎨', '⭐'].map((emoji, idx) => (
               <div key={idx} className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100/50 dark:bg-slate-800/50 text-xs shadow-sm hover:scale-110 transition-transform cursor-default">
                  {emoji}
               </div>
           ))}
        </div>
      </div>
    </footer>
  );
};

export default Footer;

