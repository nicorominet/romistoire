import { Link } from "react-router-dom";
import { Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { i18n } from "@/lib/i18n";
import { APP_ROUTES } from "@/constants";
import { themeBadgeStyle } from "@/utils/themeColors";
import { ThemeLike } from "@/types/Theme";

export interface ThemeBadgeProps {
  theme: ThemeLike;
  /** Primary theme of a story: shown with a star */
  primary?: boolean;
  size?: "sm" | "md";
  /** soft: tinted background (default); solid: theme color background (story cards) */
  variant?: "soft" | "solid";
  /** Links to the library filtered on this theme */
  linkToStories?: boolean;
  onRemove?: () => void;
  className?: string;
}

/** Library URL filtered on a theme. */
export const themeStoriesUrl = (themeId: string) => `${APP_ROUTES.STORIES}?theme=${encodeURIComponent(themeId)}`;

/**
 * The only theme badge of the app: color, icon, primary star, optional link and remove button.
 */
export const ThemeBadge = ({
  theme,
  primary = false,
  size = "sm",
  variant = "soft",
  linkToStories = false,
  onRemove,
  className,
}: ThemeBadgeProps) => {
  const { t } = i18n;
  const classes = cn(
    "inline-flex max-w-full items-center gap-1 rounded-full border font-medium leading-none whitespace-nowrap",
    size === "sm" ? "px-2 py-1 text-xs" : "px-2.5 py-1.5 text-sm",
    linkToStories && "hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className
  );

  const content = (
    <>
      {primary && <Star className="h-3 w-3 shrink-0 fill-current" aria-label={t("themes.primary")} />}
      {theme.icon && <span aria-hidden="true">{theme.icon}</span>}
      <span className="truncate">{theme.name}</span>
    </>
  );

  const style = themeBadgeStyle(theme.color, variant);
  const title = theme.description || theme.name;

  if (linkToStories) {
    return (
      <Link to={themeStoriesUrl(theme.id)} className={classes} style={style} title={title} onClick={(e) => e.stopPropagation()}>
        {content}
      </Link>
    );
  }

  return (
    <span className={classes} style={style} title={title}>
      {content}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="-mr-0.5 ml-0.5 rounded-full p-0.5 hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t("themes.removeFromStory", { name: theme.name })}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
};
