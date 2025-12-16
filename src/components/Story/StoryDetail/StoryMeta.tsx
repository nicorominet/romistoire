import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, BookOpen, User } from 'lucide-react';
import { i18n } from '@/lib/i18n';
import { formatDate } from '@/lib/utils';

interface StoryMetaProps {
  ageGroup: string;
  readingTime: number;
  weeklyTheme?: string;
  seriesName?: string;
  createdAt?: string;
  weekNumber?: number;
  dayOrder?: number;
  version?: number;
  locale?: string;
}

const StoryMeta = ({ ageGroup, readingTime, weeklyTheme, seriesName, createdAt, weekNumber, dayOrder, version, locale }: StoryMetaProps) => {
  const { t } = i18n;

  const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  return (
    <div className="flex flex-col items-center gap-6 mt-8 p-6 bg-secondary/10 rounded-xl border border-secondary/20 max-w-3xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6 text-sm w-full">
        <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t('story.ageGroup')}</span>
            <div className="flex items-center gap-2 font-medium">
                <User className="h-4 w-4 text-primary" />
                {ageGroup} {t('story.years')}
            </div>
        </div>

        <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t('story.readingTime')}</span>
            <div className="flex items-center gap-2 font-medium">
                <Clock className="h-4 w-4 text-primary" />
                {readingTime} min
            </div>
        </div>

        {createdAt && (
            <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t('story.created')}</span>
                <div className="flex items-center gap-2 font-medium">
                    <Calendar className="h-4 w-4 text-primary" />
                    {formatDate(createdAt)}
                </div>
            </div>
        )}

        {weekNumber && (
             <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t('story.week')}</span>
                <div className="flex items-center gap-2 font-medium">
                    <Calendar className="h-4 w-4 text-primary" />
                    #{weekNumber}
                </div>
            </div>
        )}
        
        {dayOrder && (
             <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t('story.day')}</span>
                <div className="flex items-center gap-2 font-medium">
                    <Calendar className="h-4 w-4 text-primary" />
                    {days[dayOrder - 1] || dayOrder}
                </div>
            </div>
        )}

        {version && (
             <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t('story.version', 'Version')}</span>
                <div className="flex items-center gap-2 font-medium">
                    v{version}
                </div>
            </div>
        )}
        
         {locale && (
             <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t('story.language', 'Langue')}</span>
                <div className="flex items-center gap-2 font-medium uppercase">
                    {locale}
                </div>
            </div>
        )}

      </div>

      {(weeklyTheme || seriesName) && (
          <div className="flex flex-wrap justify-center gap-3 pt-4 border-t border-border/50 w-full">
            {weeklyTheme && (
                <Badge variant="outline" className="gap-2 py-1.5 px-3">
                    <BookOpen className="h-3 w-3" />
                    <span className="opacity-70">{t('story.theme', 'Thème')}:</span> {weeklyTheme}
                </Badge>
            )}
            {seriesName && (
                <Badge variant="outline" className="gap-2 py-1.5 px-3">
                    <BookOpen className="h-3 w-3" />
                    <span className="opacity-70">{t('story.series', 'Série')}:</span> {seriesName}
                </Badge>
            )}
          </div>
      )}
    </div>
  );
};

export default StoryMeta;
