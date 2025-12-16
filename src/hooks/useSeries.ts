import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { seriesApi } from '../api/stories.api';

export const useSeries = () => {
  return useQuery({
    queryKey: ['series'],
    queryFn: async () => (await seriesApi.getAll()) as any,
  });
};

export const useSeriesMutations = () => {
    const queryClient = useQueryClient();

    const createSeries = useMutation({
        mutationFn: async (data: any) => (await seriesApi.create(data)) as any,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['series'] })
    });

    const updateSeries = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: any }) => (await seriesApi.update(id, data)) as any,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['series'] })
    });

    const deleteSeries = useMutation({
        mutationFn: async (id: string) => (await seriesApi.delete(id)) as any,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['series'] })
    });

    return { createSeries, updateSeries, deleteSeries };
};
