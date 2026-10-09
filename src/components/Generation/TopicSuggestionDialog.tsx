import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { i18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { generationJobsApi } from "@/api/generationJobs.api";
import { weeklyThemeApi } from "@/api/themes.api";
import { themeKeys } from "@/hooks/useThemes";
import { TopicSuggestion } from "@/types/generation.types";

interface TopicSuggestionDialogProps {
  /** Weeks without topic to fill (null: closed) */
  weeks: number[] | null;
  onClose: () => void;
}

/** Suggestions are asked by groups (the server accepts 26 weeks per request). */
const BATCH = 26;

/**
 * TopicSuggestionDialog Component
 *
 * Asks the AI for topics of weeks that have none, lets the user keep some, then saves them in the program.
 */
export const TopicSuggestionDialog = ({ weeks, onClose }: TopicSuggestionDialogProps) => {
  const { t } = i18n;
  const queryClient = useQueryClient();
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!weeks || weeks.length === 0) return;
    let cancelled = false;
    setSuggestions([]);
    setError(null);
    setLoading(true);
    (async () => {
      try {
        const all: TopicSuggestion[] = [];
        for (let i = 0; i < weeks.length; i += BATCH) {
          all.push(...await generationJobsApi.suggestTopics(weeks.slice(i, i + BATCH)));
          if (cancelled) return;
          setSuggestions([...all]);
        }
        setSelected(new Set(all.map((s) => s.week)));
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [weeks]);

  const toggle = (week: number) => {
    const next = new Set(selected);
    if (next.has(week)) next.delete(week); else next.add(week);
    setSelected(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await weeklyThemeApi.update(suggestions
        .filter((s) => selected.has(s.week))
        .map((s) => ({ week_number: s.week, theme_name: s.name, theme_description: s.description })));
      queryClient.invalidateQueries({ queryKey: themeKeys.weekly });
      queryClient.invalidateQueries({ queryKey: ["generation-coverage"] });
      toast.success(t("generation.topics.saved", { count: String(selected.size) }));
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(weeks)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> {t("generation.topics.title")}</DialogTitle>
          <DialogDescription>{t("generation.topics.description")}</DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <ul className="max-h-[50vh] space-y-2 overflow-auto">
          {suggestions.map((s) => (
            <li key={s.week} className="flex items-start gap-3 rounded-md border p-2">
              <Checkbox id={`topic-${s.week}`} checked={selected.has(s.week)} onCheckedChange={() => toggle(s.week)} className="mt-1" />
              <label htmlFor={`topic-${s.week}`} className="cursor-pointer text-sm">
                <span className="font-medium">{t("timeline.weekNumber", { number: s.week })} — {s.name}</span>
                {s.description && <span className="block text-gray-500 dark:text-gray-400">{s.description}</span>}
              </label>
            </li>
          ))}
        </ul>
        {loading && (
          <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> {t("generation.topics.loading")}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={loading || saving || selected.size === 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("generation.topics.save", { count: String(selected.size) })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
