import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import PageLayout from '@/components/Layout/PageLayout';
import { i18n } from '@/lib/i18n';
import ThemeCard from '@/components/WeeklyThemes/WeeklyThemeInput';
import { WeeklyTheme as ThemeType } from '@/types/Theme';
import { Loader2 } from 'lucide-react';
import { useWeeklyThemes, useWeeklyThemeMutation } from '@/hooks/useThemes';

const SECTIONS = [
  { start: 1, end: 12 },
  { start: 13, end: 24 },
  { start: 25, end: 36 },
  { start: 37, end: 48 },
  { start: 49, end: 60 },
];

const WeeklyThemesPage: React.FC = () => {
  const { t } = i18n;
  const { toast } = useToast();
  
  const { data: fetchedThemes = [], isLoading: loading } = useWeeklyThemes();
  const { mutateAsync: saveThemes } = useWeeklyThemeMutation();

  // Local state for editing
  const [themes, setThemes] = useState<ThemeType[]>([]);
  const [activeSection, setActiveSection] = useState(1);
  const [isSavingAll, setIsSavingAll] = useState(false);

  // Sync state with fetched data
  useEffect(() => {
    if (fetchedThemes) {
        setThemes(fetchedThemes as ThemeType[]);
    }
  }, [fetchedThemes]);

  const visibleThemes = useMemo(() => {
    const section = SECTIONS[activeSection - 1] || SECTIONS[0];
    const weeks: ThemeType[] = [];
    for (let w = section.start; w <= section.end; w++) {
      const found = themes.find(t => t.week_number === w);
      if (found) weeks.push(found);
      else weeks.push({ week_number: w, theme_name: '', theme_description: '' });
    }
    return weeks;
  }, [themes, activeSection]);

const handleThemeChange = useCallback((week_number: number, field: 'theme_name' | 'theme_description', value: string) => {
  setThemes(prev => {
    const existingTheme = prev.find(t => t.week_number === week_number);
    if (existingTheme) {
      return prev.map(t => t.week_number === week_number ? { ...t, [field]: value } : t);
    } else {
      return [...prev, { week_number, [field]: value, theme_name: '', theme_description: '' }];
    }
  });
}, []);

  const hasInvalid = useMemo(() => {
    return themes.some(t => !(t.theme_name || '').trim() || !(t.theme_description || '').trim());
  }, [themes]);

  const handleSaveAll = useCallback(async () => {
    setIsSavingAll(true);
    try {
      await saveThemes(themes);
      toast({ title: t('success.title'), description: t('WeeklyThemesPage.allThemesSaved') });
    } catch (err: any) {
      console.error(err);
      toast({ title: t('common.error'), description: t('WeeklyThemesPage.failedToSaveAllThemes', { message: err?.message || err }), variant: 'destructive' });
    } finally { setIsSavingAll(false); }
  }, [themes, t, toast, saveThemes]);

  return (
    <PageLayout>
        {/* Premium Background */}
        <div className="fixed inset-0 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-purple-900/20 dark:to-slate-900 -z-10" />
        
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="flex flex-col gap-8">
            
            {/* Header with Glass Effect */}
            <div className="flex items-center justify-between bg-white/40 dark:bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-sm">
              <div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
                  {t('WeeklyThemesPage.title')}
                </h1>
                <p className="mt-2 text-gray-600 dark:text-gray-300 font-medium">
                  {t('timeline.manageWeeklyThemes')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                    onClick={handleSaveAll} 
                    disabled={isSavingAll || hasInvalid}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/30 border-0 transition-all duration-300 hover:scale-105"
                >
                  {isSavingAll ? <span className="inline-flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('WeeklyThemesPage.savingAllThemes')}</span> : t('WeeklyThemesPage.saveAllThemes')}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Timeline Sidebar */}
              <aside className="lg:col-span-3">
                <div className="sticky top-6">
                  <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-2xl border border-white/20 shadow-sm p-6">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6 px-2">{t('WeeklyThemesPage.section')}</h3>
                    <nav aria-label="Sections" className="relative flex flex-col gap-1">
                      {/* Vertical Line */}
                      <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />
                      
                      {SECTIONS.map((s, i) => {
                        const isActive = activeSection === i + 1;
                        return (
                          <button 
                            key={i} 
                            onClick={() => setActiveSection(i + 1)} 
                            aria-current={isActive ? 'true' : undefined} 
                            className={`group relative flex items-center py-3 pl-10 pr-4 rounded-xl text-sm font-medium transition-all duration-300 ${
                                isActive 
                                ? 'bg-white dark:bg-slate-700 shadow-md text-indigo-600 dark:text-indigo-300 translate-x-1' 
                                : 'text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-slate-700/50 hover:text-indigo-500'
                            }`}
                          >
                            {/* Dot on Line */}
                            <span className={`absolute left-[13px] w-2.5 h-2.5 rounded-full border-2 transition-all duration-300 ${
                                isActive 
                                ? 'bg-indigo-600 border-indigo-600 scale-125' 
                                : 'bg-gray-200 dark:bg-gray-700 border-transparent group-hover:bg-indigo-400'
                            }`} />
                            
                            {t('weeklyThemes.week')} {s.start}-{s.end}
                          </button>
                        );
                      })}
                    </nav>
                  </div>
                </div>
              </aside>

              {/* Main Content */}
              <div className="lg:col-span-9">
                {loading ? (
                  <div className="flex justify-center items-center h-64 bg-white/30 dark:bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-white/20">
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mx-auto mb-4" />
                      <p className="text-gray-500 font-medium">{t('common.loading')}</p>
                    </div>
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {visibleThemes.length === 0 ? (
                      <div className="text-center py-20 bg-white/30 dark:bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-white/20">
                        <p className="text-xl font-medium text-gray-600 dark:text-gray-300">{t('themes.noThemesFound')}</p>
                      </div>
                      ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {visibleThemes.map((theme, idx) => (
                           <div key={theme.week_number} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 50}ms` }}>
                               <ThemeCard theme={theme} onChange={handleThemeChange} />
                           </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
    </PageLayout>
  );
};

export default WeeklyThemesPage;
