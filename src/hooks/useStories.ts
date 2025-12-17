import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { storyApi } from '../api/stories.api';

import { Story } from '../types/Story';
import { PaginatedResponse } from '../types/Api';

/**
 * Hook to fetch a paginated list of stories.
 * 
 * @param {Object} params - The query parameters for the API call (page, limit, filters).
 * @param {Object} options - Additional options for the useQuery hook.
 * @returns {UseQueryResult<PaginatedResponse<Story>>} The query result containing the paginated stories.
 */
export const useStories = (params: any = {}, options: any = {}) => {
  return useQuery<PaginatedResponse<Story>>({
    queryKey: ['stories', params],
    queryFn: async () => await storyApi.getAll(params),
    placeholderData: (previousData) => previousData,
    ...options
  });
};

/**
 * Hook to fetch stories with infinite scrolling support.
 * 
 * @param {Object} params - The initial query parameters (filters, limit).
 * @returns {UseInfiniteQueryResult<PaginatedResponse<Story>>} The infinite query result.
 */
export const useInfiniteStories = (params: any = {}) => {
    return useInfiniteQuery<PaginatedResponse<Story>>({
        queryKey: ['stories-infinite', params],
        // params contains filters. page is handled by getNextPageParam
        // We override page in queryFn
        queryFn: async ({ pageParam = 1 }) => await storyApi.getAll({ ...params, page: pageParam as number }),
        getNextPageParam: (lastPage) => {
            const totalPages = Math.ceil(lastPage.total / lastPage.limit);
            const currentPage = Number(lastPage.page);
            
            if (currentPage < totalPages) {
                return currentPage + 1;
            }
            return undefined;
        },
        initialPageParam: 1
    });
};
