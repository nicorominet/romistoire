import { Input } from "@/components/ui/input";
import { i18n } from "@/lib/i18n";
import { ACCEPTED_IMAGE_TYPES } from "@/constants";

interface IllustrationUploadProps {
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

const IllustrationUpload = ({ onImageChange }: IllustrationUploadProps) => {
  const { t } = i18n;

  return (
    <div className="mt-6 border-t pt-4">
      <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
        {t("story.uploadImage")}
      </h3>
      {/* The upload starts as soon as a file is picked */}
      <Input
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        onChange={onImageChange}
        className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 file:bg-story-purple-500 file:border-0 file:text-white file:hover:bg-story-purple-700"
      />
    </div>
  );
};

export default IllustrationUpload;
