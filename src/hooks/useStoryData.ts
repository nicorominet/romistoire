import { useCallback } from "react";
import { Story, Illustration } from "@/types/Story";
import { toast } from "sonner";
import { i18n } from "@/lib/i18n";
import { storyApi } from "@/api/stories.api";
import { systemApi } from "@/api/system.api";
import { useStory, useStoryMutations } from "@/hooks/useStory";
import { useWeeklyThemes } from "@/hooks/useThemes";
import { WeeklyTheme } from "@/types/Theme";
import { useQueryClient } from "@tanstack/react-query";

interface UseStoryDataProps {
  id?: string;
}

interface UseStoryDataResult {
  story: Story | null;
  loading: boolean;
  error: string | null;
  illustrations: Illustration[];
  weeklyThemes: WeeklyTheme[];
  refetch: () => void;
  addIllustrationToBackend: (
    file: File,
    filename?: string,
    fileType?: string
  ) => Promise<void>;
  deleteIllustration: (illustrationId: string) => Promise<void>;
  reorderIllustrations: (orderedIds: string[]) => Promise<void>;
}

const useStoryData = ({ id }: UseStoryDataProps): UseStoryDataResult => {
  const queryClient = useQueryClient();
  
  // Use centralized hooks
  const { data: story, isLoading: storyLoading, error: storyError, refetch: refetchStory } = useStory(id || "");
  
  // No need for separate illustrations query as useStory already hydrates them

  // Weekly themes (shared query of the theme module)
  const { data: weeklyThemes = [], isLoading: themesLoading } = useWeeklyThemes();

  const { deleteIllustration: deleteIllustrationMutation } = useStoryMutations();

  const refetch = useCallback(() => {
    refetchStory();
  }, [refetchStory]);

  const addIllustrationToBackend = async (
    file: File,
    filename?: string,
    fileType?: string
  ) => {
    if (!id) {
      toast.error(i18n.t("create.illustrate.error.missingStory"));
      return;
    }
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("storyId", id);
      formData.append("position", String(story?.illustrations?.length || 0));
      
      await systemApi.uploadImage(formData);
      
      // Invalidate story to refresh illustrations
      queryClient.invalidateQueries({ queryKey: ['story', id] });
      
      toast.success(i18n.t("create.illustrate.success.imageUploaded"));
    } catch (err) {
      toast.error((err as any)?.response?.data?.error || i18n.t("create.error.failedToUploadImage"));
      console.error("Error adding illustration:", err);
    }
  };

  const deleteIllustration = async (illustrationId: string) => {
    if (!id) return;
    try {
        await deleteIllustrationMutation.mutateAsync({ id, illustrationId });
        // Mutation onSuccess already invalidates queries, but ensuring story is refreshed
        queryClient.invalidateQueries({ queryKey: ['story', id] });
        toast.success(i18n.t("create.illustrate.success.imageDeleted"));
    } catch(err) {
         toast.error(i18n.t("create.illustrate.error.deleteFailed"));
    }
  };

  const reorderIllustrations = async (orderedIds: string[]) => {
    if (!id) return;
    try {
      await storyApi.reorderIllustrations(id, orderedIds);
      queryClient.invalidateQueries({ queryKey: ['story', id] });
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    } catch (err) {
      toast.error(i18n.t("create.illustrate.error.reorderFailed"));
    }
  };

  return {
    story: story || null,
    loading: storyLoading || themesLoading,
    error: storyError ? (storyError as Error).message : null,
    illustrations: story?.illustrations || [],
    weeklyThemes,
    refetch,
    addIllustrationToBackend,
    deleteIllustration,
    reorderIllustrations,
  };
};

export default useStoryData;

