import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, ImagePlus, Loader2, Palette, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { i18n } from "@/lib/i18n";
import { getApiError } from "@/lib/apiError";
import { APP_ROUTES } from "@/constants";
import { illustrationApi } from "@/api/illustrations.api";

interface IllustrationPromptCardProps {
  prompt?: string | null;
  /** With the story id: link to the illustration workshop, and "Create the prompt" when there is none. */
  storyId?: string;
}

/**
 * Shows the AI-suggested illustration description with a copy button.
 */
const IllustrationPromptCard = ({ prompt, storyId }: IllustrationPromptCardProps) => {
  const { t } = i18n;
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  if (!prompt && !storyId) return null;

  const handleCopy = async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success(t("story.promptCopied"));
    } catch (error) {
      console.error("Error copying illustration prompt:", error);
    }
  };

  const handleCreate = async () => {
    if (!storyId) return;
    setCreating(true);
    try {
      await illustrationApi.generatePrompt(storyId);
      await queryClient.invalidateQueries({ queryKey: ["story", storyId] });
    } catch (error) {
      toast.error(t("illustrations.promptError"), { description: getApiError(error).message });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/40 p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
          <Palette className="h-4 w-4" />
          {t("story.illustrationPrompt")}
        </h3>
        <div className="flex flex-wrap gap-2">
          {prompt ? (
            <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="flex items-center gap-1">
              <Copy className="h-4 w-4" />
              {t("story.copyPrompt")}
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={handleCreate} disabled={creating} className="flex items-center gap-1">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {t("illustrations.createPrompt")}
            </Button>
          )}
          {storyId && (
            <Button type="button" variant="outline" size="sm" asChild>
              <Link to={APP_ROUTES.ILLUSTRATIONS} className="flex items-center gap-1">
                <ImagePlus className="h-4 w-4" />
                {t("illustrations.openWorkshop")}
              </Link>
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{prompt ? t("story.illustrationPromptHint") : t("illustrations.noPromptHint")}</p>
      {prompt && <p className="whitespace-pre-line text-sm italic text-gray-700 dark:text-gray-300">{prompt}</p>}
    </div>
  );
};

export default IllustrationPromptCard;
