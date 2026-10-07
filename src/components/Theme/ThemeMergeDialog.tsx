import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { i18n } from "@/lib/i18n";
import { getApiError } from "@/lib/apiError";
import { useThemeDuplicates, useThemeMutations } from "@/hooks/useThemes";
import { ThemeBadge } from "./ThemeBadge";

interface ThemeMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Reviews the groups of similar themes ("Océan" / "les océans"): for each group, pick the theme to keep
 * (most used by default) and merge the others into it. Stories, versions and weeks follow.
 */
export const ThemeMergeDialog = ({ open, onOpenChange }: ThemeMergeDialogProps) => {
  const { t } = i18n;
  const { data: groups = [], isLoading } = useThemeDuplicates(open);
  const { mergeThemes } = useThemeMutations();
  const [targets, setTargets] = useState<Record<number, string>>({});
  const [mergingIndex, setMergingIndex] = useState<number | null>(null);

  // Most used theme of each group (groups come sorted by the server)
  useEffect(() => {
    setTargets(Object.fromEntries(groups.map((group, index) => [index, group[0]?.id])));
  }, [groups]);

  const mergeGroup = async (index: number) => {
    const group = groups[index];
    const targetId = targets[index];
    if (!group || !targetId) return;
    setMergingIndex(index);
    try {
      const result = await mergeThemes.mutateAsync({ sourceIds: group.filter(theme => theme.id !== targetId).map(theme => theme.id), targetId });
      toast.success(t("themes.mergedInto", { name: result.target.name, count: String(result.movedStories) }));
    } catch (err) {
      toast.error(getApiError(err).message);
    } finally {
      setMergingIndex(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("themes.duplicatesTitle")}</DialogTitle>
          <DialogDescription>{t("themes.duplicatesDesc")}</DialogDescription>
        </DialogHeader>

        {isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />}
        {!isLoading && groups.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t("themes.noDuplicates")}</p>}

        <ul className="space-y-4">
          {groups.map((group, index) => {
            const targetId = targets[index];
            const moved = group.filter(theme => theme.id !== targetId).reduce((sum, theme) => sum + (theme.storyCount ?? 0), 0);
            return (
              <li key={group.map(theme => theme.id).join("-")} className="space-y-3 rounded-lg border p-3">
                <RadioGroup value={targetId} onValueChange={(value) => setTargets(prev => ({ ...prev, [index]: value }))}
                  aria-label={t("themes.keepTheme")}>
                  {group.map(theme => (
                    <label key={theme.id} className="flex cursor-pointer items-center gap-3 rounded-md px-1 py-1 hover:bg-muted">
                      <RadioGroupItem value={theme.id} />
                      <ThemeBadge theme={theme} />
                      <span className="ml-auto text-xs text-muted-foreground">{t("themes.storyCount", { count: String(theme.storyCount ?? 0) })}</span>
                    </label>
                  ))}
                </RadioGroup>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">{t("themes.mergePreview", { count: String(moved) })}</p>
                  <Button type="button" size="sm" onClick={() => mergeGroup(index)} disabled={mergingIndex !== null}>
                    {mergingIndex === index && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("themes.merge")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ThemeMergeDialog;
