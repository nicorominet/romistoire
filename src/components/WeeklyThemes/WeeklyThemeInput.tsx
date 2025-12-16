import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { i18n } from '@/lib/i18n';

import { WeeklyTheme } from '@/types/Theme';

// Removed local Theme interface

interface Props {
  theme: WeeklyTheme;
  onChange: (week_number: number, field: 'theme_name' | 'theme_description', value: string) => void;
}

const ThemeCardInner: React.FC<Props> = ({ theme, onChange }) => {
  const { t } = i18n;
  const nameValid = useMemo(() => (theme.theme_name || '').trim() !== '', [theme.theme_name]);
  const descValid = useMemo(() => (theme.theme_description || '').trim() !== '', [theme.theme_description]);

  return (
    <Card className={`shadow-sm h-full ${!(nameValid && descValid) ? 'border-red-500' : ''}`}>
      <CardContent className="p-4 flex flex-col h-full">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-md font-medium text-gray-700 dark:text-gray-300">{t('WeeklyThemesPage.week')} {theme.week_number}</h4>
        </div>

        <div className="flex flex-col">
          <Label htmlFor={`themeName-${theme.week_number}`} className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('WeeklyThemesPage.themeName')}</Label>
          <Input
            id={`themeName-${theme.week_number}`}
            value={theme.theme_name || ''}
            onChange={(e) => onChange(theme.week_number, 'theme_name', e.target.value)}
            aria-invalid={!nameValid}
            aria-required
            className={`mt-2`}
          />
          {!nameValid && <p className="text-xs text-red-600 mt-1">{t('WeeklyThemesPage.validation.requiredName')}</p>}
        </div>

        <div className="flex flex-col mt-3 flex-grow">
          <Label htmlFor={`themeDescription-${theme.week_number}`} className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('WeeklyThemesPage.description')}</Label>
          <Textarea
            id={`themeDescription-${theme.week_number}`}
            value={theme.theme_description || ''}
            onChange={(e) => onChange(theme.week_number, 'theme_description', e.target.value)}
            aria-invalid={!descValid}
            aria-required
            className="mt-2 flex-grow min-h-[6rem]"
            rows={5}
          />
          {!descValid && <p className="text-xs text-red-600 mt-1">{t('WeeklyThemesPage.validation.requiredDescription')}</p>}
        </div>
      </CardContent>
    </Card>
  );
};

const ThemeCard = React.memo(ThemeCardInner);
export default ThemeCard;
