import { StoryCardSkeleton } from "@/components/Story/StorySkeleton";
import { i18n } from "@/lib/i18n";
import { Story } from "@/types/Story";
import StoryGrid from "@/components/Story/StoryGrid";
import StoriesEmptyState from "./StoriesEmptyState";
import StoryListRow from "./StoryListRow";
import Spinner from "@/components/ui/Spinner";
import ErrorDisplay from "@/components/Common/ErrorDisplay";

export type StoriesView = "grid" | "list";

interface StoriesGridProps {
  loading: boolean;
  error: string | null;
  stories: Story[];
  view: StoriesView;
  observerRef: React.RefObject<HTMLDivElement>;
  hasMore: boolean;
  handleCreateStory: () => void;
}

/**
 * Library results: cards or compact rows, loaded page by page while scrolling.
 */
const StoriesListGrid = ({
  loading,
  error,
  stories,
  view,
  observerRef,
  hasMore,
  handleCreateStory
}: StoriesGridProps) => {
    const { t } = i18n;

    if (error) {
        return <ErrorDisplay error={error} />;
    }

    if (stories.length > 0) {
        return (
            <>
              {view === "list" ? (
                <ul className="space-y-2">
                  {stories.map((story) => <StoryListRow key={story.id} story={story} />)}
                </ul>
              ) : (
                <StoryGrid stories={stories} />
              )}
              <div ref={observerRef} className="h-10 flex justify-center items-center">
                 {loading && <Spinner />}
                 {!loading && !hasMore && <p className="text-gray-500 text-sm">{t('stories.noMoreStories')}</p>}
              </div>
            </>
        );
    }

    if (loading) {
        return view === "list" ? (
            <div className="space-y-2 animate-pulse">
                {[...Array(8)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-white/60 dark:bg-slate-800/60" />)}
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-full">
                        <StoryCardSkeleton />
                    </div>
                ))}
            </div>
        );
    }

    return <StoriesEmptyState handleCreateStory={handleCreateStory} />;
};

export default StoriesListGrid;
