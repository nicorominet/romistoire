import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PenLine, BookOpen } from "lucide-react";
import { i18n } from "@/lib/i18n";
import useDarkMode from "@/hooks/useDarkMode";

const HeroSection = () => {
  const { t } = i18n;
  const darkMode = useDarkMode();

  return (
    <section className="relative overflow-hidden py-24 lg:py-32">
        {/* Abstract Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
            <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[100px] opacity-30 ${darkMode ? 'bg-purple-900' : 'bg-purple-200'}`}></div>
            <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[100px] opacity-30 ${darkMode ? 'bg-indigo-900' : 'bg-indigo-200'}`}></div>
        </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block mb-4 px-4 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-medium animate-fade-in">
            ✨ {t("home.badge")}
          </div>
          <h1 className={`text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-8 animate-slide-up ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400">
               {t("home.welcome")}
            </span>
          </h1>
          
          <p className={`text-xl md:text-2xl mb-10 max-w-2xl mx-auto leading-relaxed animate-slide-up bg-opacity-0 delay-100 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {t("home.subtitle")}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up delay-200">
            <Link to="/create">
              <Button size="lg" className="h-14 px-8 text-lg rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-500/25 transition-all hover:scale-105">
                <PenLine className="mr-2 h-5 w-5" />
                {t("home.cta")}
              </Button>
            </Link>
            <Link to="/stories">
                <Button variant="outline" size="lg" className="h-14 px-8 text-lg rounded-full border-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
                    <BookOpen className="mr-2 h-5 w-5" />
                    {t("home.browse")}
                </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
