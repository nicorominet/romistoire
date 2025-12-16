import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { storyApi } from '../api/stories.api';

export const useStories = (params: any = {}, options: any = {}) => {
  return useQuery({
    queryKey: ['stories', params],
    queryFn: async () => await storyApi.getAll(params),
    placeholderData: (previousData) => previousData,
    ...options
  });
};

export const useInfiniteStories = (params: any = {}) => {
    return useInfiniteQuery({
        queryKey: ['stories-infinite', params],
        // params contains filters. page is handled by getNextPageParam
        // We override page in queryFn
        queryFn: async ({ pageParam = 1 }) => await storyApi.getAll({ ...params, page: pageParam as number }),
        getNextPageParam: (lastPage: any) => {
            const totalPages = Math.ceil(lastPage.total / lastPage.limit);
            // Ensure we treat page as a number
            const currentPage = parseInt(lastPage.page, 10);
            
            if (currentPage < totalPages) {
                return currentPage + 1;
            }
            return undefined;
        },
        initialPageParam: 1
    });
};
