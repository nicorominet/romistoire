import { forwardRef, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlignLeft, BookOpen, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { i18n } from "@/lib/i18n";
import { getApiError } from "@/lib/apiError";
import { APP_ROUTES } from "@/constants";
import { useWeeklyThemeMutations } from "@/hooks/useThemes";
import { WeeklyTheme } from "@/types/Theme";

export const TOPIC_MAX = 150;
export const TOPIC_DESCRIPTION_MAX = 500;

type SaveStatus = "idle" | "saving" | "saved";

interface WeeklyTopicRowProps {
  weekNumber: number;
  /** "6 – 12 janv." */
  rangeLabel: string;
  week?: WeeklyTheme;
  isCurrent?: boolean;
}

/**
 * One week of the program: topic and optional description, saved when the field loses focus.
 * Emptying the topic removes the week.
 */
export const WeeklyTopicRow = forwardRef<HTMLLIElement, WeeklyTopicRowProps>(({ weekNumber, rangeLabel, week, isCurrent }, ref) => {
  const { t } = i18n;
  const { setWeekTheme, clearWeekTheme } = useWeeklyThemeMutations();
  const savedName = week?.theme_name ?? "";
  const savedDescription = week?.theme_description ?? "";
  const [name, setName] = useState(savedName);
  const [description, setDescription] = useState(savedDescription);
  const [showDescription, setShowDescription] = useState(Boolean(savedDescription));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const rowRef = useRef<HTMLDivElement>(null);

  // Follow server data (another tab, refetch) unless the user is editing this row
  useEffect(() => {
    if (rowRef.current?.contains(document.activeElement)) return;
    setName(savedName);
    setDescription(savedDescription);
  }, [savedName, savedDescription]);

  useEffect(() => {
    if (status !== "saved") return;
    const timer = setTimeout(() => setStatus("idle"), 1500);
    return () => clearTimeout(timer);
  }, [status]);

  const save = async () => {
    const nextName = name.trim();
    const nextDescription = description.trim();
    if (nextName === savedName && nextDescription === savedDescription) return;
    if (!nextName && !week) return;

    setStatus("saving");
    try {
      if (nextName) await setWeekTheme.mutateAsync({ weekNumber, name: nextName, description: nextDescription });
      else await clearWeekTheme.mutateAsync(weekNumber);
      setStatus("saved");
    } catch (err) {
      setStatus("idle");
      toast.error(getApiError(err).message);
    }
  };

  // Save once the focus leaves the row (topic and description edited together)
  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (rowRef.current?.contains(event.relatedTarget as Node | null)) return;
    void save();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") {
      setName(savedName);
      setDescription(savedDescription);
    }
  };

  const weekLabel = t("timeline.weekNumber", { number: weekNumber });

  return (
    <li ref={ref} className={cn("rounded-lg border bg-card p-3", isCurrent && "border-primary ring-1 ring-primary", !savedName && "bg-muted/30")}>
      <div ref={rowRef} onBlur={handleBlur} className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-2 sm:grid-cols-[7rem_1fr_auto]">
        <div className="col-span-2 flex items-baseline gap-2 sm:col-span-1 sm:block">
          <p className="font-medium tabular-nums">
            {weekLabel}
            {isCurrent && <span className="ml-2 rounded bg-primary px-1.5 py-0.5 text-[10px] uppercase text-primary-foreground">{t("weeklyThemes.current")}</span>}
          </p>
          <p className="text-xs text-muted-foreground">{rangeLabel}</p>
        </div>

        <div className="space-y-2">
          <Input
            value={name}
            maxLength={TOPIC_MAX}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("weeklyTopics.topicPlaceholder")}
            aria-label={t("weeklyTopics.topicOfWeekNumber", { week: String(weekNumber) })}
          />
          {showDescription && (
            <Textarea
              value={description}
              maxLength={TOPIC_DESCRIPTION_MAX}
              rows={2}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("weeklyTopics.descriptionPlaceholder")}
              aria-label={t("weeklyTopics.descriptionOfWeekNumber", { week: String(weekNumber) })}
            />
          )}
        </div>

        <div className="flex items-center gap-1 pt-1">
          <span className="flex h-8 w-6 items-center justify-center" aria-live="polite">
            {status === "saving" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label={t("weeklyTopics.saving")} />}
            {status === "saved" && <Check className="h-4 w-4 text-green-600" aria-label={t("weeklyTopics.saved")} />}
          </span>
          <Button type="button" variant="ghost" size="icon" className={cn("h-8 w-8", showDescription && "text-primary")}
            onClick={() => setShowDescription(value => !value)} aria-pressed={showDescription}
            aria-label={t("weeklyTopics.toggleDescription")} title={t("weeklyTopics.toggleDescription")}>
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link to={`${APP_ROUTES.STORIES}?weekNumber=${weekNumber}`} aria-label={t("weeklyThemes.weekStories", { week: String(weekNumber) })}
              title={t("weeklyThemes.weekStories", { week: String(weekNumber) })}>
              <BookOpen className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </li>
  );
});

WeeklyTopicRow.displayName = "WeeklyTopicRow";
