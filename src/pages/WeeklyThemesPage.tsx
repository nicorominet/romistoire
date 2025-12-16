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
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t('WeeklyThemesPage.title')}</h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('timeline.manageWeeklyThemes')}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleSaveAll} disabled={isSavingAll || hasInvalid}>
                  {isSavingAll ? <span className="inline-flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('WeeklyThemesPage.savingAllThemes')}</span> : t('WeeklyThemesPage.saveAllThemes')}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <aside className="lg:col-span-1">
                <div className="space-y-6 sticky top-6">
                  <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('WeeklyThemesPage.section')}</h3>
                    <nav aria-label="Sections" className="mt-3 flex flex-col gap-2">
                      {SECTIONS.map((s, i) => (
                        <button key={i} onClick={() => setActiveSection(i + 1)} aria-current={activeSection === i + 1 ? 'true' : undefined} className={`text-left px-3 py-2 rounded-md text-sm ${activeSection === i + 1 ? 'bg-indigo-600 text-white' : 'bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200'}`}>
                          {t('weeklyThemes.week')} {s.start}-{s.end}
                        </button>
                      ))}
                    </nav>
                  </div>
                </div>
              </aside>

              <div className="lg:col-span-3">
                {loading ? (
                  <div className="flex justify-center items-center py-24 bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 animate-spin text-story-purple mx-auto mb-4" aria-hidden="true" />
                      <p className="text-gray-600 dark:text-gray-400 font-medium" aria-live="polite">{t('common.loading')}</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    {visibleThemes.length === 0 ? (
                      <div className="text-center py-16 bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                        <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">{t('themes.noThemesFound')}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{t('themes.createFirstTheme')}</p>
                      </div>
                      ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                        {visibleThemes.map(theme => <ThemeCard key={theme.week_number} theme={theme} onChange={handleThemeChange} />)}
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
