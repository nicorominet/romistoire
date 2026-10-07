import client from './client';
import { API_ENDPOINTS } from '@/constants';
import { Theme, ThemeFilters, ThemeInput, WeeklyTheme } from '../types/Theme';
import { Story } from '../types/Story';

/** Query string of the theme list: only the active filters. */
const listParams = ({ search, sort, needsReview, unused }: ThemeFilters = {}) => ({
  ...(search ? { search } : {}),
  ...(sort && sort !== 'name' ? { sort } : {}),
  ...(needsReview ? { needsReview: true } : {}),
  ...(unused ? { unused: true } : {}),
});

export const themeApi = {
  getAll: (filters?: ThemeFilters) => client.get<Theme[]>(API_ENDPOINTS.THEMES, { params: listParams(filters) }),
  getDuplicates: () => client.get<Theme[][]>(`${API_ENDPOINTS.THEMES}/duplicates`),
  /** Returns the existing theme (existing: true) when the name is already used. */
  create: (data: ThemeInput) => client.post<Theme & { existing: boolean }>(API_ENDPOINTS.THEMES, data),
  /** 409 { conflictWith } when the new name is already used by another theme. */
  update: (id: string, data: Partial<ThemeInput>) => client.put<Theme>(`${API_ENDPOINTS.THEMES}/${id}`, data),
  /** 409 { storyCount } when the theme is used and no replacement is given. */
  delete: (id: string, reassignTo?: string) =>
    client.delete<{ success: boolean; movedStories: number }>(`${API_ENDPOINTS.THEMES}/${id}`, { params: reassignTo ? { reassignTo } : {} }),
  merge: (sourceIds: string[], targetId: string) =>
    client.post<{ success: boolean; merged: number; movedStories: number; target: Theme }>(`${API_ENDPOINTS.THEMES}/merge`, { sourceIds, targetId }),
  getStories: (themeId: string) => client.get<Story[]>(`${API_ENDPOINTS.THEMES}/${themeId}/stories`),
};

export const weeklyThemeApi = {
  getAll: () => client.get<WeeklyTheme[]>(API_ENDPOINTS.WEEKLY_THEMES),
  /** Link a week to a theme: an existing id, or a name (theme created if needed). */
  setWeek: (weekNumber: number, data: { themeId?: string; themeName?: string }) =>
    client.put<WeeklyTheme>(`${API_ENDPOINTS.WEEKLY_THEMES}/${weekNumber}`, data),
  clearWeek: (weekNumber: number) => client.delete<{ success: boolean }>(`${API_ENDPOINTS.WEEKLY_THEMES}/${weekNumber}`),
  /** Batch update (imports). */
  update: (weeks: Array<Partial<WeeklyTheme>>) => client.post(API_ENDPOINTS.WEEKLY_THEMES, weeks),
};
