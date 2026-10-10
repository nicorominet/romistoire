import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { AArrowDown, AArrowUp, ArrowLeft, BookOpenText, CheckCircle2, Edit, Eye, Loader2, MoreHorizontal, Trash2, X } from 'lucide-react';
import { i18n } from '@/lib/i18n';
import PageLayout from '@/components/Layout/PageLayout';
import { Button } from '@/components/ui/button';
import { toast } from "sonner";
import StoryNavigation from '@/components/Story/StoryDetail/StoryNavigation';
import StoryContent from '@/components/Story/StoryDetail/StoryContent';
import StorySidePanel from '@/components/Story/StoryDetail/StorySidePanel';
import { storyDayLabel } from '@/components/Story/StoryCard';
import { APP_ROUTES } from '@/constants';
import { WeeklyTheme } from '@/types/Theme';
import { AudioSettings } from '@/types/system.types';
import { ThemeBadgeList } from '@/components/Theme/ThemeBadgeList';
import { StoryDetailSkeleton } from '@/components/Story/StorySkeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Hooks
import { useStory, useStoryNeighbors, useStoryMutations } from '@/hooks/useStory';
import { useWeeklyThemes } from '@/hooks/useThemes';
import { useReadingPrefs } from '@/hooks/useReadingPrefs';

const { t } = i18n;

/** Arrow keys change story, except while typing or inside a menu or a dialog. */
const isTypingOrInOverlay = (event: KeyboardEvent) => {
  // The target can be the window or the document (no closest()), an element otherwise
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')) return true;
  return Boolean(target?.closest('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'))
    || Boolean(document.querySelector('[role="dialog"], [role="alertdialog"]'));
};

