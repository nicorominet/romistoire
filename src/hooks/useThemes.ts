import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient, QueryClient, keepPreviousData } from '@tanstack/react-query';
import { themeApi, weeklyThemeApi } from '../api/themes.api';
import { ThemeFilters, ThemeInput } from '@/types/Theme';

/** Query keys of the theme module. */
export const themeKeys = {
  all: ['themes'] as const,
  list: (filters: ThemeFilters = {}) => ['themes', 'list', filters] as const,
  duplicates: ['themes', 'duplicates'] as const,
  weekly: ['weeklyThemes'] as const,
};

/**
 * A theme change shows up on every story badge, filter and week: refresh them all.
 */
const invalidateThemeData = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: themeKeys.all });
  queryClient.invalidateQueries({ queryKey: themeKeys.weekly });
  queryClient.invalidateQueries({ queryKey: ['stories'] });
  queryClient.invalidateQueries({ queryKey: ['story'] });
};

/** Value updated after `delay` ms without change (search inputs). */
export const useDebouncedValue = <T,>(value: T, delay = 300): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};

/** All themes (cached), or a filtered list. */
export const useThemes = (filters: ThemeFilters = {}) => {
  return useQuery({
    queryKey: themeKeys.list(filters),
    queryFn: async () => await themeApi.getAll(filters),
    placeholderData: keepPreviousData,
  });
};

export const useThemeDuplicates = (enabled = true) => {
  return useQuery({
    queryKey: themeKeys.duplicates,
    queryFn: async () => await themeApi.getDuplicates(),
    enabled,
  });
};

export const useThemeMutations = () => {
  const queryClient = useQueryClient();
  const onSuccess = () => invalidateThemeData(queryClient);

  const createTheme = useMutation({
    mutationFn: async (data: ThemeInput) => await themeApi.create(data),
    onSuccess,
  });

  const updateTheme = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ThemeInput> }) => await themeApi.update(id, data),
    onSuccess,
  });

  const deleteTheme = useMutation({
    mutationFn: async ({ id, reassignTo }: { id: string; reassignTo?: string }) => await themeApi.delete(id, reassignTo),
    onSuccess,
  });

  const mergeThemes = useMutation({
    mutationFn: async ({ sourceIds, targetId }: { sourceIds: string[]; targetId: string }) => await themeApi.merge(sourceIds, targetId),
    onSuccess,
  });

  return { createTheme, updateTheme, deleteTheme, mergeThemes };
};

export const useWeeklyThemes = () => {
  return useQuery({
    queryKey: themeKeys.weekly,
    queryFn: async () => await weeklyThemeApi.getAll(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useWeeklyThemeMutations = () => {
  const queryClient = useQueryClient();
  const onSuccess = () => invalidateThemeData(queryClient);

  const setWeekTheme = useMutation({
    mutationFn: async ({ weekNumber, themeId, themeName }: { weekNumber: number; themeId?: string; themeName?: string }) =>
      await weeklyThemeApi.setWeek(weekNumber, { themeId, themeName }),
    onSuccess,
  });

  const clearWeekTheme = useMutation({
    mutationFn: async (weekNumber: number) => await weeklyThemeApi.clearWeek(weekNumber),
    onSuccess,
  });

  return { setWeekTheme, clearWeekTheme };
};
