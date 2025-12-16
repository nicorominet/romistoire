import React, { useCallback, useMemo } from 'react';
import { i18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Edit, Trash2, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { useThemeContext } from '@/contexts/ThemeContext';
import { Theme } from '@/types/Theme';
import { Story } from '@/types/Story';
import { cn, getAgeGroupColor, formatDate } from '@/lib/utils';

interface ThemeCardProps {
  theme: Theme;
  isExpanded: boolean;
  storiesUsingTheme: Story[];
  onEdit: (theme: Theme) => void;
  onDelete: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onNavigateToStory: (id: string) => void;
}

const ThemeCard: React.FC<ThemeCardProps> = React.memo(
  ({
    theme,
    isExpanded,
    storiesUsingTheme,
    onEdit,
    onDelete,
    onToggleExpand,
    onNavigateToStory,
  }) => {
    const { t } = i18n;
    const { selectedThemeId, loading } = useThemeContext();

    const isSelected = selectedThemeId === theme.id;
    const isDisabled = loading || (isSelected && storiesUsingTheme.length > 0);
    // Use the count from the theme object if available (set by backend), otherwise fallback to local length if expanded
    const storyCount = theme.story_count !== undefined ? theme.story_count : storiesUsingTheme.length;

    const formattedDate = useMemo(() => {
        return formatDate(theme.created_at, i18n.getCurrentLocale());
    }, [theme.created_at, t]); // Added t dependency for re-render on locale change if needed, though i18n.getCurrentLocale might be static

    return (
      <Card
        className={`group relative overflow-hidden transition-all duration-200 hover:shadow-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 ${
          isSelected ? 'ring-2 ring-story-purple' : ''
        }`}
      >
        <div 
            className="h-1.5 w-full" 
            style={{ backgroundColor: theme.color }} 
        />
        
        <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
            <div className="flex-1 min-w-0 pr-2">
                 <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate" title={theme.name}>
                    {theme.name}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5" title={theme.description || ""}>
                     {theme.description || t('themes.noDescription')}
                </p>
            </div>
             <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    onClick={(e) => { e.stopPropagation(); onEdit(theme); }}
                    disabled={loading}
                    title={t('common.edit')}
                >
                    <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={(e) => { e.stopPropagation(); onDelete(theme.id); }}
                    disabled={isDisabled}
                    title={t('common.delete')}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
        </CardHeader>

        <CardContent className="p-4 pt-2">
            <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-gray-400 font-mono">
                    {formattedDate}
                </span>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggleExpand(theme.id)}
                    className="h-6 text-xs px-2 gap-1 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                    <BookOpen className="h-3 w-3" />
                    <span>{storyCount} {storyCount === 1 ? t('story.details').split(' ')[0] : t('stories.title')}</span>
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
            </div>

             {/* Expanded Content - Stories List */}
             {isExpanded && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-1 animate-in slide-in-from-top-2 duration-200 max-h-[300px] overflow-y-auto pr-1">
                    {storyCount > 0 ? (
                        storiesUsingTheme.map(story => {
                            // Map age groups to colors
                            // Age groups: "2-3", "4-6", "7-9", "10-12", "13-15", "16-18"
                            const ageColor = getAgeGroupColor(story.age_group as string);


                            const dayMap: Record<number, string> = { 1: 'Lun', 2: 'Mar', 3: 'Mer', 4: 'Jeu', 5: 'Ven', 6: 'Sam', 7: 'Dim' };
                            const dayName = story.day_order ? dayMap[story.day_order] : '';

                            return (
                             <div 
                                key={story.id} 
                                onClick={() => onNavigateToStory(story.id)}
                                className="group/story flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                            >
                                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap", ageColor)}>
                                    {story.age_group} ans
                                </span>
                                
                                <span className="text-[10px] text-gray-400 font-mono whitespace-nowrap">
                                    S{story.week_number} {dayName && `- ${dayName}`}
                                </span>

                                <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1 font-medium group-hover/story:text-story-purple transition-colors">
                                    {story.title}
                                </span>
                            </div>
                        )})
                    ) : (
                         <p className="text-xs text-center text-gray-400 py-1 italic">
                            {t('themes.noStoriesUsingTheme')}
                        </p>
                    )}
                </div>
            )}
        </CardContent>
      </Card>
    );
  }
);

ThemeCard.displayName = 'ThemeCard';

export default ThemeCard;
