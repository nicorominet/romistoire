import { Copy, Palette } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { i18n } from "@/lib/i18n";

interface IllustrationPromptCardProps {
  prompt?: string | null;
}

/**
 * Shows the AI-suggested illustration description with a copy button.
 */
const IllustrationPromptCard = ({ prompt }: IllustrationPromptCardProps) => {
  const { t } = i18n;
  if (!prompt) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success(t("story.promptCopied"));
    } catch (error) {
      console.error("Error copying illustration prompt:", error);
    }
  };

  return (
    <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/40 p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
          <Palette className="h-4 w-4" />
          {t("story.illustrationPrompt")}
        </h3>
        <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="flex items-center gap-1">
          <Copy className="h-4 w-4" />
          {t("story.copyPrompt")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("story.illustrationPromptHint")}</p>
      <p className="whitespace-pre-line text-sm italic text-gray-700 dark:text-gray-300">{prompt}</p>
    </div>
  );
};

export default IllustrationPromptCard;
