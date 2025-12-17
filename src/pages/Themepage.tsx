import React, { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { i18n } from '@/lib/i18n';
import PageLayout from '@/components/Layout/PageLayout';
import useDarkMode from '@/hooks/useDarkMode';
import { useToast } from '@/hooks/use-toast';
import { ThemeProvider, useThemeContext } from '@/contexts/ThemeContext';
import { Theme } from '@/types/Theme';
import { AGE_GROUPS } from '@/types/Story';
import ThemeGrid from '@/components/Theme/ThemeGrid';
import ThemeDialog from '@/components/Theme/ThemeDialog';
import ConfirmDeleteDialog from '@/components/Theme/ConfirmDeleteDialog';
import { Loader2, Plus, Search, ArrowUpDown, Wand2, FolderSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue, // Note: shadcn select usually exports these
} from '@/components/ui/select';
import { useSeries } from '@/hooks/useSeries';
import { useThemeMutations } from '@/hooks/useThemes';

/**
 * Content component with cleaner, ergonomic UI
 */
const ThemepageContent: React.FC = () => {
  const navigate = useNavigate();
  const { t } = i18n;
  const darkMode = useDarkMode();
  const { toast } = useToast();
  const {
    themes,
    loading,
    setEditingTheme,
    filterName,
    setFilterName,
    filterAge,
    setFilterAge,
    filterSeries,
    setFilterSeries,
    sortOrder,
    setSortOrder,
    fetchThemes,
    removeTheme,
    addTheme,
    editTheme, // Need editTheme generic handler
    resetNewTheme,
  } = useThemeContext();

  const { data: seriesList } = useSeries();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [currentTheme, setCurrentTheme] = React.useState<Theme | null>(null);
  
  const [confirmDialogOpen, setConfirmDialogOpen] = React.useState(false);
  const [themeToDelete, setThemeToDelete] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);



  const openAddDialog = useCallback(() => {
    setCurrentTheme(null);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((theme: Theme) => {
    setCurrentTheme(theme);
    setDialogOpen(true);
  }, []);

  const handleSaveTheme = async (themeData: Partial<Theme>) => {
      try {
          if (currentTheme) {
              // Edit Mode
              await editTheme({ ...currentTheme, ...themeData } as Theme);
              toast({ title: t('common.success'), description: t('themes.themeUpdatedSuccess') });
          } else {
              // Add Mode
              // Force cast to any to bypass strict ID requirement if context types are slightly off for 'add'
              await addTheme(themeData as any);
              toast({ title: t('common.success'), description: t('themes.themeAddedSuccess') });
          }
          setDialogOpen(false);
      } catch (err) {
          toast({ 
              title: t('common.error'), 
              description: err instanceof Error ? err.message : t('common.operationFailed'), 
              variant: 'destructive' 
          });
      }
  };

  const handleDeleteTheme = useCallback((id: string) => {
    setThemeToDelete(id);
    setConfirmDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!themeToDelete) return;
    try {
      setIsDeleting(true);
      await removeTheme(themeToDelete);
      setConfirmDialogOpen(false);
      setThemeToDelete(null);
      toast({
        title: t('common.success'),
        description: t('themes.themeDeletedSuccess'),
      });
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err instanceof Error ? err.message : t('common.error'),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  }, [themeToDelete, removeTheme, toast, t]);

  const handleNavigateToStory = useCallback((storyId: string) => {
    navigate(`/stories/${storyId}`);
  }, [navigate]);

   const { mergeDuplicates } = useThemeMutations();

   const handleMergeDuplicates = useCallback(async () => {
    try {
      await mergeDuplicates.mutateAsync();
      await fetchThemes();
      toast({ title: t('common.success'), description: t('themes.duplicatesMerged') });
    } catch (err) {
      toast({ title: t('common.error'), description: t('themes.mergeFailed'), variant: 'destructive' });
    }
  }, [fetchThemes, toast, t, mergeDuplicates]);

  return (
    <PageLayout>
        {/* Ergonomic Toolbar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-4 z-10 backdrop-blur-md bg-white/90 dark:bg-gray-800/90">
            {/* Left: Title & Search */}
            <div className="flex items-center gap-4 w-full md:w-auto flex-1">
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap hidden sm:block">
                    {t('themes.manageThemes')}
                </h1>
                <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block"></div>
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input 
                        placeholder={t('themes.searchThemes')} 
                        className="pl-9 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 focus:ring-story-purple/20"
                        value={filterName}
                        onChange={(e) => setFilterName(e.target.value)}
                    />
                </div>
                
                {/* Filters Group */}
                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                    <Select value={filterAge} onValueChange={setFilterAge}>
                        <SelectTrigger className="w-[110px] h-9 text-xs bg-gray-50 border-gray-200">
                            <SelectValue placeholder={t('story.ageGroup')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('themes.allAges')}</SelectItem>
                            {AGE_GROUPS.map((age) => (
                                <SelectItem key={age} value={age}>{t(`ages.${age}`)}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={filterSeries} onValueChange={setFilterSeries}>
                        <SelectTrigger className="w-[130px] h-9 text-xs bg-gray-50 border-gray-200">
                             <SelectValue placeholder={t('story.series')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('story.allSeries')}</SelectItem>
                            {seriesList?.map((series: any) => (
                                <SelectItem key={series.id} value={series.id}>
                                    {series.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                 <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-gray-600 dark:text-gray-300"
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    title={t('themes.sort')}
                >
                    <ArrowUpDown className="w-4 h-4" />
                    <span className="hidden sm:inline">{sortOrder === 'asc' ? 'A-Z' : 'Z-A'}</span>
                </Button>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMergeDuplicates}
                    className="gap-2 text-gray-600 dark:text-gray-300 hidden sm:flex"
                    title={t('themes.mergeDuplicateThemes')}
                >
                    <Wand2 className="w-4 h-4" />
                </Button>

                <Button 
                    onClick={openAddDialog}
                    className="bg-story-purple hover:bg-story-purple-600 text-white gap-2 shadow-md hover:shadow-lg transition-all"
                >
                    <Plus className="w-4 h-4" />
                    {t('themes.addTheme')}
                </Button>
            </div>
        </div>

        {/* Content */}
        {!loading && themes.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-20 text-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-xl border border-white/20 dark:border-white/10 shadow-lg">
               <div className="w-16 h-16 bg-white/50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-4 border border-white/20">
                   <FolderSearch className="w-8 h-8 text-gray-400" />
               </div>
               <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                   {t('themes.noThemesFound')}
               </h3>
               <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">
                   {t('themes.createFirstThemeDescription')}
               </p>
               <Button onClick={openAddDialog} variant="outline" className="gap-2 bg-white/50 hover:bg-white/80">
                   <Plus className="w-4 h-4" />
                   {t('themes.addTheme')}
               </Button>
           </div>
        ) : (
            <ThemeGrid
                themes={themes}
                filterName={filterName}
                sortOrder={sortOrder}
                onEditTheme={openEditDialog}
                onDeleteTheme={handleDeleteTheme}
                onNavigateToStory={handleNavigateToStory}
                isLoading={loading}
            />
        )}

        {/* Unified Dialog */}
        <ThemeDialog 
            open={dialogOpen} 
            onOpenChange={setDialogOpen}
            theme={currentTheme}
            onSave={handleSaveTheme}
            loading={loading}
        />

        <ConfirmDeleteDialog
            open={confirmDialogOpen}
            onOpenChange={setConfirmDialogOpen}
            title={t('themes.deleteTheme')}
            description={t('themes.confirmDeleteThemeDescription')}
            onConfirm={handleConfirmDelete}
            isLoading={isDeleting}
        />
    </PageLayout>
  );
};

const Themepage: React.FC = () => {
  return (
    <ThemeProvider>
      <ThemepageContent />
    </ThemeProvider>
  );
};

export default Themepage;
