import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, BookOpen, User, Sparkles, Cpu } from 'lucide-react';
import { i18n } from '@/lib/i18n';
import { formatDate } from '@/lib/utils';
import { DAY_NAMES_EN, getDayLabel } from '@/utils/dayUtils';

interface StoryMetaProps {
  ageGroup: string;

  /** Topic of the story's week (free text, not a story theme) */
  weekTopic?: string | null;
  seriesName?: string;
  createdAt?: string;
  weekNumber?: number;
  dayOrder?: number;
  version?: number;
  locale?: string;
  source?: 'manual' | 'gemini' | 'ollama';
  is_manually_edited?: boolean;
}

const StoryMeta = ({ ageGroup, weekTopic, seriesName, createdAt, weekNumber, dayOrder, version, locale, source, is_manually_edited }: StoryMetaProps) => {
  const { t } = i18n;


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
                    {DAY_NAMES_EN[dayOrder - 1] ? getDayLabel(DAY_NAMES_EN[dayOrder - 1]) : dayOrder}
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
        
        <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t('story.source.title', 'Source')}</span>
            <div className="flex items-center gap-2 font-medium text-story-purple-600 dark:text-story-purple-400">
                {source === 'gemini' && <Sparkles className="h-4 w-4" />}
                {source === 'ollama' && <Cpu className="h-4 w-4" />}
                {source === 'manual' && <User className="h-4 w-4" />}
                <span className="capitalize">
                    {t(`story.source.${source || 'manual'}`)}
                    {!!is_manually_edited && source !== 'manual' && (
                        <span className="ml-1 text-xs opacity-70 italic">{t('story.source.editedByHuman')}</span>
                    )}
                </span>
            </div>
        </div>

      </div>

      {(weekTopic || seriesName) && (
          <div className="flex flex-wrap justify-center gap-3 pt-4 border-t border-border/50 w-full">
            {weekTopic && (
                <span className="inline-flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{t('weeklyTopics.topicOfWeek')} :</span>
                    <span className="font-medium">{weekTopic}</span>
                </span>
            )}
            {seriesName && (
                <Badge variant="outline" className="gap-2 py-1.5 px-3">
                    <BookOpen className="h-3 w-3" />
                    <span className="opacity-70">{t('story.series')}:</span> {seriesName}
                </Badge>
            )}
          </div>
      )}
    </div>
  );
};

export default StoryMeta;
