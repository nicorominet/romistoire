import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload } from "lucide-react";
import { i18n } from "@/lib/i18n";

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
      <div className="flex items-center gap-2">
        <Input
          type="file"
          accept="image/*"
          onChange={onImageChange}
          className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 file:bg-story-purple-500 file:border-0 file:text-white file:hover:bg-story-purple-700"
        />
        <Button className="flex items-center gap-1">
          <Upload className="h-4 w-4" />
          {t("story.upload")}
        </Button>
      </div>
    </div>
  );
};

export default IllustrationUpload;
