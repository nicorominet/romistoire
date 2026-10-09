import client from './client';
import { API_ENDPOINTS } from '../constants';
import { Coverage, GenerationEstimate, GenerationJob, GenerationJobInput, TopicSuggestion } from '../types/generation.types';

/**
 * API Client for the mass generation jobs (run by the server, they survive a closed tab).
 */
export const generationJobsApi = {
    /** What a job would do (requests, duration, skipped cells). Creates nothing. */
    estimate: (input: GenerationJobInput) => client.post<GenerationEstimate>(`${API_ENDPOINTS.GENERATION_JOBS}/estimate`, input),

    create: (input: GenerationJobInput) => client.post<GenerationJob>(API_ENDPOINTS.GENERATION_JOBS, input),

    /** Latest jobs, newest first. */
    list: () => client.get<GenerationJob[]>(API_ENDPOINTS.GENERATION_JOBS),

    /** A job with its units and log. */
    get: (id: string) => client.get<GenerationJob>(`${API_ENDPOINTS.GENERATION_JOBS}/${id}`),

    action: (id: string, action: 'pause' | 'resume' | 'cancel' | 'retry-failed' | 'validate') =>
        client.post<GenerationJob | { updated: number }>(`${API_ENDPOINTS.GENERATION_JOBS}/${id}/${action}`),

    /** Deletes the stories written by the job. */
    deleteStories: (id: string) => client.delete<{ deleted: number }>(`${API_ENDPOINTS.GENERATION_JOBS}/${id}/stories`),

    /** Stories per (week, age) cell and topic of each week. */
    coverage: () => client.get<Coverage>(`${API_ENDPOINTS.GENERATION_JOBS}/coverage`),

    /** AI topic proposals for weeks of the program (nothing saved). */
    suggestTopics: (weeks: number[]) => client.post<TopicSuggestion[]>(`${API_ENDPOINTS.WEEKLY_THEMES}/suggest`, { weeks }),
};
