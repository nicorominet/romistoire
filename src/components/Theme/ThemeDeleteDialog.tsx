import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { i18n } from "@/lib/i18n";
import { getApiError } from "@/lib/apiError";
import { useThemeMutations } from "@/hooks/useThemes";
import { Theme } from "@/types/Theme";
import { ThemeBadge } from "./ThemeBadge";
import { ThemeSelect } from "./ThemeSelect";

interface ThemeDeleteDialogProps {
  /** Theme to delete; closed when null */
  theme: Theme | null;
  /** Candidate replacement themes */
  themes: Theme[];
  /** merge: "Merge into…" action, the replacement theme is required */
  mode?: "delete" | "merge";
  /** Pre-selected replacement theme */
  defaultReplacementId?: string | null;
  onClose: () => void;
}

/**
 * Delete a theme. A theme used by stories needs a replacement: its stories (and versions, weeks) move to it.
 */
export const ThemeDeleteDialog = ({ theme, themes, mode = "delete", defaultReplacementId = null, onClose }: ThemeDeleteDialogProps) => {
  const { t } = i18n;
  const { deleteTheme } = useThemeMutations();
  const [replacementId, setReplacementId] = useState<string | null>(null);

  useEffect(() => {
    setReplacementId(defaultReplacementId);
  }, [theme, defaultReplacementId]);

  if (!theme) return null;
  const storyCount = theme.storyCount ?? 0;
  const merging = mode === "merge";
  const needsReplacement = merging || storyCount > 0;
  const candidates = themes.filter(candidate => candidate.id !== theme.id);

  const handleDelete = async () => {
    try {
      const result = await deleteTheme.mutateAsync({ id: theme.id, reassignTo: replacementId ?? undefined });
      toast.success(result.movedStories > 0
        ? t("themes.deletedAndMoved", { count: String(result.movedStories) })
        : t("themes.themeDeletedSuccess"));
      onClose();
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  };

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{merging ? t("themes.mergeTitle") : t("themes.deleteTheme")}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div><ThemeBadge theme={theme} size="md" /></div>
              <p>
                {merging
                  ? t("themes.mergeDesc", { count: String(storyCount) })
                  : needsReplacement
                    ? t("themes.deleteUsedDesc", { count: String(storyCount) })
                    : t("themes.deleteUnusedDesc")}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {needsReplacement && (
          <div className="space-y-1.5">
            <Label htmlFor="theme-replacement">{t("themes.replacement")}</Label>
            <ThemeSelect id="theme-replacement" themes={candidates} value={replacementId} onChange={setReplacementId}
              placeholder={t("themes.chooseReplacement")} />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <Button
            type="button"
            variant={merging ? "default" : "destructive"}
            disabled={deleteTheme.isPending || (needsReplacement && !replacementId)}
            onClick={handleDelete}
          >
            {deleteTheme.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {merging ? t("themes.merge") : replacementId ? t("themes.moveAndDelete") : t("common.delete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ThemeDeleteDialog;
