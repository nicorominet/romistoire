import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storyApi } from '../api/stories.api';

export const useStory = (id: string) => {
  return useQuery({
    queryKey: ['story', id],
    queryFn: async () => (await storyApi.getById(id)) as any,
    enabled: !!id,
  });
};

export const useStoryNeighbors = (id: string) => {
    // Parallel queries
    const next = useQuery({ queryKey: ['story', id, 'next'], queryFn: async () => (await storyApi.getNext(id)) as any, enabled: !!id });
    const prev = useQuery({ queryKey: ['story', id, 'prev'], queryFn: async () => (await storyApi.getPrevious(id)) as any, enabled: !!id });
    return { next, prev };
};


export const useStoryMutations = () => {
    const queryClient = useQueryClient();

    const createStory = useMutation({
        mutationFn: async (data: any) => (await storyApi.create(data)) as any,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stories'] })
    });

    const updateStory = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: any }) => (await storyApi.update(id, data)) as any,
        onSuccess: (data, variables) => {
             queryClient.invalidateQueries({ queryKey: ['stories'] });
             queryClient.invalidateQueries({ queryKey: ['story', variables.id] });
        }
    });

    const deleteStory = useMutation({
        mutationFn: async (id: string) => (await storyApi.delete(id)) as any,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stories'] })
    });

    const generateAI = useMutation({
        mutationFn: async (data: any) => (await storyApi.generateAI(data)) as any,
    });
    
    const restoreVersion = useMutation({
        mutationFn: async ({ id, versionId }: { id: string, versionId: string }) => (await storyApi.restoreVersion(id, versionId)) as any,
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['story', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['storyVersions', variables.id] });
        }
    });

    const deleteIllustration = useMutation({
        mutationFn: async ({ id, illustrationId }: { id: string, illustrationId: string }) => (await storyApi.deleteIllustration(id, illustrationId)) as any,
        onSuccess: (data, variables) => {
             queryClient.invalidateQueries({ queryKey: ['story', variables.id] });
        }
    });

    return { createStory, updateStory, deleteStory, generateAI, restoreVersion, deleteIllustration };
};


export const useStoryVersions = (id: string) => {
    return useQuery({
        queryKey: ['storyVersions', id],
        queryFn: async () => (await storyApi.getVersions(id)) as any,
        enabled: !!id
    });
};
