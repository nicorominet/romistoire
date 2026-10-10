import { useState } from "react";
import { Eye, History, Loader2 } from "lucide-react";
import { i18n } from "@/lib/i18n";
import { storyPreview } from "@/lib/utils";
import { storyParagraphs } from "@/lib/textDiff";
import { StoryVersion } from "@/types/Story";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VersionDiff, { ComparedStory } from "./VersionDiff";

interface VersionHistoryProps {
  versions: StoryVersion[];
  /** The story as saved now: what a version is compared with */
  current: ComparedStory;
  /** Restores the version: the page saves it as the new current version */
  onRestore: (versionId: string) => void;
  saving: boolean;
  hasUnsavedChanges: boolean;
}

/**
 * VersionHistory Component
 *
 * Earlier versions of a story, newest first: date, title and first words; each one opens on what restoring it
 * would change (compared with the saved story), and can be read in full.
 */
const VersionHistory = ({ versions, current, onRestore, saving, hasUnsavedChanges }: VersionHistoryProps) => {
  const { t } = i18n;
  const [openId, setOpenId] = useState<string | null>(null);
  const locale = i18n.getCurrentLocale() === "en" ? "en" : "fr";
  const formatVersionDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
  };

  const sorted = [...versions].sort((a, b) => b.version - a.version);
  const opened = sorted.find((version) => version.id === openId);

  return (
    <section className="space-y-3 rounded-xl border border-white/50 bg-white/60 p-4 dark:border-white/10 dark:bg-slate-900/50">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        <History aria-hidden="true" className="h-4 w-4 text-story-purple-600 dark:text-story-purple-300" />
        {t("editor.history.title")}
      </h2>

      {sorted.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("editor.history.empty")}</p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {sorted.map((version) => (
            <li key={version.id} className="flex items-start gap-2 rounded-lg border border-white/60 bg-white/70 p-2.5 dark:border-white/10 dark:bg-slate-950/30">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  v{version.version} · {formatVersionDate(version.createdAt)}
                </p>
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{version.title}</p>
                <p className="line-clamp-2 text-xs text-gray-600 dark:text-gray-300">{storyPreview(version.content, 120)}</p>
              </div>
              <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1" onClick={() => setOpenId(version.id)} disabled={saving}>
                <Eye className="h-3.5 w-3.5" />
                {t("editor.history.view")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(opened)} onOpenChange={(open) => !open && setOpenId(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {opened && (
            <>
              <DialogHeader>
                <DialogTitle>{t("story.restoreConfirmTitle", { version: String(opened.version) })}</DialogTitle>
                <DialogDescription>
                  {formatVersionDate(opened.createdAt)} ·{" "}
                  {t("story.versionDetails", {
                    age: t(`ages.${opened.ageGroup}`),
                    themes: opened.themes.map((theme) => theme.name).join(", ") || t("story.noThemes"),
                  })}
                </DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="diff">
                <TabsList>
                  <TabsTrigger value="diff">{t("editor.diff.tab")}</TabsTrigger>
                  <TabsTrigger value="full">{t("editor.diff.fullText")}</TabsTrigger>
                </TabsList>
                <TabsContent value="diff">
                  <VersionDiff
                    current={current}
                    version={{ title: opened.title, content: opened.content, ageGroup: opened.ageGroup, themes: opened.themes.map((theme) => theme.name) }}
                  />
                </TabsContent>
                <TabsContent value="full">
                  <article className="space-y-2 rounded-lg border p-4">
                    <h3 className="text-lg font-semibold">{opened.title}</h3>
                    {storyParagraphs(opened.content).map((paragraph, index) => (
                      <p key={index} className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{paragraph}</p>
                    ))}
                  </article>
                </TabsContent>
              </Tabs>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t("story.restoreConfirmDesc")}</p>
              {hasUnsavedChanges && (
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">{t("story.restoreUnsavedWarning")}</p>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpenId(null)}>{t("common.cancel")}</Button>
                <Button
                  type="button"
                  className="gap-2 bg-story-purple-600 text-white hover:bg-story-purple-700"
                  disabled={saving}
                  onClick={() => onRestore(opened.id)}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
                  {t("editor.history.restore")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default VersionHistory;
