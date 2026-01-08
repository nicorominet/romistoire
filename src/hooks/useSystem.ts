import { useMutation, useQueryClient } from '@tanstack/react-query';
import { systemApi } from '../api/system.api';
import { CleanupResponse } from '../types/system.types';

/**
 * Custom hook to handle System and Data mutations.
 * Provides wrappers around system API calls with React Query integration.
 * 
 * @returns {Object} Object containing mutation hooks for upload, cleanup, reset, and import.
 */
export const useSystemMutations = () => {
    const queryClient = useQueryClient();

    /**
     * Mutation for uploading images.
     */
    const uploadImage = useMutation({
        mutationFn: (formData: FormData) => systemApi.uploadImage(formData),
    });

    /**
     * Mutation for cleaning up unused images.
     */
    const cleanupImages = useMutation({
        mutationFn: () => systemApi.cleanupImages(),
    });

    /**
     * Mutation for factory reset.
     * Invalidates all queries on success to refresh UI.
     */
    const resetData = useMutation({
        mutationFn: () => systemApi.resetData(),
        onSuccess: () => {
             // Invalidate all data to ensure UI reflects the empty state
             queryClient.invalidateQueries();
             queryClient.clear(); // Clear cache explicitly
        }
    });

    /**
     * Mutation for importing data.
     * Invalidates all queries on success to show new data immediately.
     */
    const importData = useMutation({
        mutationFn: (formData: FormData) => systemApi.importData(formData),
        onSuccess: () => {
             // Refresh all queries (stories, themes, etc.)
             queryClient.invalidateQueries();
        }
    });

    // Note: Exports are handled directly via API calls in components 
    // because they result in file downloads (Blob), not state mutations.
    
    return { uploadImage, cleanupImages, resetData, importData };
};
