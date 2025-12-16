import client from './client';

import { Story, PaginationParams, StoryWithIllustrations, StoryVersion } from '../types/Story';
import { PaginatedResponse, ApiResponse } from '../types/Api';
import { Illustration } from '../types/Story';

export const storyApi = {
  getAll: (params: PaginationParams) => client.get<PaginatedResponse<Story>>('/api/stories', { params }),
  getById: (id: string) => client.get<StoryWithIllustrations>(`/api/stories/${id}`),
  getNext: (id: string) => client.get<Story | null>(`/api/stories/${id}/next`),
  getPrevious: async (id: string) => {
    return client.get(`/api/stories/${id}/previous`);
  },
  getNeighbors: async (id: string) => {
    return client.get(`/api/stories/${id}/neighbors`);
  },
  create: async (data: Partial<Story>) => client.post<Story>('/api/stories', data),
  update: (id: string, data: Partial<Story>) => client.put<Story>(`/api/stories/${id}`, data),
  delete: (id: string) => client.delete<ApiResponse<boolean>>(`/api/stories/${id}`),
  getVersions: (id: string) => client.get<StoryVersion[]>(`/api/stories/${id}/versions`),
  restoreVersion: (id: string, versionId: string) => client.post<boolean>(`/api/stories/${id}/versions/${versionId}`),
  deleteIllustration: (id: string, illustrationId: string) => client.delete<string>(`/api/stories/${id}/illustrations/${illustrationId}`),
  generateAI: (data: any) => client.post<Story>('/api/generate/story', data), // schema needed for AI gen
  generateImage: (prompt: string) => client.post<{ imagePath: string }>('/api/generate-image', { prompt }),
  getAvailableWeeks: (params: any) => client.get<number[]>('/api/stories/available-weeks', { params }),
  getIllustrations: (id: string) => client.get<Illustration[]>(`/api/stories/${id}/illustrations`),
};

export const seriesApi = {
  getAll: () => client.get('/api/series'),
  create: (data: any) => client.post('/api/series', data),
  update: (id: string, data: any) => client.put(`/api/series/${id}`, data),
  delete: (id: string) => client.delete(`/api/series/${id}`),
};
