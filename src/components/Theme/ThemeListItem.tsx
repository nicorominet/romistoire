import { useState } from "react";
import { BookOpen, ChevronDown, GitMerge, MoreHorizontal, Pencil, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { i18n } from "@/lib/i18n";
import { safeThemeColor } from "@/utils/themeColors";
import { Theme } from "@/types/Theme";
import { ThemeBadge } from "./ThemeBadge";
import { ThemeStoriesList } from "./ThemeStoriesList";

interface ThemeListItemProps {
  theme: Theme;
  onEdit: (theme: Theme) => void;
  onMerge: (theme: Theme) => void;
  onDelete: (theme: Theme) => void;
  /** Selection for bulk deletion: only unused themes can be selected */
  selected?: boolean;
  onSelectedChange?: (theme: Theme, selected: boolean) => void;
  selectionMode?: "unused" | "review";
}

/**
 * One theme of the library: badge, description, expandable list of its stories,
 * "to review" flag, actions menu and (unused themes) a selection checkbox.
 */
export const ThemeListItem = ({ theme, onEdit, onMerge, onDelete, selected = false, onSelectedChange, selectionMode = "unused" }: ThemeListItemProps) => {
  const { t } = i18n;
  const [expanded, setExpanded] = useState(false);
  const count = theme.storyCount ?? 0;
  const selectable = Boolean(onSelectedChange) && (
    selectionMode === "review" ? Boolean(theme.needsReview) : count === 0
  );
  const storiesId = `theme-stories-${theme.id}`;

  return (
    <li className={cn("group rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md", selected && "ring-2 ring-primary")}
      style={{ borderLeftWidth: 4, borderLeftColor: safeThemeColor(theme.color) }}>
      <div className="flex items-start gap-3">
        {selectable && (
          <Checkbox checked={selected} onCheckedChange={(checked) => onSelectedChange?.(theme, checked === true)}
            className="mt-1.5" aria-label={t("themes.bulk.select", { name: theme.name })} />
        )}
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
              <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-controls={storiesId}
                title={expanded ? t("themes.hideStories") : t("themes.showStories")}
                className="inline-flex items-center gap-1 rounded text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <BookOpen className="h-3.5 w-3.5" />{t("themes.storyCount", { count: String(count) })}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
              </button>
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
      </div>

      {expanded && count > 0 && (
        <div id={storiesId} className="mt-2 border-t pt-2">
          <ThemeStoriesList themeId={theme.id} storyCount={count} />
        </div>
      )}
    </li>
  );
};
