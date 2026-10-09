import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, getAgeGroupColor } from "@/lib/utils";
import { i18n } from "@/lib/i18n";
import { APP_ROUTES } from "@/constants";
import { useThemeStories } from "@/hooks/useThemes";
import { DAY_NAMES_EN, getDayLabel } from "@/utils/dayUtils";
import { themeStoriesUrl } from "./ThemeBadge";

/** Stories shown inline; beyond, a link opens the filtered library. */
export const THEME_STORIES_PREVIEW = 10;

interface ThemeStoriesListProps {
  themeId: string;
  storyCount: number;
}

/** Stories of a theme (age, week · day, title), loaded when the theme card is expanded. */
export const ThemeStoriesList = ({ themeId, storyCount }: ThemeStoriesListProps) => {
  const { t } = i18n;
  const { data: stories = [], isLoading, isError } = useThemeStories(themeId, true);

  if (isLoading) {
    return (
      <div className="space-y-1.5" aria-busy="true">
        {Array.from({ length: Math.min(storyCount, 3) || 1 }, (_, index) => <Skeleton key={index} className="h-6 w-full" />)}
      </div>
    );
  }
  if (isError) return <p className="text-sm text-destructive">{t("themes.storiesLoadError")}</p>;
  if (stories.length === 0) return <p className="text-sm text-muted-foreground">{t("themes.unusedLabel")}</p>;

  return (
    <div className="space-y-1">
      <ul className="space-y-0.5">
        {stories.slice(0, THEME_STORIES_PREVIEW).map(story => {
          const day = DAY_NAMES_EN[(story.day_order ?? 1) - 1];
          return (
            <li key={story.id}>
              <Link to={APP_ROUTES.STORY_DETAIL(story.id)}
                className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium", getAgeGroupColor(story.age_group))}>
                  {t("themes.ageShort", { age: story.age_group })}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  S{story.week_number}{day ? ` · ${getDayLabel(day)}` : ""}
                </span>
                <span className="truncate font-medium">{story.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {stories.length > THEME_STORIES_PREVIEW && (
        <Link to={themeStoriesUrl(themeId)} className="inline-block px-1.5 text-sm text-primary hover:underline">
          {t("themes.seeAllStories", { count: String(stories.length) })}
        </Link>
      )}
    </div>
  );
};
