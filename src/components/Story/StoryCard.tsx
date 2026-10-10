import { Link } from "react-router-dom";
import { BookOpen, Cpu, Sparkles, User } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { i18n } from "@/lib/i18n";
import { Story } from "@/types/Story";
import { getAgeGroupColor, formatDate, storyPreview } from "@/lib/utils";
import SafeImage from "@/components/ui/SafeImage";
import { ThemeBadgeList } from "@/components/Theme/ThemeBadgeList";
import StoryStatusIcons from "./StoryStatusIcons";

const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

/** Localized day of a story (day_order 1 = Monday). */
export const storyDayLabel = (dayOrder: number) => i18n.t(`days.${DAY_KEYS[dayOrder - 1] ?? DAY_KEYS[0]}`);

const SOURCE_ICONS = { gemini: Sparkles, ollama: Cpu, manual: User };

interface StoryCardProps {
  story: Story;
}

/**
 * StoryCard Component
 *
 * A story of the library: picture (or the age color), what it already has (audio, review),
 * title, where it sits in the program (age, week, day), series and themes, the beginning of the text.
 */
const StoryCard = ({ story }: StoryCardProps) => {
  const { t } = i18n;
  const imagePath = story.illustrations?.[0]?.image_path;
  const SourceIcon = SOURCE_ICONS[story.source] ?? User;

  return (
    <Link to={`/stories/${story.id}`} className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-story-purple-400">
      <Card className="group flex h-full flex-col overflow-hidden border border-white/50 bg-white/70 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-xl dark:border-white/10 dark:bg-slate-800/60 dark:hover:bg-slate-800/80">
        {/* Same height with or without illustration */}
        <div className="relative aspect-[2/1] w-full overflow-hidden">
          {imagePath ? (
            <SafeImage src={`/${imagePath}`} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
          ) : (
            <div className={`flex h-full w-full items-center justify-center opacity-70 dark:opacity-40 ${getAgeGroupColor(String(story.age_group))}`}>
              <BookOpen aria-hidden="true" className="h-8 w-8 opacity-50" />
            </div>
          )}
          <div className="absolute right-2 top-2">
            <StoryStatusIcons story={story} variant="overlay" />
          </div>
        </div>

        <CardHeader className="space-y-2 pb-2">
          <CardTitle className="line-clamp-2 text-lg leading-snug text-story-purple-800 dark:text-story-purple-200">
            {story.title}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
            <Badge className={getAgeGroupColor(String(story.age_group))}>{t(`ages.${story.age_group}`)}</Badge>
            <span>{t("story.week")} {story.week_number}</span>
            <span aria-hidden="true">·</span>
            <span>{storyDayLabel(story.day_order)}</span>
          </div>
          {(story.series_name || story.themes?.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {story.series_name && (
                <Badge variant="secondary" className="border-indigo-200 bg-indigo-100 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                  {story.series_name}
                </Badge>
              )}
              {/* The card is a link: theme badges are not links here */}
              <ThemeBadgeList themes={story.themes} variant="solid" max={2} />
            </div>
          )}
        </CardHeader>

        <CardContent className="flex-1 pb-3">
          <p className="line-clamp-2 text-sm text-gray-600 dark:text-gray-300">{storyPreview(story.content, 100)}</p>
        </CardContent>

        <CardFooter className="flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1" title={t(`story.source.${story.source || "manual"}`)}>
            <SourceIcon aria-hidden="true" className="h-3.5 w-3.5" />
            {t(`story.source.${story.source || "manual"}`)}
            {!!story.is_manually_edited && story.source !== "manual" && (
              <span className="italic opacity-70">{t("story.source.editedByHuman")}</span>
            )}
          </span>
          <span>{t("stories.modifiedOn", { date: formatDate(story.modified_at, i18n.getCurrentLocale()) })}</span>
        </CardFooter>
      </Card>
    </Link>
  );
};

export default StoryCard;
