import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { themeApi, weeklyThemeApi } from '../api/themes.api';
import { Theme } from '@/types/Theme';

export const useThemes = (params?: any) => {
  return useQuery({
    queryKey: ['themes', params],
    queryFn: async () => await themeApi.getAll(params),
  });
};

export const useThemeMutations = () => {
    const queryClient = useQueryClient();

    const createTheme = useMutation({
        mutationFn: async (data: Partial<Theme>) => await themeApi.create(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['themes'] })
    });

    const updateTheme = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: Partial<Theme> }) => await themeApi.update(id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['themes'] })
    });

    const deleteTheme = useMutation({
        mutationFn: async (id: string) => await themeApi.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['themes'] })
    });

    const mergeDuplicates = useMutation({
        mutationFn: async () => await themeApi.mergeDuplicates(),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['themes'] })
    });
    
    const updateStoriesTheme = useMutation({
        mutationFn: async ({ themeId, newThemeId }: { themeId: string, newThemeId: string }) => (await themeApi.updateStoriesTheme(themeId, newThemeId)) as any,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['themes'] });
            queryClient.invalidateQueries({ queryKey: ['stories'] });
        }
    });

    return { createTheme, updateTheme, deleteTheme, mergeDuplicates, updateStoriesTheme };
};

export const useWeeklyThemes = () => {
    return useQuery({
        queryKey: ['weeklyThemes'],
        queryFn: async () => (await weeklyThemeApi.getAll()) as any,
    });
};

export const useWeeklyThemeMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (themes: any[]) => (await weeklyThemeApi.update(themes)) as any,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['weeklyThemes'] })
    });
};

export const useWeeklyTheme = (weekNumber: number) => {
    return useQuery({
        queryKey: ['weeklyThemes', weekNumber],
        queryFn: async () => await weeklyThemeApi.getOne(weekNumber),
        enabled: !!weekNumber
    });
};
