import client from './client';
import { API_ENDPOINTS } from '@/constants';
import { Theme } from '../types/Theme';
import { Story } from '../types/Story';

export const themeApi = {
  getAll: (params?: any) => client.get<Theme[]>(API_ENDPOINTS.THEMES, { params }),
  create: (data: Partial<Theme>) => client.post<Theme>(API_ENDPOINTS.THEMES, data),
  update: (id: string, data: Partial<Theme>) => client.put<Theme>(`${API_ENDPOINTS.THEMES}/${id}`, data),
  delete: (id: string) => client.delete<{ success: boolean }>(`${API_ENDPOINTS.THEMES}/${id}`),
  mergeDuplicates: () => client.post<{ success: boolean, message: string }>(`${API_ENDPOINTS.THEMES}/merge-duplicates`),
  updateStoriesTheme: (themeId: string, newThemeId: string) => client.put<{ success: boolean }>(`${API_ENDPOINTS.THEMES}/${themeId}/stories`, { newThemeId }),
  getStories: (themeId: string) => client.get<Story[]>(`${API_ENDPOINTS.THEMES}/${themeId}/stories`),
};

export const weeklyThemeApi = {
    getAll: () => client.get<Array<{ week_number: number, theme_name: string }>>(API_ENDPOINTS.WEEKLY_THEMES),
    getOne: (weekNumber: number) => client.get<{ week_number: number, theme_name: string }>(`${API_ENDPOINTS.WEEKLY_THEMES}/${weekNumber}`),
    update: (themes: any[]) => client.post(API_ENDPOINTS.WEEKLY_THEMES, themes),
};
