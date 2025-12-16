import React, { useCallback } from 'react';
import { i18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, Wand2, Palette } from 'lucide-react';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useToast } from '@/hooks/use-toast';

interface ThemeHeaderProps {
  onMergeDuplicates?: () => Promise<void>;
}

const ThemeHeader: React.FC<ThemeHeaderProps> = React.memo(({ onMergeDuplicates }) => {
  const { t } = i18n;
  const { sortOrder, setSortOrder, loading, themes } = useThemeContext();
  const { toast } = useToast();

  const handleToggleSort = useCallback(() => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  }, [sortOrder, setSortOrder]);

  const handleMergeDuplicates = useCallback(async () => {
    if (!onMergeDuplicates) return;

    try {
      await onMergeDuplicates();
      toast({
        title: t('common.success'),
        description: t('themes.duplicatesMerged'),
      });
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err instanceof Error ? err.message : 'Failed to merge duplicates',
        variant: 'destructive',
      });
    }
  }, [onMergeDuplicates, toast, t]);

  return (
    <div className="bg-gradient-to-r from-story-purple/5 to-blue-500/5 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        {/* Left Section - Title & Description */}
        <div className="flex items-start gap-4 flex-1">
          <div className="p-3 rounded-lg bg-story-purple/10 dark:bg-purple-900/30">
            <Palette className="w-6 h-6 text-story-purple dark:text-purple-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t('themes.manageThemes')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1 max-w-2xl">
              {t('themes.manageThemesDescription')}
            </p>
          </div>
        </div>

        {/* Right Section - Stats & Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
          {/* Stats Badge */}
          <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-2xl font-bold text-story-purple dark:text-purple-400">{themes.length}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">{t('themes.themesCount')}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 flex-1 sm:flex-initial">
            <Button
              onClick={handleToggleSort}
              variant="outline"
              size="sm"
              className="gap-2 dark:hover:bg-gray-700 flex-1 sm:flex-initial"
              disabled={loading}
              title={sortOrder === 'asc' ? 'Sort Z to A' : 'Sort A to Z'}
            >
              <ArrowUpDown className="w-4 h-4" />
              <span className="hidden sm:inline">{sortOrder === 'asc' ? '↓' : '↑'}</span>
            </Button>

            {onMergeDuplicates && (
              <Button
                onClick={handleMergeDuplicates}
                variant="outline"
                size="sm"
                className="gap-2 dark:hover:bg-gray-700 flex-1 sm:flex-initial"
                disabled={loading}
              >
                <Wand2 className="w-4 h-4" />
                <span className="hidden sm:inline">{t('themes.merge')}</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

ThemeHeader.displayName = 'ThemeHeader';

export default ThemeHeader;
