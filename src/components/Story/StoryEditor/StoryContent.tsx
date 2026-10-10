import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import RichTextEditor, { EditorImage } from "@/components/Common/RichTextEditor";
import { i18n } from "@/lib/i18n";
import { readingStats } from "@/lib/utils";

interface StoryContentProps {
  disabled?: boolean;
  /** Illustrations of the story, offered for insertion in the text */
  images?: EditorImage[];
}

/** Title and text of a story (edit and create pages), with the words and reading-aloud time. */
const StoryContent = ({ disabled = false, images }: StoryContentProps) => {
  const { t } = i18n;
  const { control, watch } = useFormContext();
  const content = watch("content");
  const { words, minutes } = readingStats(content);

  return (
    <div className="space-y-4">
      <FormField
        control={control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-gray-900 dark:text-gray-100">{t("story.title")}</FormLabel>
            <FormControl>
              <Input
                placeholder={t("story.titlePlaceholder")}
                {...field}
                className="h-12 bg-white/50 text-xl font-semibold text-gray-900 backdrop-blur-sm border-white/20 dark:border-white/10 dark:bg-gray-800/50 dark:text-gray-100"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="content"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-gray-900 dark:text-gray-100">{t("story.content")}</FormLabel>
            <FormControl>
              <RichTextEditor
                content={field.value || ""}
                onChange={field.onChange}
                placeholder={t("story.contentPlaceholder")}
                disabled={disabled}
                images={images}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="text-sm text-gray-500 dark:text-gray-400" aria-live="polite">
        {t("editor.readingStats", { words: String(words), minutes: String(minutes) })}
      </div>
    </div>
  );
};

export default StoryContent;
