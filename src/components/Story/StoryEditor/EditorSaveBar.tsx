import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, RotateCcw, Save } from "lucide-react";
import { i18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EditorSaveBarProps {
  title: string;
  /** Unsaved changes: shown, and the discard button is offered */
  dirty: boolean;
  saving: boolean;
  onBack: () => void;
  /** Back to the loaded values (edit page only) */
  onDiscard?: () => void;
  saveLabel?: string;
}

// The macOS shortcut shows the Cmd key
const SHORTCUT = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘S" : "Ctrl+S";

/**
 * EditorSaveBar Component
 *
 * Bar stuck to the top of the edit and create pages: back, what is edited, whether changes are unsaved,
 * and the save button, always in sight. Its height is published as --save-bar-height so the editor
 * toolbar can stick right below it.
 */
const EditorSaveBar = ({ title, dirty, saving, onBack, onDiscard, saveLabel }: EditorSaveBarProps) => {
  const { t } = i18n;
  const barRef = useRef<HTMLDivElement>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty("--save-bar-height", `${bar.offsetHeight}px`));
    observer.observe(bar);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--save-bar-height");
    };
  }, []);

  return (
    <div
      ref={barRef}
      className="sticky top-0 z-30 -mx-4 -mt-8 mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/40 bg-white/85 px-4 py-2.5 backdrop-blur-md dark:border-white/10 dark:bg-slate-900/85 2xl:-mx-6 2xl:px-6"
    >
      <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={onBack} disabled={saving}>
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">{t("common.back")}</span>
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-story-purple-800 dark:text-story-purple-200">{title}</h1>

      <div className="flex items-center gap-2">
        {dirty && !saving && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400" role="status">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="hidden sm:inline">{t("editor.unsaved")}</span>
          </span>
        )}
        {onDiscard && dirty && (
          <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => setConfirmDiscard(true)} disabled={saving}>
            <RotateCcw className="h-4 w-4" />
            <span className="hidden md:inline">{t("editor.discard")}</span>
          </Button>
        )}
        <Button type="submit" size="sm" disabled={saving} className="gap-2 bg-story-purple-600 text-white hover:bg-story-purple-700">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? t("common.saving") : saveLabel ?? t("common.save")}
          <kbd className="hidden rounded border border-white/40 px-1 text-[10px] font-sans opacity-80 lg:inline">{SHORTCUT}</kbd>
        </Button>
      </div>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("editor.discardTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("editor.discardConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={onDiscard}>{t("editor.discard")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EditorSaveBar;
