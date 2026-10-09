import React, { useEffect, useState } from "react";
import { i18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { Series } from "@/types/Series";
import { seriesKey } from "@/components/Story/SeriesSelector";

interface SeriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: Series | null;
  /** Series already there: a name already used is refused before sending */
  existingSeries?: Series[];
  /** Throws on failure: the dialog stays open and shows the message */
  onSubmit: (data: { name: string; description?: string }) => Promise<void>;
}

const NAME_MAX = 255;

export const SeriesDialog: React.FC<SeriesDialogProps> = ({
  open,
  onOpenChange,
  mode,
  initialData,
  existingSeries = [],
  onSubmit,
}) => {
  const t = (key: string, params?: any) => i18n.t(key, params);
  const [name, setName] = useState("");
  // Kept as is when renaming (not editable in this dialog)
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === "edit" && initialData) {
      setName(initialData.name);
      setDescription(initialData.description || "");
    } else if (mode === "create") {
      setName("");
      setDescription("");
    }
  }, [open, mode, initialData]);

  const cleanName = name.replace(/\s+/g, " ").trim();
  // Same comparison as the server (case and accents ignored); renaming keeps its own name
  const duplicate = Boolean(cleanName) && existingSeries.some(
    (s) => s.id !== initialData?.id && seriesKey(s.name) === seriesKey(cleanName)
  );
  const tooLong = cleanName.length > NAME_MAX;
  const invalid = !cleanName || duplicate || tooLong;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (invalid || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name: cleanName, description });
      onOpenChange(false);
    } catch (e) {
      const serverMessage = (e as Error)?.message || "";
      // 409 from the server (another tab created the same name in the meantime)
      setError(/already has this name/i.test(serverMessage)
        ? t("series.management.duplicateName")
        : `${t(mode === "create" ? "series.management.createError" : "series.management.updateError")} ${serverMessage}`.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  const titleKey = mode === "create"
    ? "series.management.create.title"
    : "series.management.rename.title";

  const actionKey = mode === "create"
    ? "series.management.create.action"
    : "series.management.rename.save";

  const message = duplicate
    ? t("series.management.duplicateName")
    : tooLong ? t("series.management.nameTooLong", { max: String(NAME_MAX) }) : error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t(titleKey)}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor="series-name">
              {t("series.management.table.name")}
            </Label>
            <Input
              id="series-name"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              placeholder={t("series.management.create.placeholder")}
              disabled={isSubmitting}
              aria-invalid={Boolean(message)}
              aria-describedby={message ? "series-name-error" : undefined}
              autoFocus
            />
            {message && (
              <p id="series-name-error" className="text-sm text-red-600 dark:text-red-400" role="alert">{message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || invalid}>
               {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
               {t(actionKey)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
