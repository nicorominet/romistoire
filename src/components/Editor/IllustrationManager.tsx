import React from "react";
import IllustrationList from "./EditStoryPage/IllustrationList";
import { Button } from "@/components/ui/button";
import { i18n } from "@/lib/i18n";

interface IllustrationManagerProps {
  illustrations: any[];
  setIllustrations: (illustrations: any[]) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: (index: number) => Promise<void>;
}

const IllustrationManager: React.FC<IllustrationManagerProps> = ({
  illustrations,
  setIllustrations,
  onImageUpload,
  onDelete,
}) => {
  const { t } = i18n;
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
        {t("story.illustrations")}
      </h3>
      <input
        type="file"
        accept="image/*"
        onChange={onImageUpload}
        className="mb-4"
      />
      <IllustrationList illustrations={illustrations} onDelete={onDelete} />
    </div>
  );
};

export default IllustrationManager;
