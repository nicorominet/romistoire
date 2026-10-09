import { useEffect, useMemo, useState } from "react";
import { Check, GitMerge, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { i18n } from "@/lib/i18n";
import { getApiError } from "@/lib/apiError";
import { useDebouncedValue, useThemeDuplicates, useThemeMutations, useThemes } from "@/hooks/useThemes";
import { Theme, ThemeSort } from "@/types/Theme";
import { ThemeGridSkeleton } from "./ThemeSkeleton";
import { ThemeListItem } from "./ThemeListItem";
import { ThemeFormDialog } from "./ThemeFormDialog";
import { ThemeDeleteDialog } from "./ThemeDeleteDialog";
import { ThemeMergeDialog } from "./ThemeMergeDialog";
import { ThemeBadge } from "./ThemeBadge";

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

/** Names listed in the bulk deletion confirmation. */
const CONFIRM_NAMES_MAX = 5;

/**
 * Story themes library: search, sort, quick filters ("to review", "unused"), duplicate banner,
 * list with edit / merge / delete actions, bulk review approval, and deletion of unused themes.
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkAction, setConfirmBulkAction] = useState<"delete" | "approve" | null>(null);
  const { deleteThemes, approveThemes } = useThemeMutations();

  // A new filter shows other themes: start a new selection
  useEffect(() => { setSelectedIds(new Set()); }, [filters.search, filters.filter]);

  const unusedShown = useMemo(() => themes.filter(theme => (theme.storyCount ?? 0) === 0), [themes]);
  const reviewShown = useMemo(() => themes.filter(theme => theme.needsReview), [themes]);
  const selectedThemes = useMemo(() => allThemes.filter(theme => selectedIds.has(theme.id)), [allThemes, selectedIds]);

  const toggleSelected = (theme: Theme, selected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (selected) next.add(theme.id);
      else next.delete(theme.id);
      return next;
    });
  };
  const selectAllUnused = () => setSelectedIds(new Set(unusedShown.map(theme => theme.id)));
  const selectAllReview = () => setSelectedIds(new Set(reviewShown.map(theme => theme.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    try {
      const result = await deleteThemes.mutateAsync([...selectedIds]);
      if (result.deleted.length > 0) toast.success(t("themes.bulk.deleted", { count: String(result.deleted.length) }));
      if (result.skipped.length > 0) toast.info(t("themes.bulk.skipped", { count: String(result.skipped.length) }));
      clearSelection();
    } catch (err) {
      toast.error(getApiError(err).message);
    } finally {
      setConfirmBulkAction(null);
    }
  };

  const handleBulkApprove = async () => {
    try {
      const result = await approveThemes.mutateAsync([...selectedIds]);
      if (result.validated > 0) toast.success(t("themes.bulk.validated", { count: String(result.validated) }));
      else toast.info(t("themes.bulk.noneToValidate"));
      clearSelection();
    } catch (err) {
      toast.error(getApiError(err).message);
    } finally {
      setConfirmBulkAction(null);
    }
  };

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

      {(selectedIds.size > 0 || (filters.filter === "unused" && unusedShown.length > 0) || (filters.filter === "review" && reviewShown.length > 0)) && (
        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-background/95 px-4 py-2 shadow-sm backdrop-blur"
          role="region" aria-label={t("themes.bulk.region")}>
          <span className="text-sm font-medium tabular-nums">{t("themes.bulk.selected", { count: String(selectedIds.size) })}</span>
          {filters.filter === "unused" && selectedIds.size < unusedShown.length && (
            <Button type="button" size="sm" variant="ghost" onClick={selectAllUnused}>
              {t("themes.bulk.selectAllUnused", { count: String(unusedShown.length) })}
            </Button>
          )}
          {filters.filter === "review" && selectedIds.size < reviewShown.length && (
            <Button type="button" size="sm" variant="ghost" onClick={selectAllReview}>
              {t("themes.bulk.selectAllReview", { count: String(reviewShown.length) })}
            </Button>
          )}
          {selectedIds.size > 0 && (
            <>
              <Button type="button" size="sm" variant="ghost" onClick={clearSelection}>{t("themes.bulk.clearSelection")}</Button>
              {filters.filter !== "review" && (
                <Button type="button" size="sm" variant="destructive" className="ml-auto" onClick={() => setConfirmBulkAction("delete")}>
                  <Trash2 className="mr-2 h-4 w-4" />{t("themes.bulk.delete", { count: String(selectedIds.size) })}
                </Button>
              )}
              {filters.filter === "review" && (
                <Button type="button" size="sm" className="ml-auto" onClick={() => setConfirmBulkAction("approve")}>
                  <Check className="mr-2 h-4 w-4" />{t("themes.bulk.approve", { count: String(selectedIds.size) })}
                </Button>
              )}
            </>
          )}
        </div>
      )}

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
        <ul className={cn("grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3", isFetching && "opacity-70")} aria-busy={isFetching}>
          {themes.map(theme => (
            <ThemeListItem key={theme.id} theme={theme}
              selected={selectedIds.has(theme.id)}
              selectionMode={filters.filter === "review" ? "review" : "unused"}
              onSelectedChange={toggleSelected}
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

      <AlertDialog open={confirmBulkAction !== null} onOpenChange={(open) => { if (!open) setConfirmBulkAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmBulkAction === "approve"
              ? t("themes.bulk.approveConfirmTitle", { count: String(selectedThemes.length) })
              : t("themes.bulk.confirmTitle", { count: String(selectedThemes.length) })}</AlertDialogTitle>
            <AlertDialogDescription>{confirmBulkAction === "approve"
              ? t("themes.bulk.approveConfirmDesc")
              : t("themes.bulk.confirmDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="flex flex-wrap gap-1.5">
            {selectedThemes.slice(0, CONFIRM_NAMES_MAX).map(theme => <li key={theme.id}><ThemeBadge theme={theme} /></li>)}
            {selectedThemes.length > CONFIRM_NAMES_MAX && (
              <li className="text-sm text-muted-foreground">{t("themes.bulk.andMore", { count: String(selectedThemes.length - CONFIRM_NAMES_MAX) })}</li>
            )}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => {
              event.preventDefault();
              if (confirmBulkAction === "approve") void handleBulkApprove();
              else void handleBulkDelete();
            }} disabled={deleteThemes.isPending || approveThemes.isPending}
              className={confirmBulkAction === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}>
              {(deleteThemes.isPending || approveThemes.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmBulkAction === "approve" ? t("themes.bulk.approveAction") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
