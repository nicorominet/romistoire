import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Trash } from "lucide-react";
import { i18n } from "@/lib/i18n";
import { Illustration } from "@/types/Story";
import SafeImage from "@/components/ui/SafeImage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface IllustrationListProps {
  illustrations: Illustration[];
  onDelete: (index: number) => Promise<void>;
  /** Moves the illustration at index one step (-1 = before, 1 = after). Hidden when not provided. */
  onMove?: (index: number, direction: -1 | 1) => void;
}

const IllustrationList = ({ illustrations, onDelete, onMove }: IllustrationListProps) => {
  const { t } = i18n;

  return (
    <div>
      {illustrations.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
            {t("story.savedIllustrations")} ({illustrations.length})
          </h3>
          {onMove && illustrations.length > 1 && (
            <p className="text-xs text-muted-foreground mb-2">{t("story.coverIllustrationHint")}</p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {illustrations.map((img, index) => (
              <div
                key={img.id || index}
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
                {onMove && illustrations.length > 1 && (
                  <div className="absolute top-2 left-2 flex gap-1">
                    <Button type="button"
                      onClick={() => onMove(index, -1)}
                      disabled={index === 0}
                      variant="outline"
                      size="sm"
                      title={t("story.moveIllustrationBefore")}
                      aria-label={t("story.moveIllustrationBefore")}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button type="button"
                      onClick={() => onMove(index, 1)}
                      disabled={index === illustrations.length - 1}
                      variant="outline"
                      size="sm"
                      title={t("story.moveIllustrationAfter")}
                      aria-label={t("story.moveIllustrationAfter")}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button"
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2"
                      aria-label={t("common.delete")}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("story.deleteIllustrationTitle")}</AlertDialogTitle>
                      <AlertDialogDescription>{t("story.deleteIllustrationDesc")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete(index)} className="bg-red-600 hover:bg-red-700">
                        {t("common.delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default IllustrationList;
