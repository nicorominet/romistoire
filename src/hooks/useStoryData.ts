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
  
  // Illustrations separate query (since getDetails might not include them or we want parity with old hook)
  const { data: illustrations = [], isLoading: illusLoading, refetch: refetchIllus } = useQuery({
      queryKey: ['story', id, 'illustrations'],
      queryFn: async () => id ? (await storyApi.getIllustrations(id)) as unknown as Illustration[] : [],
      enabled: !!id
  });

  // Weekly themes query
  const { data: weeklyThemes = [], isLoading: themesLoading } = useQuery({
      queryKey: ['weeklyThemes'],
      queryFn: async () => (await weeklyThemeApi.getAll()) as any,
  });

  const { deleteIllustration: deleteIllustrationMutation } = useStoryMutations();

  const refetch = useCallback(() => {
    refetchStory();
    refetchIllus();
  }, [refetchStory, refetchIllus]);

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
      formData.append("position", String(illustrations.length));
      
      const res = (await systemApi.uploadImage(formData)) as any;
      const { imagePath, filename: savedFilename } = res;
      
      // We could use optimistic update here, but for now invalidate queries
      queryClient.invalidateQueries({ queryKey: ['story', id, 'illustrations'] });
      
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
        // Mutation onSuccess already invalidates queries, but ensuring illustration list is refreshed
        queryClient.invalidateQueries({ queryKey: ['story', id, 'illustrations'] });
        toast.success("Illustration deleted successfully");
    } catch(err) {
         toast.error("Failed to delete illustration.");
    }
  };

  return {
    story: story || null,
    loading: storyLoading || illusLoading || themesLoading,
    error: storyError ? (storyError as Error).message : null,
    illustrations,
    weeklyThemes,
    refetch,
    addIllustrationToBackend,
    deleteIllustration,
  };
};

export default useStoryData;

