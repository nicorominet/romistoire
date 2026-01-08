import client from './client';
import { API_ENDPOINTS } from '@/constants';
import { Story, PaginationParams, StoryWithIllustrations, StoryVersion } from '../types/Story';
import { PaginatedResponse, ApiResponse } from '../types/Api';
import { Illustration } from '../types/Story';

export const storyApi = {
  /**
   * Fetch all stories with pagination.
   * @param {PaginationParams} params - Pagination and filter parameters.
   * @returns {Promise<PaginatedResponse<Story>>} Paginated list of stories.
   */
  getAll: (params: PaginationParams) => client.get<PaginatedResponse<Story>>(API_ENDPOINTS.STORIES, { params }),

  /**
   * Fetch a single story by ID.
   * @param {string} id - The ID of the story.
   * @returns {Promise<StoryWithIllustrations>} The story object including illustrations.
   */
  getById: (id: string) => client.get<StoryWithIllustrations>(`${API_ENDPOINTS.STORIES}/${id}`),

  /**
   * Fetch the next story in the sequence.
   * @param {string} id - The ID of the current story.
   * @returns {Promise<Story | null>} The next story or null if none exists.
   */
  getNext: (id: string) => client.get<Story | null>(`${API_ENDPOINTS.STORIES}/${id}/next`),

  /**
   * Fetch the previous story in the sequence.
   * @param {string} id - The ID of the current story.
   * @returns {Promise<Story | null>} The previous story or null.
   */
  getPrevious: async (id: string) => {
    return client.get(`${API_ENDPOINTS.STORIES}/${id}/previous`);
  },

  /**
   * Fetch both next and previous stories.
   * @param {string} id - The ID of the current story.
   * @returns {Promise<{prev: Story | null, next: Story | null}>} Object containing neighbor stories.
   */
  getNeighbors: async (id: string) => {
    return client.get(`${API_ENDPOINTS.STORIES}/${id}/neighbors`);
  },

  /**
   * Create a new story.
   * @param {Partial<Story>} data - The story data to create.
   * @returns {Promise<Story>} The created story.
   */
  create: async (data: Partial<Story>) => client.post<Story>(API_ENDPOINTS.STORIES, data),

  /**
   * Update an existing story.
   * @param {string} id - The ID of the story to update.
   * @param {Partial<Story>} data - The updated story data.
   * @returns {Promise<Story>} The updated story.
   */
  update: (id: string, data: Partial<Story>) => client.put<Story>(`${API_ENDPOINTS.STORIES}/${id}`, data),

  /**
   * Delete a story.
   * @param {string} id - The ID of the story to delete.
   * @returns {Promise<ApiResponse<boolean>>} Success response.
   */
  delete: (id: string) => client.delete<ApiResponse<boolean>>(`${API_ENDPOINTS.STORIES}/${id}`),

  /**
   * Get version history of a story.
   * @param {string} id - The ID of the story.
   * @returns {Promise<StoryVersion[]>} List of story versions.
   */
  getVersions: (id: string) => client.get<StoryVersion[]>(`${API_ENDPOINTS.STORIES}/${id}/versions`),

  /**
   * Restore a specific version of a story.
   * @param {string} id - The ID of the story.
   * @param {string} versionId - The ID of the version to restore.
   * @returns {Promise<boolean>} Success status.
   */
  restoreVersion: (id: string, versionId: string) => client.post<boolean>(`${API_ENDPOINTS.STORIES}/${id}/versions/${versionId}`),

  /**
   * Delete a specific illustration from a story.
   * @param {string} id - The ID of the story.
   * @param {string} illustrationId - The ID of the illustration to delete.
   * @returns {Promise<string>} Success message or ID.
   */
  deleteIllustration: (id: string, illustrationId: string) => client.delete<string>(`${API_ENDPOINTS.STORIES}/${id}/illustrations/${illustrationId}`),

  /**
   * Generate audio for a story.
   * @param {string} id - The ID of the story.
   * @returns {Promise<any>} The generated audio data or confirmation.
   */
  generateAudio: async (id: string) => {
      const response = await client.post(`${API_ENDPOINTS.STORIES}/${id}/audio`);
      return response.data;
  },

  /**
   * Generate a story using AI.
   * @param {any} data - Parameters for generation (theme, age group, etc.).
   * @returns {Promise<Story>} The generated story.
   */
  generateAI: (data: any) => client.post<Story>(`${API_ENDPOINTS.GENERATE}/story`, data),


  /**
   * Get available week numbers that have created stories.
   * @param {any} params - Query parameters (e.g., locale).
   * @returns {Promise<number[]>} List of week numbers.
   */
  getAvailableWeeks: (params: any) => client.get<number[]>(`${API_ENDPOINTS.STORIES}/available-weeks`, { params }),

  /**
   * Get all illustrations associated with a story.
   * @param {string} id - The ID of the story.
   * @returns {Promise<Illustration[]>} List of illustrations.
   */
  getIllustrations: (id: string) => client.get<Illustration[]>(`${API_ENDPOINTS.STORIES}/${id}/illustrations`),
};

export const seriesApi = {
  /**
   * Fetch all series.
   * @returns {Promise<Series[]>} List of all series.
   */
  getAll: () => client.get(API_ENDPOINTS.SERIES),

  /**
   * Get statistics for a specific series.
   * @param {string} id - The ID of the series.
   * @returns {Promise<{ stories: any[] }>} Series statistics and stories.
   */
  getStats: (id: string) => client.get<{ stories: any[] }>(`${API_ENDPOINTS.SERIES}/${id}/stats`),

  /**
   * Create a new series.
   * @param {any} data - The series data.
   * @returns {Promise<Series>} The created series.
   */
  create: (data: any) => client.post(API_ENDPOINTS.SERIES, data),

  /**
   * Update an existing series.
   * @param {string} id - The ID of the series.
   * @param {any} data - The updated data.
   * @returns {Promise<Series>} The updated series.
   */
  update: (id: string, data: any) => client.put(`${API_ENDPOINTS.SERIES}/${id}`, data),

  /**
   * Delete a series.
   * @param {string} id - The ID of the series.
   * @returns {Promise<void>}
   */
  delete: (id: string) => client.delete(`${API_ENDPOINTS.SERIES}/${id}`),

  /**
   * Add multiple stories to a series.
   * @param {string} id - The ID of the series.
   * @param {string[]} storyIds - The IDs of the stories to add.
   * @returns {Promise<void>}
   */
  addBatchStories: (id: string, storyIds: string[]) => client.post(API_ENDPOINTS.SERIES_STORIES_BATCH.replace(':id', id), { storyIds, action: 'add' }),

  /**
   * Remove multiple stories from a series.
   * @param {string} id - The ID of the series.
   * @param {string[]} storyIds - The IDs of the stories to remove.
   * @returns {Promise<void>}
   */
  removeBatchStories: (id: string, storyIds: string[]) => client.post(API_ENDPOINTS.SERIES_STORIES_BATCH.replace(':id', id), { storyIds, action: 'remove' }),
};
