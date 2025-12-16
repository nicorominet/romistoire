import React, { useMemo, useCallback } from 'react';
import { i18n } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useThemeContext } from '@/contexts/ThemeContext';
import { Search, X } from 'lucide-react';

interface FilterSectionProps {
  onFilterChange?: (name: string) => void;
}

const FilterSection: React.FC<FilterSectionProps> = React.memo(({ onFilterChange }) => {
  const { t } = i18n;
  const { filterName, setFilterName, themes } = useThemeContext();

  // Count matching themes
  const matchingCount = useMemo(() => {
    if (!filterName.trim()) return themes.length;
    const normalizedFilter = filterName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return themes.filter((theme) =>
      theme.name
        ?.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .includes(normalizedFilter) ||
      theme.description
        ?.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .includes(normalizedFilter)
    ).length;
  }, [filterName, themes]);

  const handleFilterChange = useCallback(
    (value: string) => {
      setFilterName(value);
      onFilterChange?.(value);
    },
    [setFilterName, onFilterChange]
  );

  const handleResetFilter = useCallback(() => {
    setFilterName('');
    onFilterChange?.('');
  }, [setFilterName, onFilterChange]);

  const hasFilter = filterName.trim().length > 0;

  return (
    <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-5 shadow-sm">
      <Label
        htmlFor="filterName"
        className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"
      >
        <Search className="w-4 h-4 text-story-purple" />
        {t('themes.searchThemes')}
      </Label>
      <div className="space-y-3">
        <div className="relative">
          <Input
            id="filterName"
            type="text"
            placeholder={t('themes.filterNamePlaceholder')}
            value={filterName}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="w-full rounded-md border-gray-300 dark:bg-gray-600 dark:text-white pr-10 focus:border-story-purple focus:ring-story-purple"
          />
          {hasFilter && (
            <button
              onClick={() => handleResetFilter()}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Results Info */}
        <div className="flex items-center justify-between text-xs">
          <p className="text-gray-600 dark:text-gray-400">
            {hasFilter ? (
              <span>
                {matchingCount} {matchingCount === 1 ? 'theme' : 'themes'} {t('themes.found')}
              </span>
            ) : (
              <span>
                {themes.length} {themes.length === 1 ? 'theme' : 'themes'} {t('themes.total')}
              </span>
            )}
          </p>

          {hasFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilter}
              className="h-auto p-0 text-xs text-story-purple hover:bg-transparent hover:underline"
            >
              {t('themes.clearSearch')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

FilterSection.displayName = 'FilterSection';

export default FilterSection;
