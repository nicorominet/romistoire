import client from './client';
import { API_ENDPOINTS } from '../constants';
import {
    AppSettingsResponse,
    AppSettingsUpdate,
    BackupFile,
    OllamaTestResult,
    PausedModel,
    QuotaUsage,
    StorageStats,
} from '../types/system.types';

/**
 * API Client for the server-side settings (AI generation, storage) and backups.
 */
export const settingsApi = {
    /** Saved settings, defaults and values in use. The Gemini key is never returned. */
    get: () => client.get<AppSettingsResponse>(API_ENDPOINTS.SETTINGS),

    /** Partial update; 400 with `fields` when a value is invalid. */
    update: (values: AppSettingsUpdate) => client.put<AppSettingsResponse>(API_ENDPOINTS.SETTINGS, values),

    /** Gemini models paused after an error. */
    getAiStatus: () => client.get<{ pausedModels: PausedModel[] }>(API_ENDPOINTS.SETTINGS_AI_STATUS),

    /** Gemini quota use per model: today and over the last `days`. */
    getQuotaUsage: (days = 7) => client.get<QuotaUsage>(API_ENDPOINTS.SETTINGS_QUOTA_USAGE, { params: { days } }),

    /** Lists the models of an Ollama instance (default: the configured one). */
    testOllama: (baseUrl?: string) => client.post<OllamaTestResult>(API_ENDPOINTS.SETTINGS_TEST_OLLAMA, { baseUrl }),

    /** Library counts, disk usage, backups summary. */
    getStorageStats: () => client.get<StorageStats>(API_ENDPOINTS.SETTINGS_STORAGE_STATS),

    listBackups: () => client.get<BackupFile[]>(API_ENDPOINTS.BACKUPS),

    /** Writes a backup now (retention of the settings applies). */
    runBackup: () => client.post<BackupFile & { removed: string[] }>(API_ENDPOINTS.BACKUPS),

    downloadBackup: (filename: string) =>
        client.get<Blob>(`${API_ENDPOINTS.BACKUPS}/${encodeURIComponent(filename)}`, { responseType: 'blob' }),

    deleteBackup: (filename: string) => client.delete(`${API_ENDPOINTS.BACKUPS}/${encodeURIComponent(filename)}`),

    /** Empties the debug log (server/debug/logs.jsonl). */
    clearDebugLog: () => client.delete(API_ENDPOINTS.LOGS),
};
