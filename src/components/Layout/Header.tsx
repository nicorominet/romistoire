import { i18n } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Book, PenLine, Settings, GlobeIcon, Columns3, Clock, Palette } from "lucide-react";
import { useState, useEffect } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import useDarkMode from '@/hooks/useDarkMode';

const Header = () => {
  const [locale, setLocale] = useState(i18n.getCurrentLocale());
  const [showLanguageDialog, setShowLanguageDialog] = useState(false);
  const darkMode = useDarkMode();

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', storedTheme === 'dark');  }, []);


  const { t, changeLocale, getCurrentLocale, getAvailableLocales } = i18n;
  const currentLocale = locale || 'fr';
  const availableLocales = getAvailableLocales();

  const handleLocaleSelection = (newLocale: string) => {
    changeLocale(newLocale);
    setLocale(newLocale);
    setShowLanguageDialog(false);
    toast.success(t('settings.languageChanged'));
  };

  const getNavLinkClass = (path: string) => {
     // rudimentary check for active state, can be improved with useLocation but kept simple for now
     const isActive = window.location.pathname === path; 
     return `relative px-3 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
        isActive 
          ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' 
          : 'text-gray-600 dark:text-gray-300 hover:text-indigo-600 hover:bg-white/50 dark:hover:bg-white/5'
     }`;
  };

  return (
    <header className="sticky top-0 w-full z-50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-white/20 dark:border-white/5 shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 text-white p-2 rounded-xl shadow-lg shadow-indigo-500/30 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
             <Book className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-600 dark:from-white dark:to-gray-300">
            {t("app.title")}
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1 bg-gray-100/50 dark:bg-slate-800/50 p-1 rounded-full border border-white/20">
          <Link to="/" className={getNavLinkClass("/")}>
               {t("nav.home")}
          </Link>
          <Link to="/stories" className={getNavLinkClass("/stories")}>
               {t("nav.stories")}
          </Link>
          <Link to="/weekly-themes" className={getNavLinkClass("/weekly-themes")}>
               {t("nav.weeklyThemes")}
          </Link>
          <Link to="/timeline" className={getNavLinkClass("/timeline")}>
               {t("nav.timeline")}
          </Link>
          <Link to="/series-management" className={getNavLinkClass("/series-management")}>
               {t("nav.series")}
          </Link>
          <Link to="/theme" className={getNavLinkClass("/theme")}>
               {t("nav.themes")}
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link to="/create">
            <Button className="hidden sm:flex rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md shadow-indigo-500/20 px-6">
              <PenLine className="mr-2 h-4 w-4" />
              {t("nav.create")}
            </Button>
          </Link>

          <AlertDialog open={showLanguageDialog} onOpenChange={setShowLanguageDialog}>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-gray-100/50">
                <GlobeIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-white/20">
              <AlertDialogHeader>
                <AlertDialogTitle>{t('settings.selectLanguage')}</AlertDialogTitle>
                <AlertDialogDescription>{t('settings.languageDescription')}</AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4">
                {availableLocales.map((locale) => (
                  <Button
                    key={locale}
                    variant={locale === currentLocale ? "default" : "outline"}
                    className={`w-full ${locale === currentLocale ? 'bg-indigo-600 text-white' : 'bg-transparent'}`}
                    onClick={() => handleLocaleSelection(locale)}
                  >
                    {locale === "en" ? "English" : "Français"}
                  </Button>
                ))}
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Link to="/settings">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-gray-100/50">
              <Settings className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
};
  
export default Header;