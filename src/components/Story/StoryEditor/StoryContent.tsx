import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import RichTextEditor from "@/components/Common/RichTextEditor";
import { i18n } from "@/lib/i18n";
import { stripHtmlTags } from "@/lib/utils";

const StoryContent = () => {
  const { t } = i18n;
  const { control, watch } = useFormContext();
  const content = watch("content");
  const plainTextContent = stripHtmlTags(content || "");

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
                className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-white/20 dark:border-white/10 text-gray-900 dark:text-gray-100"
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
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="text-sm text-gray-500 dark:text-gray-400">
        {t("story.characterCount", { count: plainTextContent.length })}
      </div>
    </div>
  );
};

export default StoryContent;
