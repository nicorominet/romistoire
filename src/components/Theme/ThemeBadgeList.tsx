import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StoryTheme } from "@/types/Theme";
import { ThemeBadge, ThemeBadgeProps } from "./ThemeBadge";

interface ThemeBadgeListProps extends Pick<ThemeBadgeProps, "size" | "variant" | "linkToStories"> {
  themes: StoryTheme[] | undefined | null;
  /** Number of badges shown before "+N" */
  max?: number;
  className?: string;
}

/** Primary theme first, then by name. */
export const sortStoryThemes = (themes: StoryTheme[]): StoryTheme[] =>
  [...themes].sort((a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary)) || a.name.localeCompare(b.name));

/** The primary theme of a story (or its first theme). */
export const primaryStoryTheme = (themes: StoryTheme[] | undefined | null): StoryTheme | undefined =>
  themes && themes.length > 0 ? sortStoryThemes(themes)[0] : undefined;

/**
 * Themes of a story: primary first (with a star when the story has several themes), "+N" with a tooltip beyond `max`.
 */
export const ThemeBadgeList = ({ themes, max, className, ...badgeProps }: ThemeBadgeListProps) => {
  if (!themes || themes.length === 0) return null;
  const sorted = sortStoryThemes(themes);
  const visible = max ? sorted.slice(0, max) : sorted;
  const hidden = sorted.slice(visible.length);
  const markPrimary = sorted.length > 1;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {visible.map(theme => (
        <ThemeBadge key={theme.id} theme={theme} primary={markPrimary && Boolean(theme.isPrimary)} {...badgeProps} />
      ))}
      {hidden.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-default rounded-full border px-2 py-1 text-xs text-muted-foreground" tabIndex={0}>
              +{hidden.length}
            </span>
          </TooltipTrigger>
          <TooltipContent className="flex max-w-xs flex-wrap gap-1">
            {hidden.map(theme => <ThemeBadge key={theme.id} theme={theme} />)}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};

export default ThemeBadgeList;
