import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { i18n } from '@/lib/i18n';
import { storyDayLabel } from '@/components/Story/StoryCard';

/** Previous or next story of the same age group (and series), in the program order. */
export interface StoryNeighbor {
  id: string;
  title: string;
  week_number?: number;
  day_order?: number;
}

interface StoryNavigationProps {
  prev?: StoryNeighbor | null;
  next?: StoryNeighbor | null;
}

const NeighborLink = ({ neighbor, direction }: { neighbor: StoryNeighbor; direction: 'prev' | 'next' }) => {
  const { t } = i18n;
  const isNext = direction === 'next';
  const where = neighbor.day_order
    ? `${storyDayLabel(neighbor.day_order)} · ${t('story.detail.weekShort', { week: String(neighbor.week_number) })}`
    : '';

  return (
    <Link
      to={`/stories/${neighbor.id}`}
      className={`group flex max-w-full flex-col gap-1 rounded-xl px-4 py-3 transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-story-purple-400 dark:hover:bg-slate-800/60 ${isNext ? 'items-end text-right' : 'items-start text-left'}`}
    >
      <span className="flex items-center gap-1 text-sm text-muted-foreground">
        {!isNext && <ChevronLeft aria-hidden="true" className="h-4 w-4" />}
        {isNext ? t('story.next') : t('story.previous')}
        {where && <span>· {where}</span>}
        <kbd className="ml-1 hidden rounded border border-border px-1 text-[10px] font-sans lg:inline">{isNext ? '→' : '←'}</kbd>
        {isNext && <ChevronRight aria-hidden="true" className="h-4 w-4" />}
      </span>
      <span className="line-clamp-1 font-semibold text-gray-900 dark:text-gray-100">{neighbor.title}</span>
    </Link>
  );
};

/**
 * StoryNavigation Component
 *
 * Links to the previous and next stories, with the day and week where they sit
 * (the arrow keys do the same, see StoryDetailPage).
 */
const StoryNavigation = ({ prev, next }: StoryNavigationProps) => (
  <nav aria-label={i18n.t('story.detail.navigation')} className="grid grid-cols-2 gap-2 border-t border-border pt-6">
    <div className="min-w-0">{prev && <NeighborLink neighbor={prev} direction="prev" />}</div>
    <div className="flex min-w-0 justify-end">{next && <NeighborLink neighbor={next} direction="next" />}</div>
  </nav>
);

export default StoryNavigation;
