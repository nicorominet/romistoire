import { useMemo } from "react";
import { i18n } from "@/lib/i18n";
import { diffStats, diffWords, DiffPart, PARAGRAPH, storyTokens } from "@/lib/textDiff";

/** What a version is compared with: the story as currently saved. */
export interface ComparedStory {
  title: string;
  content: string;
  ageGroup: string;
  themes: string[];
}

const PART_CLASS: Record<DiffPart["type"], string> = {
  same: "",
  removed: "rounded bg-rose-100 px-0.5 text-rose-800 line-through decoration-rose-500 dark:bg-rose-400/20 dark:text-rose-200",
  added: "rounded bg-emerald-100 px-0.5 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-200",
};

/** Space between two parts, except at a paragraph break. */
const needsSpace = (previous: DiffPart | undefined, part: DiffPart) =>
  Boolean(previous) && !previous!.text.endsWith(PARAGRAPH) && !part.text.startsWith(PARAGRAPH);

/**
 * VersionDiff Component
 *
 * What restoring a version would change, from the current story: words in red (struck) disappear,
 * words in green come back; title, age and tags changes listed above.
 */
const VersionDiff = ({ current, version }: { current: ComparedStory; version: ComparedStory }) => {
  const { t } = i18n;
  const parts = useMemo(() => diffWords(storyTokens(current.content), storyTokens(version.content)), [current.content, version.content]);
  const stats = diffStats(parts);

  const removedThemes = current.themes.filter((theme) => !version.themes.includes(theme));
  const addedThemes = version.themes.filter((theme) => !current.themes.includes(theme));
  const changes = [
    current.title !== version.title && t("editor.diff.title", { from: current.title, to: version.title }),
    current.ageGroup !== version.ageGroup && t("editor.diff.age", { from: t(`ages.${current.ageGroup}`), to: t(`ages.${version.ageGroup}`) }),
    addedThemes.length > 0 && t("editor.diff.themesAdded", { themes: addedThemes.join(", ") }),
    removedThemes.length > 0 && t("editor.diff.themesRemoved", { themes: removedThemes.join(", ") }),
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-3">
      {changes.length > 0 && (
        <ul className="list-inside list-disc space-y-1 text-sm text-gray-700 dark:text-gray-300">
          {changes.map((change) => <li key={change}>{change}</li>)}
        </ul>
      )}

      {stats.added === 0 && stats.removed === 0 ? (
        <p className="rounded-lg border p-3 text-sm text-gray-600 dark:text-gray-400">{t("editor.diff.sameText")}</p>
      ) : (
        <>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
            <span><span className={PART_CLASS.added}>{t("editor.diff.legendAdded")}</span> · {t("editor.diff.words", { count: String(stats.added) })}</span>
            <span><span className={PART_CLASS.removed}>{t("editor.diff.legendRemoved")}</span> · {t("editor.diff.words", { count: String(stats.removed) })}</span>
          </p>
          {/* Paragraph breaks are "\n" in the parts: shown as blank lines */}
          <div className="whitespace-pre-wrap rounded-lg border p-4 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {parts.map((part, index) => (
              <span key={index}>
                {needsSpace(parts[index - 1], part) && " "}
                <span className={PART_CLASS[part.type]}>{part.text.split(PARAGRAPH).join("\n\n")}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default VersionDiff;
