import { useCallback, useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";
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
import { i18n } from "@/lib/i18n";

/**
 * Asks for confirmation before leaving a page with unsaved changes:
 * in-app navigation (links, back button) through a dialog, tab close / reload through the browser prompt.
 * Requires a data router (createBrowserRouter), see App.tsx.
 * @param isDirty - Whether the page has unsaved changes.
 * @returns `dialog` to render in the page, and `allowNavigation()` to call before navigating
 *   away on purpose (e.g. right after a successful save).
 */
export const useUnsavedChangesGuard = (isDirty: boolean) => {
  const { t } = i18n;
  const allowedRef = useRef(false);
  const allowNavigation = useCallback(() => { allowedRef.current = true; }, []);

  // Only block navigation to another page (tab or query changes on the same page are fine)
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    isDirty && !allowedRef.current && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (!isDirty) return;
    allowedRef.current = false;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const dialog = (
    <AlertDialog
      open={blocker.state === "blocked"}
      onOpenChange={(open) => { if (!open && blocker.state === "blocked") blocker.reset(); }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("common.unsavedTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("common.unsavedDesc")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => blocker.reset?.()}>{t("common.stay")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => blocker.proceed?.()}
            className="bg-red-600 hover:bg-red-700"
          >
            {t("common.leave")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { dialog, allowNavigation };
};
