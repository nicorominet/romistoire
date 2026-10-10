import { Link } from "react-router-dom";
import { BookOpen, ChevronRight } from "lucide-react";
import { i18n } from "@/lib/i18n";
import { Story } from "@/types/Story";
import { formatDate, getAgeGroupColor } from "@/lib/utils";
import SafeImage from "@/components/ui/SafeImage";
import StoryStatusIcons from "@/components/Story/StoryStatusIcons";
import { storyDayLabel } from "@/components/Story/StoryCard";

/**
 * StoryListRow Component
 *
 * One line of the compact library view: to scan many stories at once.
 */
const StoryListRow = ({ story }: { story: Story }) => {
  const { t } = i18n;
  const imagePath = story.illustrations?.[0]?.image_path;
  const firstTheme = story.themes?.[0];

  return (
    <li>
      <Link
        to={`/stories/${story.id}`}
        className="group flex items-center gap-3 rounded-xl border border-white/50 bg-white/70 p-2 pr-3 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-story-purple-400 dark:border-white/10 dark:bg-slate-800/60 dark:hover:bg-slate-800"
      >
        {imagePath ? (
          <SafeImage src={`/${imagePath}`} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${getAgeGroupColor(String(story.age_group))}`}>
            <BookOpen aria-hidden="true" className="h-5 w-5 opacity-50" />
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-story-purple-800 dark:text-story-purple-200">{story.title}</span>
          <span className="block truncate text-xs text-gray-600 dark:text-gray-300">
            {t(`ages.${story.age_group}`)} · {t("story.week")} {story.week_number} · {storyDayLabel(story.day_order)}
            {story.series_name && <> · {story.series_name}</>}
          </span>
        </span>

        {firstTheme && (
          <span className="hidden max-w-[10rem] truncate rounded-full px-2 py-0.5 text-xs font-medium text-gray-800 dark:text-gray-100 md:inline-block" style={{ backgroundColor: firstTheme.color ? `${firstTheme.color}33` : undefined }}>
            {firstTheme.name}
          </span>
        )}
        <StoryStatusIcons story={story} withImage />
        <span className="hidden w-24 shrink-0 text-right text-xs text-gray-500 dark:text-gray-400 lg:block">
          {formatDate(story.modified_at, i18n.getCurrentLocale())}
        </span>
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
};

export default StoryListRow;
