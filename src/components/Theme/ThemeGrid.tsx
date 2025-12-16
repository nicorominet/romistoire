import React, { useMemo, useCallback } from 'react';
import { i18n } from '@/lib/i18n';
import { useThemeContext } from '@/contexts/ThemeContext';
import ThemeCard from './ThemeCard';
import { Theme } from '@/types/Theme';
import { ThemeGridSkeleton } from './ThemeSkeleton';

interface ThemeGridProps {
  themes: Theme[];
  filterName: string;
  sortOrder: 'asc' | 'desc';
  onEditTheme: (theme: Theme) => void;
  onDeleteTheme: (id: string) => void;
  onNavigateToStory: (id: string) => void;
  isLoading?: boolean;
}

const ThemeGrid: React.FC<ThemeGridProps> = React.memo(
  ({ themes, filterName, sortOrder, onEditTheme, onDeleteTheme, onNavigateToStory, isLoading }) => {
    const { t } = i18n;
    const { expandedThemeId, setExpandedThemeId, storiesUsingTheme, fetchStoriesUsingTheme } =
      useThemeContext();

    // Normalize string for search
    const normalizeString = useCallback((str: string | null | undefined): string => {
      if (!str || typeof str !== 'string') {
        return '';
      }

      try {
        return str
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
      } catch (err) {
        console.error('Error normalizing string:', err);
        return str.toLowerCase();
      }
    }, []);

    // Filter and sort themes
    const filteredAndSortedThemes = useMemo(() => {
      if (!Array.isArray(themes) || themes.length === 0) {
        return [];
      }

      let result = themes.filter(
        (theme) =>
          theme &&
          typeof theme === 'object' &&
          theme.id &&
          theme.name &&
          theme.description !== null &&
          theme.description !== undefined
      );

      // Apply filter
      if (filterName && filterName.trim()) {
        try {
          const normalizedFilter = normalizeString(filterName);
          result = result.filter((theme) => {
            try {
              const nameNormalized = normalizeString(theme.name || '');
              const descNormalized = normalizeString(theme.description || '');
              return (
                nameNormalized.includes(normalizedFilter) ||
                descNormalized.includes(normalizedFilter)
              );
            } catch (err) {
              console.error('Error normalizing theme data:', err);
              return false;
            }
          });
        } catch (err) {
          console.error('Error applying filter:', err);
        }
      }

      // Apply sort
      try {
        result.sort((a, b) => {
          const nameA = (a.name || '').toLowerCase();
          const nameB = (b.name || '').toLowerCase();
          const comparison = nameA.localeCompare(nameB);
          return sortOrder === 'asc' ? comparison : -comparison;
        });
      } catch (err) {
        console.error('Error sorting themes:', err);
      }

      return result;
    }, [themes, filterName, sortOrder, normalizeString]);

    const handleToggleExpand = useCallback(
      async (themeId: string) => {
        if (expandedThemeId === themeId) {
          setExpandedThemeId(null);
        } else {
          setExpandedThemeId(themeId);
          try {
            await fetchStoriesUsingTheme(themeId);
          } catch (err) {
            console.error('Failed to fetch stories:', err);
          }
        }
      },
      [expandedThemeId, setExpandedThemeId, fetchStoriesUsingTheme]
    );

    if (isLoading) {
      return <ThemeGridSkeleton />;
    }

    if (filteredAndSortedThemes.length === 0) {
      return (
        <div className="text-center py-16 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
            {t('themes.noThemesFound')}
          </p>
          {filterName && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              "{filterName}" {t('themes.matchedNoResults')}
            </p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
            {t('themes.tryAdjustingFilter')}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Results Summary */}
        <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-semibold text-gray-900 dark:text-white">{filteredAndSortedThemes.length}</span>{' '}
            {filteredAndSortedThemes.length === 1 ? t('themes.grid.theme_one') : t('themes.grid.theme_other')} {filterName ? t('themes.grid.found') : t('themes.grid.total')}
          </p>
          {filterName && (
            <button
              onClick={() => {
                // This would be handled by parent component
                console.log('Clear filter');
              }}
              className="text-xs text-story-purple hover:underline dark:text-purple-300"
            >
              {t('themes.grid.clearFilter')}
            </button>
          )}
        </div>

        {/* Themes Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredAndSortedThemes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              isExpanded={expandedThemeId === theme.id}
              storiesUsingTheme={expandedThemeId === theme.id ? storiesUsingTheme : []}
              onEdit={onEditTheme}
              onDelete={onDeleteTheme}
              onToggleExpand={handleToggleExpand}
              onNavigateToStory={onNavigateToStory}
            />
          ))}
        </div>
      </div>
    );
  }
);

ThemeGrid.displayName = 'ThemeGrid';

export default ThemeGrid;
