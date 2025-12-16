import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { i18n } from '@/lib/i18n';
import { format, startOfWeek, endOfWeek, setWeek, startOfYear, addWeeks, getISOWeeksInYear } from 'date-fns';
import { fr } from 'date-fns/locale';

import { WeeklyTheme } from '@/types/Theme';

// Removed local Theme interface

interface Props {
  theme: WeeklyTheme;
  onChange: (week_number: number, field: 'theme_name' | 'theme_description', value: string) => void;
}

const getWeekDates = (weekNumber: number, t: any) => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  // const totalWeeks = getISOWeeksInYear(currentDate); // ISO year might have 52 or 53 weeks.

  // We allow week 53 to show dates even if the year only has 52 ISO weeks (it will overlap w/ next year's week 1)
  // But week 54+ is definitely custom/out of calendar.
  if (weekNumber > 53) {
      return t('WeeklyThemesPage.outOfCalendar');
  }

  // Using ISO week logic roughly: 
  // Get start of year
  const yearStart = startOfYear(new Date(currentYear, 0, 1));
  
  // Set the week. Note: setWeek usage depends on local week start options.
  // A simpler robust way for "Week N of Year":
  // 1. Get the first Monday of the year (or the Monday of the first ISO week)
  // 2. Add (weekNumber - 1) weeks.
  
  // Using date-fns helper:
  // We want the Nth ISO week.
  // Let's rely on setWeek with weekStartsOn: 1 (Monday) and firstWeekContainsDate: 4 (ISO standard)
  const dateInWeek = setWeek(yearStart, weekNumber, { weekStartsOn: 1, firstWeekContainsDate: 4 });
  
  const start = startOfWeek(dateInWeek, { weekStartsOn: 1 });
  const end = endOfWeek(dateInWeek, { weekStartsOn: 1 });

  return `${format(start, 'dd/MM', { locale: fr })} - ${format(end, 'dd/MM', { locale: fr })}`;
};

const ThemeCardInner: React.FC<Props> = ({ theme, onChange }) => {
  const { t } = i18n;
  const nameValid = useMemo(() => (theme.theme_name || '').trim() !== '', [theme.theme_name]);
  const descValid = useMemo(() => (theme.theme_description || '').trim() !== '', [theme.theme_description]);
  
  const dateRange = useMemo(() => getWeekDates(theme.week_number, t), [theme.week_number, t]);

  return (
    <Card className={`shadow-sm h-full ${!(nameValid && descValid) ? 'border-red-500' : ''}`}>
      <CardContent className="p-4 flex flex-col h-full">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-md font-medium text-gray-700 dark:text-gray-300">
            {t('WeeklyThemesPage.week')} {theme.week_number} 
            <span className="ml-2 text-sm text-gray-500 font-normal">({dateRange})</span>
          </h4>
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
