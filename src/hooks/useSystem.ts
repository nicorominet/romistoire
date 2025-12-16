import { useMutation, useQueryClient } from '@tanstack/react-query';
import { systemApi } from '../api/system.api';
import client from '../api/client';

export const useSystemMutations = () => {
    const queryClient = useQueryClient();

    const uploadImage = useMutation({
        mutationFn: async (formData: FormData) => (await systemApi.uploadImage(formData)) as any,
    });

    const cleanupImages = useMutation({
        mutationFn: async () => (await systemApi.cleanupImages()) as any,
    });

    const resetData = useMutation({
        mutationFn: async () => (await systemApi.resetData()) as any,
        onSuccess: () => {
             queryClient.invalidateQueries();
        }
    });

    const importData = useMutation({
        mutationFn: async (formData: FormData) => (await systemApi.importData(formData)) as any,
        onSuccess: () => {
             queryClient.invalidateQueries();
        }
    });

    // Export is usually a direct download, not a mutation state we track same way, but consistent API helps.
    // For PDF/ZIP download, we might handle it in component with api call to get blob.
    
    return { uploadImage, cleanupImages, resetData, importData };
};
