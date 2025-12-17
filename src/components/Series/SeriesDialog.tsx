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

interface SeriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: Series | null;
  onSubmit: (data: { name: string; description?: string }) => Promise<void>;
}

export const SeriesDialog: React.FC<SeriesDialogProps> = ({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
}) => {
  const t = (key: string, params?: any) => i18n.t(key, params);
  const [name, setName] = useState("");
  // Description is supported in DB but was missing in UI. Adding it now.
  const [description, setDescription] = useState(""); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open && mode === "edit" && initialData) {
      setName(initialData.name);
      setDescription(initialData.description || "");
    } else if (open && mode === "create") {
        setName("");
        setDescription("");
    }
  }, [open, mode, initialData]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit({ name, description });
      onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(titleKey)}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="series-name">
              {t("series.management.table.name")}
            </Label>
            <Input
              id="series-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("series.management.create.placeholder")}
              disabled={isSubmitting}
            />
          </div>
          {/* Optional: Add Description field if we want to expose it */}
          {/* 
          <div className="grid gap-2">
             <Label htmlFor="series-desc">Description</Label>
             <Input 
                id="series-desc" 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                disabled={isSubmitting}
             />
          </div> 
          */}
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isSubmitting || !name.trim()}>
             {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
             {t(actionKey)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