const StoryDetailPage = (): JSX.Element => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Reading mode (?read=1): title, picture, audio and text only, in full screen when the browser allows it
  const reading = searchParams.get('read') === '1';
  const enteredFullscreen = useRef(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { textSizeClass, canShrink, canGrow, shrink, grow } = useReadingPrefs();

  // Back to where the user came from (library with its filters), or to the library on a direct visit
  const goBack = () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate(APP_ROUTES.STORIES);
  };

  const { data: story, isLoading, error } = useStory(id || '');
  const { data: neighbors } = useStoryNeighbors(id || '');
  const { deleteStory, generateAudio, validateStory } = useStoryMutations();
  const { data: weeklyThemes } = useWeeklyThemes();

  // Topic of the story's week (free text, not a story theme)
  const weekTopic = useMemo(() => {
     if (!story || !weeklyThemes) return null;
     return (weeklyThemes as WeeklyTheme[]).find((wt) => wt.week_number === story.week_number)?.theme_name || null;
  }, [story, weeklyThemes]);

  const enterReading = () => {
    setSearchParams({ read: '1' }, { replace: true });
    document.documentElement.requestFullscreen?.()
      .then(() => { enteredFullscreen.current = true; })
      .catch(() => { /* not allowed here: the reading mode works without it */ });
  };
  const exitReading = useCallback(() => {
    setSearchParams({}, { replace: true });
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    enteredFullscreen.current = false;
  }, [setSearchParams]);

  // Leaving full screen (Esc is caught by the browser there) leaves the reading mode too
  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && enteredFullscreen.current) exitReading();
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [exitReading]);

  // ← → previous / next story (the reading mode is kept), Esc leaves the reading mode
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || isTypingOrInOverlay(event)) return;
      const neighbor = event.key === 'ArrowLeft' ? neighbors?.prev : event.key === 'ArrowRight' ? neighbors?.next : null;
      if (neighbor?.id) {
        event.preventDefault();
        navigate(`/stories/${neighbor.id}${reading ? '?read=1' : ''}`);
      } else if (event.key === 'Escape' && reading) {
        exitReading();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [neighbors, reading, navigate, exitReading]);

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

  const handleGenerateAudio = async (voice: Partial<AudioSettings>) => {
      if (!id) return;
      try {
          toast.info(t('story.audio.generating'), { description: t('story.audio.generatingDesc') });
          await generateAudio.mutateAsync({ id, voice });
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

  const toolButton = "flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-white/70 hover:text-story-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-story-purple-400 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-slate-800";
  const readingTools = (
    <div className="flex items-center gap-1">
      <button type="button" className={toolButton} onClick={shrink} disabled={!canShrink} aria-label={t('story.detail.textSmaller')} title={t('story.detail.textSmaller')}>
        <AArrowDown className="h-5 w-5" />
      </button>
      <button type="button" className={toolButton} onClick={grow} disabled={!canGrow} aria-label={t('story.detail.textLarger')} title={t('story.detail.textLarger')}>
        <AArrowUp className="h-5 w-5" />
      </button>
      {reading ? (
        <Button variant="outline" size="sm" className="ml-1 gap-2" onClick={exitReading}>
          <X className="h-4 w-4" />
          {t('story.detail.exitReading')}
        </Button>
      ) : (
        <Button variant="outline" size="sm" className="ml-1 gap-2" onClick={enterReading}>
          <BookOpenText className="h-4 w-4" />
          {t('story.detail.readingMode')}
        </Button>
      )}
    </div>
  );

  const reviewBanner = story.review_status === 'to_review' && (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-200">
      <span className="flex items-center gap-2">
        <Eye aria-hidden="true" className="h-4 w-4 shrink-0" />
        {t('story.detail.toReview')}
      </span>
      <Button
        size="sm"
        className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
        onClick={() => validateStory.mutate(story.id, {
          onSuccess: () => toast.success(t('review.validatedToast')),
          onError: (error) => toast.error((error as Error).message),
        })}
        disabled={validateStory.isPending}
      >
        {validateStory.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        {t('review.validate')}
      </Button>
    </div>
  );

  // Title, theme badges: shared by both modes
  const titleBlock = (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
        {t(`ages.${story.age_group}`)} · {t('story.week')} {story.week_number} · {storyDayLabel(story.day_order)}
        {story.series_name && <> · {story.series_name}</>}
      </p>
      <h1 className="font-heading text-3xl font-bold leading-tight text-story-purple-800 dark:text-story-purple-200 md:text-4xl">
        {story.title}
      </h1>
      {/* Each badge opens the library filtered on its theme */}
      <ThemeBadgeList themes={story.themes} linkToStories size="md" />
    </div>
  );

  const textColumn = (
    <article className="mx-auto w-full max-w-[70ch] space-y-6">
      <StoryContent story={story} textSizeClass={textSizeClass} />
    </article>
  );

  if (reading) {
    return (
      <PageLayout bare>
        <div className="mx-auto max-w-[75ch] space-y-8 py-4">
          <div className="flex justify-end">{readingTools}</div>
          {titleBlock}
          {story.audio_path && (
            <audio key={story.audio_path} controls preload="metadata" className="w-full">
              <source src={story.audio_path} />
              {t('story.audio.unsupported')}
            </audio>
          )}
          {textColumn}
          <StoryNavigation prev={neighbors?.prev} next={neighbors?.next} />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Navigation and actions */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" className="gap-2 hover:bg-white/50 dark:hover:bg-gray-800/50" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" />
            {t('story.detail.back')}
          </Button>
          <div className="flex items-center gap-2">
            <Button size="sm" className="gap-2 bg-story-purple-600 text-white hover:bg-story-purple-700" onClick={handleEdit}>
              <Edit className="h-4 w-4" />
              {t('common.edit')}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 w-9 p-0" aria-label={t('story.detail.moreActions')}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="gap-2 text-red-600 focus:text-red-700 dark:text-red-400" onSelect={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4" />
                  {t('common.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
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

        {/* Header: where the story sits, its title and themes, the reading tools */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          {titleBlock}
          {readingTools}
        </div>

        {/* Reading first; audio, program and details beside (below on small screens) */}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-6 rounded-xl border border-white/50 bg-white/70 p-5 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-slate-900/60 md:p-8">
            {reviewBanner}
            {/* Small screens: the side panel comes after the text, the audio is wanted before it */}
            {story.audio_path && (
              <audio key={story.audio_path} controls preload="metadata" className="w-full lg:hidden" aria-label={t('story.detail.audio')}>
                <source src={story.audio_path} />
                {t('story.audio.unsupported')}
              </audio>
            )}
            {textColumn}
          </div>
          <aside className="lg:sticky lg:top-4">
            <StorySidePanel story={story} weekTopic={weekTopic} audioPending={generateAudio.isPending} onGenerateAudio={handleGenerateAudio} />
          </aside>
        </div>

        <StoryNavigation prev={neighbors?.prev} next={neighbors?.next} />
      </div>
    </PageLayout>
  );
};

export default StoryDetailPage;
