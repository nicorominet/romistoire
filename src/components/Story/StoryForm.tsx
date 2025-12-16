import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { i18n } from "@/lib/i18n";

interface StoryFormProps {
  title: string;
  setTitle: (v: string) => void;
  content: string;
  setContent: (v: string) => void;
}

const StoryForm: React.FC<StoryFormProps> = ({ title, setTitle, content, setContent }) => {
  const { t } = i18n;
  return (
    <div className="space-y-4">
      <div>
        <Label>{t("story.title")}</Label>
        <Input value={title} onChange={e => setTitle(e.target.value)} />
      </div>
      <div>
        <Label>{t("story.content")}</Label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          className="w-full min-h-[120px] border rounded p-2"
        />
      </div>
    </div>
  );
};

export default StoryForm;
