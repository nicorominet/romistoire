import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Calendar, BookOpen, Clock, Tag } from 'lucide-react';
import { i18n } from '@/lib/i18n';
import PageLayout from '@/components/Layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import StoriesHeader from '@/components/Story/StoriesList/StoriesHeader'; // Can reuse? No, different header.
import StoryNavigation from '@/components/Story/StoryDetail/StoryNavigation';
import StoryContent from '@/components/Story/StoryDetail/StoryContent';
import StoryMeta from '@/components/Story/StoryDetail/StoryMeta';
import { StoryDetailSkeleton } from '@/components/Story/StorySkeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Hooks
import { useStory, useStoryNeighbors, useStoryMutations } from '@/hooks/useStory';
import { useWeeklyThemes } from '@/hooks/useThemes';
import { useMemo } from 'react';

const { t } = i18n;

const StoryDetailPage = (): JSX.Element => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: story, isLoading, error } = useStory(id || '');
  const { data: neighbors } = useStoryNeighbors(id || '');
  const { deleteStory } = useStoryMutations();
  const { data: weeklyThemes } = useWeeklyThemes();

  // Determine weekly theme name
  const weeklyThemeName = useMemo(() => {
     if (!story || !weeklyThemes) return '';
     const theme = weeklyThemes.find((wt: any) => wt.week_number === story.week_number);
     return theme ? theme.theme_name : '';
  }, [story, weeklyThemes]);

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteStory.mutateAsync(id);
      toast({
        title: t('common.success'),
        description: t('story.deleteSuccess'),
      });
      navigate('/');
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('story.deleteError'),
        variant: "destructive",
      });
    }
  };

  const handleEdit = () => {
    navigate(`/edit/${id}`); 
  };

  if (isLoading) {
    return (
      <PageLayout>
        <StoryDetailSkeleton />
      </PageLayout>
    );
  }

  if (error || !story) {
    return (
      <PageLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-red-600 mb-4">{t('common.error')}</h2>
          <Button onClick={() => navigate('/')} variant="outline">
            {t('common.back')}
          </Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-fade-in px-4 md:px-6">
        {/* Navigation Header */}
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            className="gap-2 hover:bg-white/50 dark:hover:bg-gray-800/50"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </Button>
          
          <div className="flex gap-2">
            <Button
                variant="outline"
                size="sm"
                className="gap-2 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-yellow-900/20"
                onClick={handleEdit}
            >
                <Edit className="h-4 w-4" />
                {t('common.edit')}
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4" />
                  {t('common.delete')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('common.deleteConfirmTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('common.deleteConfirmDesc')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                    {t('common.delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {  /* Story Header (Compact) */
        <div className="space-y-4 text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold font-heading text-primary bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80 leading-tight">
                {story.title}
            </h1>
            
            <div className="flex flex-wrap justify-center gap-2">
                {story.themes && story.themes.map((theme) => (
                    <Badge 
                        key={theme.id}
                        variant="secondary" 
                        className="text-xs px-2 py-0.5"
                        style={{ 
                            backgroundColor: theme.color ? `${theme.color}15` : undefined,
                            color: theme.color,
                            borderColor: theme.color ? `${theme.color}30` : undefined
                        }}
                    >
                        {theme.name}
                    </Badge>
                ))}
            </div>

            <div className="scale-90 origin-center">
                <StoryMeta 
                    ageGroup={story.age_group}
                    readingTime={Math.ceil((story.content?.split(' ').length || 0) / 150)} 
                    weeklyTheme={weeklyThemeName}
                    seriesName={story.series_name}
                    createdAt={story.created_at}
                    weekNumber={story.week_number}
                    dayOrder={story.day_order}
                    version={story.version}
                    locale={story.locale}
                />
            </div>
        </div>
        }

        {/* Main Content */}
        <div className="w-full">
             <StoryContent story={story} />
        </div>

        {/* Navigation Footer */}
        <StoryNavigation 
            prevId={neighbors?.prev?.id}
            nextId={neighbors?.next?.id}
            prevTitle={neighbors?.prev?.title}
            nextTitle={neighbors?.next?.title}
        />
      </div>
    </PageLayout>
  );
};

export default StoryDetailPage;