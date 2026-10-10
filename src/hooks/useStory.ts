import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storyApi, storyReviewApi } from '../api/stories.api';
import { AudioSettings } from '../types/system.types';

export const useStory = (id: string) => {
  return useQuery({
    queryKey: ['story', id],
    queryFn: async () => (await storyApi.getById(id)) as any,
    enabled: !!id,
    staleTime: 0,
    gcTime: 0,
  });
};

export const useStoryNeighbors = (id: string) => {
    const { data, isLoading, error } = useQuery({ 
        queryKey: ['story', id, 'neighbors'], 
        queryFn: async () => (await storyApi.getNeighbors(id)) as any, 
        enabled: !!id 
    });
    
    return { data, isLoading, error };
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

    const generateAudio = useMutation({
        mutationFn: async ({ id, voice }: { id: string; voice?: Partial<AudioSettings> }) => (await storyApi.generateAudio(id, voice)) as any,
        onSuccess: (data, { id }) => {
             queryClient.invalidateQueries({ queryKey: ['story', id] });
             // One TTS request spent (10 a day per model)
             queryClient.invalidateQueries({ queryKey: ['quota-usage'] });
        }
    });

    const validateStory = useMutation({
        mutationFn: (id: string) => storyReviewApi.setReviewStatus([id], 'validated'),
        onSuccess: (data, id) => {
             queryClient.invalidateQueries({ queryKey: ['story', id] });
             queryClient.invalidateQueries({ queryKey: ['stories'] });
        }
    });

    return { createStory, updateStory, deleteStory, restoreVersion, deleteIllustration, generateAudio, validateStory };
};
