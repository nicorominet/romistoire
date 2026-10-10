import { Link } from "react-router-dom";
import { useWatch } from "react-hook-form";
import { AlertTriangle } from "lucide-react";
import { i18n } from "@/lib/i18n";
import { useStories } from "@/hooks/useStories";
import { getDayOrder } from "@/utils/dayUtils";
import { Story } from "@/types/Story";

interface SlotConflictNoticeProps {
  /** The story being edited: never a conflict with itself */
  storyId?: string;
}

/**
 * The server rule (story_series.helper resolveSlot): one story per week, day, age and language
 * within a series; a second one is moved to an alias series. Same series = same name, or none on both sides.
 */
export const findSlotConflict = (stories: Story[], storyId: string | undefined, seriesName: string) =>
  stories.find((story) => story.id !== storyId && (story.series_name || "") === (seriesName || "").trim());

/**
 * SlotConflictNotice Component
 *
 * Says before saving that the chosen slot is already used in this series (instead of the story
 * silently moving to an alias series).
 */
const SlotConflictNotice = ({ storyId }: SlotConflictNoticeProps) => {
  const { t } = i18n;
  const [weekNumber, dayOfWeek, ageGroup, language, seriesName] = useWatch({
    name: ["weekNumber", "dayOfWeek", "ageGroup", "language", "seriesName"],
  }) as [string, string, string, string, string];
  const dayOrder = dayOfWeek ? getDayOrder(dayOfWeek) : 0;

  const { data, isPlaceholderData } = useStories(
    { page: 1, limit: 10, locale: language, weekNumber, ageGroup, dayOfWeek: String(dayOrder) },
    { enabled: Boolean(dayOrder && weekNumber && ageGroup && language) },
  );
  // The previous slot's answer is kept while the new one loads: never shown as a conflict
  const conflict = dayOrder && !isPlaceholderData ? findSlotConflict(data?.data ?? [], storyId, seriesName) : undefined;
  if (!conflict) return null;

  return (
    <div role="status" className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-200">
      <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        {t("editor.slotTaken")}{" "}
        <Link to={`/stories/${conflict.id}`} target="_blank" className="font-semibold underline">
          {conflict.title}
        </Link>
        {". "}
        {t("editor.slotAlias")}
      </p>
    </div>
  );
};

export default SlotConflictNotice;
