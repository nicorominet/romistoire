import client from './client';

import { Theme } from '../types/Theme';
import { Story } from '../types/Story';

export const themeApi = {
  getAll: (params?: any) => client.get<Theme[]>('/api/themes', { params }),
  create: (data: Partial<Theme>) => client.post<Theme>('/api/themes', data),
  update: (id: string, data: Partial<Theme>) => client.put<Theme>(`/api/themes/${id}`, data),
  delete: (id: string) => client.delete<{ success: boolean }>(`/api/themes/${id}`),
  mergeDuplicates: () => client.post<{ success: boolean, message: string }>('/api/themes/merge-duplicates'),
  updateStoriesTheme: (themeId: string, newThemeId: string) => client.put<{ success: boolean }>(`/api/themes/${themeId}/stories`, { newThemeId }),
  getStories: (themeId: string) => client.get<Story[]>(`/api/themes/${themeId}/stories`),
};

export const weeklyThemeApi = {
    getAll: () => client.get<Array<{ week_number: number, theme_name: string }>>('/api/weekly-themes'),
    getOne: (weekNumber: number) => client.get<{ week_number: number, theme_name: string }>(`/api/weekly-themes/${weekNumber}`),
    update: (themes: any[]) => client.post('/api/weekly-themes', themes),
};
