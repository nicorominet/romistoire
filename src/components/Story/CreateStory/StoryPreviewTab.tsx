import DOMPurify from "dompurify";
import { i18n } from "@/lib/i18n";
import { getAgeGroupColor } from "@/lib/utils";
import { Theme } from "@/types/Theme";
import { ThemeBadgeList } from "@/components/Theme/ThemeBadgeList";
import { SelectedTheme } from "@/components/Theme/ThemeSelect";

interface StoryPreviewTabProps {
  title: string;
  content: string;
  watchThemes: SelectedTheme[];
  watchAgeGroup: string;
  availableThemes: Theme[];
  illustrations: any[];
  getImageSrc: (img: any) => string | undefined;
  darkMode: boolean;
}

const StoryPreviewTab = ({
  title,
  content,
  watchThemes,
  watchAgeGroup,
  availableThemes,
  illustrations,
  getImageSrc,
  darkMode
}: StoryPreviewTabProps) => {
  const { t } = i18n;

  return (
    <div
      className={`rounded-xl shadow-md p-6 max-w-3xl mx-auto ${
        darkMode
          ? "dark:bg-gray-800 dark:text-gray-100 bg-white text-gray-900"
          : "bg-white text-gray-900"
      }`}
    >
      <h2 className="text-2xl font-bold text-story-purple-800 mb-4">
        {title || t("create.preview.untitledStory")}
      </h2>
      <div className="flex flex-wrap gap-2 mb-6">
        <ThemeBadgeList
          size="md"
          themes={(watchThemes || []).flatMap(({ id, isPrimary }) => {
            const theme = availableThemes.find(available => available.id === id);
            return theme ? [{ ...theme, isPrimary }] : [];
          })}
        />
        <div
          className={`px-3 py-1 rounded-full text-sm ${getAgeGroupColor(
            watchAgeGroup
          )}`}
        >
          {t(`ages.${watchAgeGroup}`)}
        </div>
      </div>

      <div className="prose prose-lg dark:prose-invert max-w-none">
        {content ? (
          content.trim().startsWith('<') ? (
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />
          ) : (
             <div
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(content.replace(/\n/g, "<br />")),
            }}
          />
          )
        ) : (
          <p className="text-gray-400 italic">
            {t("create.preview.storyContentPlaceholder")}
          </p>
        )}
      </div>

      {illustrations.length > 0 && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {illustrations.map((img, index) => {
            const src = getImageSrc(img);
            return (
              <img
                key={index}
                src={src}
                alt={t("create.preview.illustrationAlt", { number: (index + 1).toString() })}
                className="rounded-md shadow-sm"
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StoryPreviewTab;
