import { StoryCardSkeleton } from "@/components/Story/StorySkeleton";
import { i18n } from "@/lib/i18n";
import { Story } from "@/types/Story";
import StoryGrid from "@/components/Story/StoryGrid";
import StoriesEmptyState from "./StoriesEmptyState";
import Spinner from "@/components/ui/Spinner";
import ErrorDisplay from "@/components/Common/ErrorDisplay";

interface StoriesGridProps {
  loading: boolean;
  error: string | null;
  stories: Story[];
  groupedStories: { [key: string]: Story[] };
  themeColors: { [themeId: string]: string };
  observerRef: React.RefObject<HTMLDivElement>;
  hasMore: boolean;
  handleCreateStory: () => void;
}

const StoriesListGrid = ({
  loading,
  error,
  stories,
  groupedStories,
  themeColors,
  observerRef,
  hasMore,
  handleCreateStory
}: StoriesGridProps) => {
    const { t } = i18n;

    const getFlagClass = (locale: string) => {
        switch (locale) {
          case 'fr': return 'fi fi-fr';
          case 'en': return 'fi fi-gb';
          default: return 'fi fi-globe';
        }
    };

    if (error) {
        return <ErrorDisplay error={error} />;
    }

    if (stories.length > 0) {
        return (
            <>
              {Object.keys(groupedStories).map(locale => (
                <div key={locale} className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">
                    <span className={getFlagClass(locale)}></span> {t(`languages.${locale}`)}
                  </h2>
                  <StoryGrid
                    stories={groupedStories[locale]}
                    locale={locale}
                    themeColors={themeColors}
                  />
                </div>
              ))}
              <div ref={observerRef} className="h-10 flex justify-center items-center">
                 {loading && <Spinner />}
                 {!loading && !hasMore && <p className="text-gray-500 text-sm">No more stories to load.</p>}
              </div>
            </>
        );
    }

    if (loading && stories.length === 0) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-full">
                        <StoryCardSkeleton />
                    </div>
                ))}
            </div>
        );
    }
    
    // Fallback for actual empty state (not loading)
    if (!loading && stories.length === 0) {
        return <StoriesEmptyState handleCreateStory={handleCreateStory} />;
    }

};

export default StoriesListGrid;
