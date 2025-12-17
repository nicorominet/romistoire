import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PenLine, BookOpen } from "lucide-react";
import { i18n } from "@/lib/i18n";
import useDarkMode from "@/hooks/useDarkMode";

const HeroSection = () => {
  const { t } = i18n;
  const darkMode = useDarkMode();

  return (
    <section className="relative overflow-hidden py-16 lg:py-24">
        {/* Animated Background Blobs */}
        <div className="absolute inset-0 overflow-hidden -z-10 pointer-events-none">
            <div className={`absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] opacity-40 animate-pulse-slow ${darkMode ? 'bg-purple-800' : 'bg-purple-300'}`}></div>
            <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[100px] opacity-40 animate-pulse-slow delay-1000 ${darkMode ? 'bg-indigo-900' : 'bg-pink-200'}`}></div>
            <div className={`absolute top-[40%] left-[30%] w-[30%] h-[30%] rounded-full blur-[80px] opacity-30 animate-pulse-slow delay-2000 ${darkMode ? 'bg-blue-900' : 'bg-indigo-200'}`}></div>
        </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/20 shadow-sm text-purple-700 dark:text-purple-200 text-xs font-semibold animate-fade-in hover:scale-105 transition-transform duration-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
            </span>
            {t("home.badge")}
          </div>

          <h1 className={`text-4xl md:text-5xl lg:text-7xl font-black tracking-tight mb-6 animate-slide-up leading-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 drop-shadow-sm">
               {t("home.welcome")}
            </span>
          </h1>
          
          <p className={`text-lg md:text-xl mb-8 max-w-2xl mx-auto leading-relaxed animate-slide-up bg-opacity-0 delay-100 font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            {t("home.subtitle")}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up delay-200">
            <Link to="/create">
              <Button size="lg" className="h-12 px-8 text-lg rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-xl shadow-indigo-500/30 border-t border-white/20 transition-all duration-300 hover:scale-105 hover:-translate-y-1">
                <PenLine className="mr-2 h-5 w-5" />
                {t("home.cta")}
              </Button>
            </Link>
            <Link to="/stories">
                <Button variant="outline" size="lg" className="h-12 px-8 text-lg rounded-full bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border-white/30 dark:border-white/10 hover:bg-white/80 dark:hover:bg-slate-800/80 hover:scale-105 transition-all duration-300 shadow-sm">
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
