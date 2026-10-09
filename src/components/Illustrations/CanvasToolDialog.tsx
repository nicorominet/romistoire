import { useState } from "react";
import { Copy, Download, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { i18n } from "@/lib/i18n";

/** Batch image generator to paste into Gemini Canvas (served from public/tools). */
export const CANVAS_TOOL_URL = "/tools/canvas-illustrations.html";

interface CanvasToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * How to generate the images in batch with Gemini Canvas: the image models are free there (key provided by
 * Canvas), not through the API of the app.
 */
export const CanvasToolDialog = ({ open, onOpenChange }: CanvasToolDialogProps) => {
  const { t } = i18n;
  const [copying, setCopying] = useState(false);

  const copyCode = async () => {
    setCopying(true);
    try {
      const response = await fetch(CANVAS_TOOL_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await navigator.clipboard.writeText(await response.text());
      toast.success(t("illustrations.canvas.copied"));
    } catch (error) {
      toast.error(t("illustrations.canvas.copyError"), { description: (error as Error).message });
    } finally {
      setCopying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("illustrations.canvas.title")}</DialogTitle>
          <DialogDescription>{t("illustrations.canvas.description")}</DialogDescription>
        </DialogHeader>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>{t("illustrations.canvas.step1")}</li>
          <li>{t("illustrations.canvas.step2")}</li>
          <li>{t("illustrations.canvas.step3")}</li>
          <li>{t("illustrations.canvas.step4")}</li>
          <li>{t("illustrations.canvas.step5")}</li>
        </ol>
        <p className="text-xs text-muted-foreground">{t("illustrations.canvas.note")}</p>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" asChild>
            <a href="https://gemini.google.com/app" target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              {t("illustrations.canvas.openGemini")}
            </a>
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" asChild>
              <a href={CANVAS_TOOL_URL} download="canvas-illustrations.html">
                <Download className="mr-2 h-4 w-4" />
                {t("illustrations.canvas.download")}
              </a>
            </Button>
            <Button type="button" onClick={copyCode} disabled={copying}>
              {copying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
              {t("illustrations.canvas.copy")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
