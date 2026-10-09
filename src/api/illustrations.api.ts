import client from './client';
import { API_ENDPOINTS } from '@/constants';
import { systemApi } from './system.api';

/** Story waiting for (or holding) an illustration, as listed by the workshop. */
export interface IllustrationTodo {
  id: string;
  title: string;
  week_number: number | null;
  day_order: number;
  age_group: string;
  series_id: string | null;
  /** Description of the illustration (from the generation, the AI or the user). */
  illustration_prompt: string | null;
  /** "IMG-7f3a2c91": written in image file names to attach them back. */
  code: string;
  /** Ready-to-paste prompt: style of the age group + description + rules. Empty without description. */
  imagePrompt: string;
  illustrationCount: number;
  /** Path of the first image ("uploads/…"), if any. */
  cover: string | null;
}

export interface IllustrationFilters {
  weekNumber?: number;
  ageGroup?: string;
  hasImage?: 'no' | 'all';
}

interface PromptResult {
  id: string;
  illustration_prompt: string;
  imagePrompt: string;
}

const filterParams = ({ weekNumber, ageGroup, hasImage }: IllustrationFilters = {}) => ({
  ...(weekNumber ? { weekNumber } : {}),
  ...(ageGroup && ageGroup !== 'all' ? { ageGroup } : {}),
  hasImage: hasImage ?? 'no',
});

export const illustrationApi = {
  getTodo: (filters?: IllustrationFilters) =>
    client.get<IllustrationTodo[]>(`${API_ENDPOINTS.ILLUSTRATIONS}/todo`, { params: filterParams(filters) }),
  /** Prompts file: txt to copy by hand, json for the Gemini Canvas tool. */
  exportPrompts: (filters: IllustrationFilters, format: 'txt' | 'json') =>
    client.get<Blob>(`${API_ENDPOINTS.ILLUSTRATIONS}/export`, { params: { ...filterParams(filters), format }, responseType: 'blob' }),
  /** Writes the description with the AI and saves it. */
  generatePrompt: (storyId: string) => client.post<PromptResult>(`${API_ENDPOINTS.ILLUSTRATIONS}/${storyId}/prompt`),
  setPrompt: (storyId: string, prompt: string) => client.put<PromptResult>(`${API_ENDPOINTS.ILLUSTRATIONS}/${storyId}/prompt`, { prompt }),
  /** Attaches an image to a story, after its current illustrations. */
  attach: (storyId: string, file: File, position: number) => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('storyId', storyId);
    formData.append('position', String(position));
    return systemApi.uploadImage(formData) as Promise<{ filename: string; imagePath: string }>;
  },
};
