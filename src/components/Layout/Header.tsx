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

  return (
    <header className={`bg-white dark:bg-gray-800 border-b border-story-purple-100 dark:border-gray-700 shadow-sm py-4`}>
      <div className="container mx-auto px-4 flex flex-wrap items-center justify-between">
        <Link to="/" className="flex items-center space-x-2">
          <Book className="h-8 w-8 text-story-purple" />
          <span className="text-2xl font-bold text-story-purple dark:text-white">
            {t("app.title")}
          </span>
        </Link>

        <nav className="flex items-center space-x-1 sm:space-x-4">
          <Link to="/">
            <Button variant="ghost" className="text-gray-700 dark:text-gray-300 hover:text-story-purple">
              {t("nav.home")}
            </Button>
          </Link>
          <Link to="/stories">
            <Button variant="ghost" className="text-gray-700 dark:text-gray-300 hover:text-story-purple">
              {t("nav.stories")}
            </Button>
          </Link>
          <Link to="/weekly-themes">
            <Button variant="ghost" className="text-gray-700 dark:text-gray-300 hover:text-story-purple">
              <Columns3 className="mr-2 h-4 w-4" />
              {t("nav.weeklyThemes")}
            </Button>
          </Link>
          <Link to="/timeline">
            <Button variant="ghost" className="text-gray-700 dark:text-gray-300 hover:text-story-purple">
              <Clock className="mr-2 h-4 w-4" />
              {t("nav.timeline")}
              </Button>
          </Link>
          <Link to="/series-management">
             <Button variant="ghost" className="text-gray-700 dark:text-gray-300 hover:text-story-purple">
               <Book className="mr-2 h-4 w-4" />
               {t("nav.series")}
             </Button>
          </Link>
          <Link to="/theme">
            <Button variant="ghost" className="text-gray-700 dark:text-gray-300 hover:text-story-purple">
              <Palette className="mr-2 h-4 w-4" />
              {t("nav.themes")}
              </Button>
          </Link>
          <Link to="/create">
            <Button className="hidden sm:flex bg-story-purple hover:bg-story-purple-600 text-white">
              <PenLine className="mr-2 h-4 w-4" />
              {t("nav.create")}
              </Button>
          </Link>

          <AlertDialog open={showLanguageDialog} onOpenChange={setShowLanguageDialog}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full">
                <GlobeIcon className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <AlertDialogHeader>
                <AlertDialogTitle>{t('settings.selectLanguage')}</AlertDialogTitle>
                <AlertDialogDescription>{t('settings.languageDescription')}</AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4">
                {availableLocales.map((locale) => (
                  <Button
                    key={locale}
                    variant={locale === currentLocale ? "default" : "outline"}
                    className={`w-full ${locale === currentLocale ? 'bg-story-purple-500 text-white' : 'bg-transparent text-gray-900 dark:text-gray-100'}`}
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
            <Button variant="ghost" size="icon" className="rounded-full text-gray-700 dark:text-gray-300">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Header;