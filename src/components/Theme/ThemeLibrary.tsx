import { useEffect, useMemo, useState } from "react";
import { GitMerge, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { i18n } from "@/lib/i18n";
import { useDebouncedValue, useThemeDuplicates, useThemes } from "@/hooks/useThemes";
import { Theme, ThemeSort } from "@/types/Theme";
import { ThemeGridSkeleton } from "./ThemeSkeleton";
import { ThemeListItem } from "./ThemeListItem";
import { ThemeFormDialog } from "./ThemeFormDialog";
import { ThemeDeleteDialog } from "./ThemeDeleteDialog";
import { ThemeMergeDialog } from "./ThemeMergeDialog";

export type ThemeQuickFilter = "all" | "review" | "unused";

export interface ThemeLibraryFilters {
  search: string;
  sort: ThemeSort;
  filter: ThemeQuickFilter;
}

interface ThemeLibraryProps {
  filters: ThemeLibraryFilters;
  onFiltersChange: (patch: Partial<ThemeLibraryFilters>) => void;
}

/**
 * Themes tab: search, sort, quick filters ("to review", "unused"), duplicate banner,
 * list with edit / merge / delete actions.
 */
export const ThemeLibrary = ({ filters, onFiltersChange }: ThemeLibraryProps) => {
  const { t } = i18n;
  const [searchInput, setSearchInput] = useState(filters.search);
  const search = useDebouncedValue(searchInput, 300);

  // Keep the URL in sync with the debounced search
  useEffect(() => {
    if (search !== filters.search) onFiltersChange({ search });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data: allThemes = [] } = useThemes();
  const { data: themes = [], isLoading, isFetching } = useThemes({
    search: filters.search,
    sort: filters.sort,
    needsReview: filters.filter === "review",
    unused: filters.filter === "unused",
  });
  const { data: duplicateGroups = [] } = useThemeDuplicates();

  const [editing, setEditing] = useState<Theme | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<{ theme: Theme; mode: "delete" | "merge"; replacementId: string | null } | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);

  const counts = useMemo(() => ({
    all: allThemes.length,
    review: allThemes.filter(theme => theme.needsReview).length,
    unused: allThemes.filter(theme => (theme.storyCount ?? 0) === 0).length,
  }), [allThemes]);

  const hasFilters = Boolean(filters.search) || filters.filter !== "all";
  const clearFilters = () => {
    setSearchInput("");
    onFiltersChange({ search: "", filter: "all" });
  };

  const openForm = (theme: Theme | null) => {
    setEditing(theme);
    setFormOpen(true);
  };

  const quickFilters: { value: ThemeQuickFilter; label: string; count: number }[] = [
    { value: "all", label: t("themes.filters.all"), count: counts.all },
    { value: "review", label: t("themes.filters.review"), count: counts.review },
    { value: "unused", label: t("themes.filters.unused"), count: counts.unused },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder={t("themes.searchThemes")}
            className="pl-9 pr-9" aria-label={t("themes.searchThemes")} />
          {searchInput && (
            <button type="button" onClick={() => setSearchInput("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={t("themes.clearSearch")}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={filters.sort} onValueChange={(sort) => onFiltersChange({ sort: sort as ThemeSort })}>
          <SelectTrigger className="sm:w-48" aria-label={t("themes.sortBy")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name">{t("themes.sortOptions.name")}</SelectItem>
            <SelectItem value="usage">{t("themes.sortOptions.usage")}</SelectItem>
            <SelectItem value="recent">{t("themes.sortOptions.recent")}</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" onClick={() => openForm(null)}><Plus className="mr-2 h-4 w-4" />{t("themes.newTheme")}</Button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t("themes.quickFilters")}>
        {quickFilters.map(quick => (
          <button key={quick.value} type="button" onClick={() => onFiltersChange({ filter: quick.value })}
            aria-pressed={filters.filter === quick.value}
            className={cn("rounded-full border px-3 py-1 text-sm transition-colors",
              filters.filter === quick.value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
            {quick.label} <span className="tabular-nums opacity-75">{quick.count}</span>
          </button>
        ))}
      </div>

      {duplicateGroups.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <span>{t("themes.duplicatesBanner", { count: String(duplicateGroups.length) })}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => setMergeOpen(true)}>
            <GitMerge className="mr-2 h-4 w-4" />{t("themes.reviewDuplicates")}
          </Button>
        </div>
      )}

      {isLoading ? <ThemeGridSkeleton /> : themes.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center">
          <p className="text-muted-foreground">{hasFilters ? t("themes.noResults") : t("themes.createFirstThemeDescription")}</p>
          <Button type="button" variant="link" onClick={hasFilters ? clearFilters : () => openForm(null)}>
            {hasFilters ? t("themes.clearFilters") : t("themes.newTheme")}
          </Button>
        </div>
      ) : (
        <ul className={cn("grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3", isFetching && "opacity-70")} aria-busy={isFetching}>
          {themes.map(theme => (
            <ThemeListItem key={theme.id} theme={theme}
              onEdit={openForm}
              onMerge={(source) => setDeleting({ theme: source, mode: "merge", replacementId: null })}
              onDelete={(target) => setDeleting({ theme: target, mode: "delete", replacementId: null })}
            />
          ))}
        </ul>
      )}

      <ThemeFormDialog open={formOpen} onOpenChange={setFormOpen} theme={editing}
        onMergeRequest={(source, target) => setDeleting({ theme: source, mode: "merge", replacementId: target.id })} />
      <ThemeDeleteDialog theme={deleting?.theme ?? null} themes={allThemes} mode={deleting?.mode}
        defaultReplacementId={deleting?.replacementId} onClose={() => setDeleting(null)} />
      <ThemeMergeDialog open={mergeOpen} onOpenChange={setMergeOpen} />
    </div>
  );
};

export default ThemeLibrary;
