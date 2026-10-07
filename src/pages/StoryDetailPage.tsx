import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Calendar, BookOpen, Clock, Tag, Headphones, Volume2, Loader2 } from 'lucide-react';
import { i18n } from '@/lib/i18n';
import PageLayout from '@/components/Layout/PageLayout';
import { Button } from '@/components/ui/button';
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import StoriesHeader from '@/components/Story/StoriesList/StoriesHeader'; 
import StoryNavigation from '@/components/Story/StoryDetail/StoryNavigation';
import StoryContent from '@/components/Story/StoryDetail/StoryContent';
import { APP_ROUTES } from '@/constants';
import { WeeklyTheme } from '@/types/Theme';
import StoryMeta from '@/components/Story/StoryDetail/StoryMeta';
import IllustrationPromptCard from '@/components/Story/IllustrationPromptCard';
import { ThemeBadgeList } from '@/components/Theme/ThemeBadgeList';
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

  // Back to where the user came from (library with its filters), or to the library on a direct visit
  const goBack = () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate(APP_ROUTES.STORIES);
  };

  const { data: story, isLoading, error } = useStory(id || '');
  const { data: neighbors } = useStoryNeighbors(id || '');
  const { deleteStory, generateAudio } = useStoryMutations();
  const { data: weeklyThemes } = useWeeklyThemes();

  // Theme of the story's week (a linked theme, or the week's label for weeks not linked yet)
  const weekTheme = useMemo(() => {
     if (!story || !weeklyThemes) return null;
     const week = (weeklyThemes as WeeklyTheme[]).find((wt) => wt.week_number === story.week_number);
     if (!week) return null;
     return { id: week.theme_id ?? '', name: week.theme_name, color: week.color ?? undefined, icon: week.icon };
  }, [story, weeklyThemes]);

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteStory.mutateAsync(id);
      toast.success(t('story.deleteSuccess'));
      navigate(APP_ROUTES.STORIES, { replace: true });
    } catch (error) {
      toast.error(t('story.deleteError'));
    }
  };

  const handleGenerateAudio = async () => {
      if (!id) return;
      try {
          toast.info(t('story.audio.generating'), { description: t('story.audio.generatingDesc') });
          await generateAudio.mutateAsync(id);
          toast.success(t('story.audio.generated'), { description: t('story.audio.generatedDesc') });
      } catch (error) {
          toast.error(t('story.audio.error'), { description: (error as any)?.response?.data?.error || t('story.audio.errorDesc') });
      }
  };

  const handleEdit = () => {
    navigate(APP_ROUTES.EDIT_STORY(id)); 
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
          <Button onClick={() => navigate(APP_ROUTES.STORIES)} variant="outline">
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
            onClick={goBack}
          >
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </Button>
          
          <div className="flex gap-2">
            <Button
                variant="outline"
                size="sm"
                className="gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                onClick={handleGenerateAudio}
                disabled={generateAudio.isPending}
            >
                {generateAudio.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Headphones className="h-4 w-4" />}
                {story.audio_path ? t('story.audio.regenerate') : t('story.audio.generate')}
            </Button>

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
                    {t('story.deleteConfirmDesc', { title: story.title })}
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
            
            {/* Each badge opens the library filtered on its theme */}
            <ThemeBadgeList themes={story.themes} linkToStories size="md" className="justify-center" />

            {story.audio_path && (
                <div className="flex justify-center my-4 animate-in fade-in slide-in-from-top-2">
                    <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-full p-2 pr-4 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
                         <div className="bg-story-purple text-white p-2 rounded-full">
                             <Volume2 className="h-4 w-4" />
                         </div>
                         {/* No hardcoded type: files can be wav, mp3... the browser sniffs it. key reloads a regenerated file */}
                         <audio key={story.audio_path} controls className="h-8 w-48 md:w-64 bg-transparent">
                             <source src={story.audio_path} />
                             {t('story.audio.unsupported')}
                         </audio>
                    </div>
                </div>
            )}

            <div className="scale-90 origin-center">
                <StoryMeta 
                    ageGroup={story.age_group}

                    weeklyTheme={weekTheme}
                    seriesName={story.series_name}
                    createdAt={story.created_at}
                    weekNumber={story.week_number}
                    dayOrder={story.day_order}
                    version={story.version}
                    locale={story.locale}
                    source={story.source}
                    is_manually_edited={story.is_manually_edited}
                />
            </div>
        </div>
        }

        {/* Main Content */}
        <div className="w-full bg-white/70 dark:bg-slate-900/60 backdrop-blur-md rounded-xl border border-white/50 dark:border-white/10 shadow-lg p-6 md:p-10">
             <StoryContent story={story} />
        </div>

        {/* AI illustration prompt, useful until an illustration has been added */}
        {!story.illustrations?.length && <IllustrationPromptCard prompt={story.illustration_prompt} />}

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