import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { i18n } from "@/lib/i18n";
import { getApiError } from "@/lib/apiError";
import { useThemeMutations } from "@/hooks/useThemes";
import { FALLBACK_THEME_COLOR, parseHexColor } from "@/utils/themeColors";
import { Theme, ThemeInput } from "@/types/Theme";
import { ThemeBadge } from "./ThemeBadge";
import { ThemeColorPicker } from "./ThemeColorPicker";
import { ThemeIconPicker } from "./ThemeIconPicker";

interface ThemeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Theme to edit; create mode when absent */
  theme?: Theme | null;
  /** Called with the saved theme */
  onSaved?: (theme: Theme) => void;
  /** Rename onto an existing name: the page offers to merge into that theme */
  onMergeRequest?: (source: Theme, target: { id: string; name: string }) => void;
}

const NAME_MAX = 100;
const emptyForm: ThemeInput = { name: "", description: "", color: FALLBACK_THEME_COLOR, icon: null };

/**
 * Create / edit a theme with a live badge preview.
 * Creating an existing name returns that theme; renaming onto an existing name offers a merge.
 */
export const ThemeFormDialog = ({ open, onOpenChange, theme, onSaved, onMergeRequest }: ThemeFormDialogProps) => {
  const { t } = i18n;
  const { createTheme, updateTheme } = useThemeMutations();
  const [form, setForm] = useState<ThemeInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ id: string; name: string } | null>(null);
  const saving = createTheme.isPending || updateTheme.isPending;

  useEffect(() => {
    if (!open) return;
    setForm(theme ? { name: theme.name, description: theme.description ?? "", color: theme.color || FALLBACK_THEME_COLOR, icon: theme.icon ?? null } : emptyForm);
    setError(null);
    setConflict(null);
  }, [open, theme]);

  const update = (patch: Partial<ThemeInput>) => {
    setForm(prev => ({ ...prev, ...patch }));
    setError(null);
    setConflict(null);
  };

  const validate = (): string | null => {
    if (!form.name.trim()) return t("themes.validation.nameRequired");
    if (form.name.trim().length > NAME_MAX) return t("themes.validation.nameTooLong");
    if (!parseHexColor(form.color)) return t("themes.validation.colorRequired");
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    const data = { ...form, name: form.name.trim(), description: form.description?.trim() ?? "" };
    try {
      if (theme) {
        const saved = await updateTheme.mutateAsync({ id: theme.id, data });
        toast.success(t("themes.themeUpdatedSuccess"));
        onSaved?.(saved);
      } else {
        const saved = await createTheme.mutateAsync(data);
        if (saved.existing) toast.info(t("themes.alreadyExists", { name: saved.name }));
        else toast.success(t("themes.themeAddedSuccess"));
        onSaved?.(saved);
      }
      onOpenChange(false);
    } catch (err) {
      const { status, data: body, message } = getApiError<{ conflictWith?: { id: string; name: string } }>(err);
      if (status === 409 && body.conflictWith) setConflict(body.conflictWith);
      else setError(message);
    }
  };

  const preview = { id: theme?.id ?? "preview", name: form.name.trim() || t("themes.namePlaceholder"), color: form.color, icon: form.icon };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{theme ? t("themes.editTheme") : t("themes.addNewTheme")}</DialogTitle>
            <DialogDescription>{t("themes.formDescription")}</DialogDescription>
          </DialogHeader>

          <div className="flex justify-center rounded-md border border-dashed p-3">
            <ThemeBadge theme={preview} size="md" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="theme-name">{t("themes.name")}</Label>
            <Input id="theme-name" value={form.name} maxLength={NAME_MAX} autoFocus
              onChange={(e) => update({ name: e.target.value })} placeholder={t("themes.namePlaceholder")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="theme-description">{t("themes.description")}</Label>
            <Textarea id="theme-description" value={form.description} rows={2} maxLength={500}
              onChange={(e) => update({ description: e.target.value })} placeholder={t("themes.descriptionPlaceholder")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="theme-color">{t("themes.color")}</Label>
            <ThemeColorPicker id="theme-color" value={form.color ?? FALLBACK_THEME_COLOR} onChange={(color) => update({ color })} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="theme-icon">{t("themes.icon")}</Label>
            <ThemeIconPicker id="theme-icon" value={form.icon} onChange={(icon) => update({ icon })} />
          </div>

          {error && <p className="text-sm font-medium text-destructive" role="alert">{error}</p>}
          {conflict && theme && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40" role="alert">
              <p>{t("themes.nameConflict", { name: conflict.name })}</p>
              {onMergeRequest && (
                <Button type="button" variant="link" className="h-auto p-0" onClick={() => { onOpenChange(false); onMergeRequest(theme, conflict); }}>
                  {t("themes.mergeInto", { name: conflict.name })}
                </Button>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
