import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { seriesApi } from '../api/stories.api';
import { Series } from '@/types/Series';

export interface SeriesStats {
    stories: any[]; // Ideally strict typed Story[], assuming structure matches
}

export const useSeries = () => {
  return useQuery<Series[]>({
    queryKey: ['series'],
    queryFn: async () => await seriesApi.getAll(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useSeriesStats = (id: string | null) => {
    return useQuery<SeriesStats | null>({
        queryKey: ['series-stats', id],
        queryFn: async () => {
             if (!id) return null;
             return await seriesApi.getStats(id);
        },
        enabled: !!id,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

export const useSeriesMutations = () => {
    const queryClient = useQueryClient();

    const createSeries = useMutation({
        mutationFn: async (data: Partial<Series>) => await seriesApi.create(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['series'] })
    });

    const updateSeries = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: Partial<Series> }) => await seriesApi.update(id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['series'] })
    });

    const deleteSeries = useMutation({
        mutationFn: async (id: string) => await seriesApi.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['series'] })
    });

    return { createSeries, updateSeries, deleteSeries };
};
