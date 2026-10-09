import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../api/settings.api';
import { AppSettingsUpdate } from '../types/system.types';

export const SETTINGS_QUERY_KEY = ['app-settings'];
export const STORAGE_STATS_QUERY_KEY = ['storage-stats'];
export const BACKUPS_QUERY_KEY = ['backups'];

/**
 * Server-side settings (AI generation, storage), shared by the settings page and the create page.
 *
 * @returns {Object} The settings query and the `update` mutation (the cache is replaced by the answer).
 */
export const useAppSettings = () => {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: SETTINGS_QUERY_KEY,
        queryFn: () => settingsApi.get(),
    });

    const update = useMutation({
        mutationFn: (values: AppSettingsUpdate) => settingsApi.update(values),
        onSuccess: (data) => queryClient.setQueryData(SETTINGS_QUERY_KEY, data),
    });

    return { ...query, update };
};

/**
 * Backups list and storage dashboard, with the backup actions.
 */
export const useBackups = () => {
    const queryClient = useQueryClient();
    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: BACKUPS_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: STORAGE_STATS_QUERY_KEY });
    };

    const backups = useQuery({ queryKey: BACKUPS_QUERY_KEY, queryFn: () => settingsApi.listBackups() });
    const stats = useQuery({ queryKey: STORAGE_STATS_QUERY_KEY, queryFn: () => settingsApi.getStorageStats() });

    const runBackup = useMutation({ mutationFn: () => settingsApi.runBackup(), onSuccess: refresh });
    const deleteBackup = useMutation({ mutationFn: (filename: string) => settingsApi.deleteBackup(filename), onSuccess: refresh });
    const clearDebugLog = useMutation({ mutationFn: () => settingsApi.clearDebugLog(), onSuccess: refresh });

    return { backups, stats, runBackup, deleteBackup, clearDebugLog };
};
