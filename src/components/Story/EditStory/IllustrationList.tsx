import { Button } from "@/components/ui/button";
import { Trash } from "lucide-react";
import { i18n } from "@/lib/i18n";
import { Illustration } from "@/types/Story";
import SafeImage from "@/components/ui/SafeImage";

interface IllustrationListProps {
  illustrations: Illustration[];
  onDelete: (index: number) => Promise<void>;
}

const IllustrationList = ({ illustrations, onDelete }: IllustrationListProps) => {
  const { t } = i18n;

  return (
    <div>
      {illustrations.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
            {t("story.savedIllustrations")} ({illustrations.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {illustrations.map((img, index) => (
              <div
                key={index}
                className="border rounded-md overflow-hidden bg-white dark:bg-gray-700 relative"
              >
                <SafeImage
                  src={img.image_path ? `/${img.image_path.replace(/\\/g, '/')}` : undefined}
                  alt={`Illustration ${index + 1}${img.filename ? ` - ${img.filename}` : ""}`}
                  className="w-full h-auto"
                />
                <div className="p-2 text-xs text-gray-500 dark:text-gray-400 truncate">
                  {img.filename || `Image ${index + 1}`}
                </div>
                <Button
                  onClick={() => onDelete(index)}
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default IllustrationList;
