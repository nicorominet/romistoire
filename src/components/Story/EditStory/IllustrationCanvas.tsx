import SimpleDrawingCanvas from "@/components/Editor/SimpleDrawingCanvas";
import { i18n } from "@/lib/i18n";

interface IllustrationCanvasProps {
  onSave: (dataURL: string) => Promise<void>;
}

const IllustrationCanvas = ({ onSave }: IllustrationCanvasProps) => {
  const { t } = i18n;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {t("story.createIllustration")}
      </h3>
      <SimpleDrawingCanvas onSave={onSave} />
    </div>
  );
};

export default IllustrationCanvas;
