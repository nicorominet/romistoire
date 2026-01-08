import { useCallback } from "react";
import { Story, Illustration } from "@/types/Story";
import { toast } from "sonner";
import { storyApi } from "@/api/stories.api";
import { weeklyThemeApi, themeApi } from "@/api/themes.api"; 
import { systemApi } from "@/api/system.api";
import { useStory, useStoryMutations } from "@/hooks/useStory";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface UseStoryDataProps {
  id?: string;
}

interface UseStoryDataResult {
  story: Story | null;
  loading: boolean;
  error: string | null;
  illustrations: Illustration[];
  weeklyThemes: { week_number: number; theme_name: string }[];
  refetch: () => void;
  addIllustrationToBackend: (
    file: File,
    filename?: string,
    fileType?: string
  ) => Promise<void>;
  deleteIllustration: (illustrationId: string) => Promise<void>;
}

const useStoryData = ({ id }: UseStoryDataProps): UseStoryDataResult => {
  const queryClient = useQueryClient();
  
  // Use centralized hooks
  const { data: story, isLoading: storyLoading, error: storyError, refetch: refetchStory } = useStory(id || "");
  
  // No need for separate illustrations query as useStory already hydrates them

  // Weekly themes query
  const { data: weeklyThemes = [], isLoading: themesLoading } = useQuery({
      queryKey: ['weeklyThemes'],
      queryFn: async () => (await weeklyThemeApi.getAll()) as any,
  });

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
      toast.error("Story ID is missing.");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("storyId", id);
      formData.append("position", String(story?.illustrations?.length || 0));
      
      const res = (await systemApi.uploadImage(formData)) as any;
      const { imagePath, filename: savedFilename } = res;
      
      // Invalidate story to refresh illustrations
      queryClient.invalidateQueries({ queryKey: ['story', id] });
      
      toast.success("Illustration added successfully.");
    } catch (err) {
      toast.error("Failed to add illustration.");
      console.error("Error adding illustration:", err);
    }
  };

  const deleteIllustration = async (illustrationId: string) => {
    if (!id) return;
    try {
        await deleteIllustrationMutation.mutateAsync({ id, illustrationId });
        // Mutation onSuccess already invalidates queries, but ensuring story is refreshed
        queryClient.invalidateQueries({ queryKey: ['story', id] });
        toast.success("Illustration deleted successfully");
    } catch(err) {
         toast.error("Failed to delete illustration.");
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
  };
};

export default useStoryData;

