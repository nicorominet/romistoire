import { Link } from "react-router-dom";
import { CalendarDays, ChevronDown, Cpu, Headphones, Info, Sparkles, User } from "lucide-react";
import { i18n } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import { Story } from "@/types/Story";
import { AudioSettings } from "@/types/system.types";
import IllustrationPromptCard from "@/components/Story/IllustrationPromptCard";
import AudioGenerateButton from "./AudioGenerateButton";
import { storyDayLabel } from "@/components/Story/StoryCard";

interface StorySidePanelProps {
  story: Story;
  /** Topic of the story's week (free text, not a story theme) */
  weekTopic: string | null;
  audioPending: boolean;
  onGenerateAudio: (voice: Partial<AudioSettings>) => void;
}

const SOURCE_ICONS = { gemini: Sparkles, ollama: Cpu, manual: User };

const Section = ({ icon: Icon, title, children }: { icon: typeof Info; title: string; children: React.ReactNode }) => (
  <section className="space-y-3 rounded-xl border border-white/50 bg-white/70 p-4 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-slate-900/60">
    <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
      <Icon aria-hidden="true" className="h-4 w-4 text-story-purple-600 dark:text-story-purple-300" />
      {title}
    </h2>
    {children}
  </section>
);

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex justify-between gap-3 text-sm">
    <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
    <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{children}</dd>
  </div>
);

/**
 * StorySidePanel Component
 *
 * Everything around the text of a story: its audio, its place in the program, the illustration
 * still to make, and the management details (folded).
 */
const StorySidePanel = ({ story, weekTopic, audioPending, onGenerateAudio }: StorySidePanelProps) => {
  const { t } = i18n;
  const locale = i18n.getCurrentLocale();
  const SourceIcon = SOURCE_ICONS[story.source] ?? User;

  return (
    <div className="space-y-4">
      <Section icon={Headphones} title={t("story.detail.audio")}>
        {story.audio_path ? (
          // No hardcoded type: files can be wav, mp3... the browser sniffs it. key reloads a regenerated file
          <audio key={story.audio_path} controls preload="metadata" className="w-full">
            <source src={story.audio_path} />
            {t("story.audio.unsupported")}
          </audio>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("story.detail.noAudio")}</p>
        )}
        <AudioGenerateButton
          ageGroup={String(story.age_group)}
          hasAudio={Boolean(story.audio_path)}
          isPending={audioPending}
          onGenerate={onGenerateAudio}
        />
      </Section>

      <Section icon={CalendarDays} title={t("story.detail.program")}>
        <dl className="space-y-2">
          <Row label={t("story.week")}>
            <Link to={`/stories?weekNumber=${story.week_number}`} className="text-story-purple-700 hover:underline dark:text-story-purple-300">
              {story.week_number}
            </Link>
          </Row>
          <Row label={t("story.day")}>{storyDayLabel(story.day_order)}</Row>
          <Row label={t("story.ageGroup")}>{t(`ages.${story.age_group}`)}</Row>
          {weekTopic && <Row label={t("weeklyTopics.topicOfWeek")}>{weekTopic}</Row>}
          {story.series_name && (
            <Row label={t("story.detail.series")}>
              {story.series_id ? (
                <Link to={`/stories?seriesId=${story.series_id}`} className="text-story-purple-700 hover:underline dark:text-story-purple-300">{story.series_name}</Link>
              ) : story.series_name}
            </Row>
          )}
        </dl>
      </Section>

      {/* Useful until an illustration has been added */}
      {!story.illustrations?.length && <IllustrationPromptCard prompt={story.illustration_prompt} storyId={story.id} />}

      <details className="group rounded-xl border border-white/50 bg-white/70 p-4 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-slate-900/60">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 [&::-webkit-details-marker]:hidden">
          <Info aria-hidden="true" className="h-4 w-4 text-story-purple-600 dark:text-story-purple-300" />
          {t("story.detail.details")}
          <ChevronDown aria-hidden="true" className="ml-auto h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <dl className="mt-3 space-y-2">
          <Row label={t("story.source.title")}>
            <span className="inline-flex items-center gap-1">
              <SourceIcon aria-hidden="true" className="h-3.5 w-3.5" />
              {t(`story.source.${story.source || "manual"}`)}
            </span>
            {!!story.is_manually_edited && story.source !== "manual" && (
              <span className="block text-xs font-normal italic text-gray-500 dark:text-gray-400">{t("story.source.editedByHuman")}</span>
            )}
          </Row>
          <Row label={t("story.version")}>v{story.version}</Row>
          <Row label={t("story.language")}>{t(`languages.${story.locale}`)}</Row>
          <Row label={t("story.created")}>{formatDate(story.created_at, locale)}</Row>
          <Row label={t("story.detail.modified")}>{formatDate(story.modified_at, locale)}</Row>
        </dl>
      </details>
    </div>
  );
};

export default StorySidePanel;
