import { Link } from "react-router-dom";
import { BookOpen, GitMerge, MoreHorizontal, Pencil, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { i18n } from "@/lib/i18n";
import { safeThemeColor } from "@/utils/themeColors";
import { Theme } from "@/types/Theme";
import { ThemeBadge, themeStoriesUrl } from "./ThemeBadge";

interface ThemeListItemProps {
  theme: Theme;
  onEdit: (theme: Theme) => void;
  onMerge: (theme: Theme) => void;
  onDelete: (theme: Theme) => void;
}

/** One theme of the library: badge, description, story count link, "to review" flag and actions menu. */
export const ThemeListItem = ({ theme, onEdit, onMerge, onDelete }: ThemeListItemProps) => {
  const { t } = i18n;
  const count = theme.storyCount ?? 0;

  return (
    <li className="group flex items-start gap-3 rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
      style={{ borderLeftWidth: 4, borderLeftColor: safeThemeColor(theme.color) }}>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => onEdit(theme)} className="max-w-full rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ThemeBadge theme={theme} size="md" />
          </button>
          {theme.needsReview && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
              title={t("themes.needsReviewHint")}>
              <Sparkles className="h-3 w-3" />{t("themes.needsReview")}
            </span>
          )}
        </div>
        {theme.description
          ? <p className="line-clamp-2 text-sm text-muted-foreground">{theme.description}</p>
          : <p className="text-sm italic text-muted-foreground/70">{t("themes.noDescription")}</p>}
        {count > 0
          ? (
            <Link to={themeStoriesUrl(theme.id)} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <BookOpen className="h-3.5 w-3.5" />{t("themes.storyCount", { count: String(count) })}
            </Link>
          )
          : <span className="text-sm text-muted-foreground">{t("themes.unusedLabel")}</span>}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={t("themes.actions", { name: theme.name })}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onEdit(theme)}><Pencil className="mr-2 h-4 w-4" />{t("common.edit")}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onMerge(theme)}><GitMerge className="mr-2 h-4 w-4" />{t("themes.mergeIntoOther")}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onDelete(theme)} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />{t("common.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
};

export default ThemeListItem;
