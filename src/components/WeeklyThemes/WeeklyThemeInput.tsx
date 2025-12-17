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
  const isFilled = theme.theme_name && theme.theme_description;

  return (
    <div className={`
        group relative h-full flex flex-col rounded-2xl transition-all duration-300
        bg-white/70 dark:bg-slate-800/60 backdrop-blur-md border border-white/50 dark:border-white/10
        hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 hover:bg-white/90 dark:hover:bg-slate-800/80
        ${!isFilled ? 'border-dashed border-gray-300 dark:border-gray-600' : ''}
        ${!(nameValid && descValid) ? 'ring-1 ring-red-400/50 bg-red-50/30' : ''}
    `}>
        {/* Header Strip with Date */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100/50 dark:border-gray-700/50">
            <div className="flex items-center gap-3">
                 <span className={`
                    flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold shadow-sm
                    ${isFilled ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}
                 `}>
                    {theme.week_number}
                 </span>
                 <span className="text-xs font-medium text-gray-400 bg-gray-50 dark:bg-gray-900/50 px-2 py-1 rounded-md">
                    {dateRange}
                 </span>
            </div>
            {/* Status Indicator */}
            <div className={`w-2 h-2 rounded-full ${isFilled ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-gray-300'}`} />
        </div>

        <div className="p-4 flex flex-col flex-1 gap-1">
             {/* Title Input - Textarea for wrapping */}
             <div className="relative group/input flex-1 min-h-[3.5rem] mb-2">
                 {(!theme.theme_name) && (
                     <span className="absolute left-0 top-1 text-lg font-bold text-gray-300 pointer-events-none group-focus-within/input:hidden">
                        {t('WeeklyThemesPage.themeName')}
                     </span>
                 )}
                 <Textarea 
                    className="w-full h-full bg-transparent border-0 p-0 text-lg font-bold text-gray-800 dark:text-gray-100 placeholder-transparent focus:ring-0 focus:outline-none transition-colors resize-none leading-tight overflow-hidden"
                    placeholder={t('WeeklyThemesPage.themeName')}
                    value={theme.theme_name || ''}
                    onChange={(e) => onChange(theme.week_number, 'theme_name', e.target.value)}
                    rows={2} 
                 />
             </div>
             
             {/* Divider */}
             <div className="h-px w-12 bg-indigo-200/50 dark:bg-indigo-700/50 mb-2" />

             {/* Description Area */}
             <Textarea
                className="flex-1 min-h-[5rem] bg-transparent border-0 p-0 resize-none text-sm text-gray-600 dark:text-gray-400 focus:ring-0 focus:outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600 leading-relaxed"
                placeholder={t('WeeklyThemesPage.description')}
                value={theme.theme_description || ''}
                onChange={(e) => onChange(theme.week_number, 'theme_description', e.target.value)}
             />

             {/* Validation Msg */}
             {!(nameValid && descValid) && (
                <div className="mt-2 text-[10px] font-medium text-red-500 flex items-center gap-1 animate-pulse">
                    <span>•</span> {t('WeeklyThemesPage.validation.requiredName')}
                </div>
             )}
        </div>
        
        {/* Soft bottom glow on hover */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-500/0 to-transparent group-hover:via-indigo-500/50 transition-all duration-500 rounded-b-2xl opacity-0 group-hover:opacity-100" />
    </div>
  );
};

const ThemeCard = React.memo(ThemeCardInner);
export default ThemeCard;
