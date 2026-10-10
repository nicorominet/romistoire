/**
 * Types for System API Responses and Payloads
 */

export interface LogEntry {
    timestamp: string;
    category?: string;
    level?: string; // 'INFO' | 'WARN' | 'ERROR'
    message?: string;
    data?: any;
    // Access Log specific fields
    method?: string;
    url?: string;
    status?: number;
    duration?: number | string;
    ip?: string;
    userAgent?: string;
    // AI Log specific fields
    meta?: any;
}

export interface AccessLogFile {
    filename: string;
    date: string;
    size: number;
    type?: 'access' | 'ai' | 'system';
}

export interface CleanupResponse {
    success: boolean;
    deletedCount: number;
    reclaimedSpace: number; // in bytes
    message?: string;
}

export interface ImportResponse {
    success: boolean;
    inserted: number;
    skipped: number;
    failed: number;
}

export interface LogConfig {
    enableSqlLogging: boolean;
    enableAccessLogging: boolean;
    minLevel: string;
}

export type AiProvider = 'gemini' | 'local';
export type BackupFrequency = 'daily' | 'weekly';

export type VoiceStyle = 'auto' | 'storyteller' | 'calm' | 'lively' | 'dramatic' | 'neutral';
export type VoicePace = 'auto' | 'slow' | 'normal' | 'lively';

/** Reading voice of the audio stories. null = code default; "auto" style or pace = from the age group. */
export interface AudioSettings {
    voice: string | null;
    characterVoice: string | null;
    style: VoiceStyle | null;
    pace: VoicePace | null;
    multiSpeaker: boolean | null;
}

/** Choices of the reading voice, sent by the server. */
export interface AudioOptions {
    /** Gemini prebuilt voices; trait = translation key settings.ai.voice.traits.<trait> */
    voices: { name: string; trait: string }[];
    styles: VoiceStyle[];
    paces: VoicePace[];
    defaults: { voice: string; characterVoice: string; style: VoiceStyle; pace: VoicePace; multiSpeaker: boolean };
    agePresets: Record<string, { style: Exclude<VoiceStyle, 'auto'>; pace: Exclude<VoicePace, 'auto'> }>;
}

/** Settings saved on the server. null = not set: the .env value (or the code default) applies. */
export interface AppSettings {
    ai: {
        defaultProvider: AiProvider | null;
        geminiModels: string[] | null;
        geminiAudioModels: string[] | null;
        ollamaBaseUrl: string | null;
        ollamaModel: string | null;
        creativity: number | null;
        geminiTimeoutMs: number | null;
        geminiWeekTimeoutMs: number | null;
        ollamaTimeoutMs: number | null;
        audio: AudioSettings;
    };
    storage: {
        autoBackup: { enabled: boolean; frequency: BackupFrequency; keep: number };
        orphanPurge: { enabled: boolean; maxAgeHours: number };
        logRetentionDays: number;
    };
}

/** Partial update sent to PUT /api/settings. */
export type AppSettingsUpdate = {
    ai?: Partial<Omit<AppSettings['ai'], 'audio'>> & { audio?: Partial<AudioSettings> };
    storage?: {
        autoBackup?: Partial<AppSettings['storage']['autoBackup']>;
        orphanPurge?: Partial<AppSettings['storage']['orphanPurge']>;
        logRetentionDays?: number;
    };
};

export interface AppSettingsResponse {
    settings: AppSettings;
    defaults: AppSettings;
    /** Values in use after the .env fallback. */
    effective: {
        defaultProvider: AiProvider;
        apiDefaultProvider: AiProvider;
        geminiModels: string[];
        geminiAudioModels: string[];
        geminiTimeoutMs: number;
        geminiWeekTimeoutMs: number;
        ollamaBaseUrl: string;
        ollamaModel: string;
        ollamaTimeoutMs: number;
    };
    codeDefaults: {
        geminiModels: string[];
        geminiAudioModels: string[];
        ollama: { baseUrl: string; model: string; timeoutMs: number };
    };
    geminiKeyConfigured: boolean;
    audioOptions: AudioOptions;
}

export interface PausedModel {
    model: string;
    reason: string;
    until: string;
}

/** Quota use of one Gemini model (GET /api/settings/quota-usage). Limits are the indicative free tier ones. */
export interface ModelQuotaUsage {
    model: string;
    limits: { rpm: number | null; rpd: number | null };
    today: { requests: number; ok: number; peakPerMinute: number; rateLimited: number; dailyQuota: number };
    period: {
        requests: number; ok: number; peakPerMinute: number; rateLimited: number; dailyQuota: number;
        overloaded: number; timeouts: number; errors: number; lastLimitedAt: string | null;
    };
    /** Google answered 429, or the counted use reached the limit */
    exceeded: boolean;
}

export interface QuotaUsage {
    /** Start of the current quota day (midnight, Pacific time) */
    dayStart: string;
    days: number;
    models: ModelQuotaUsage[];
    /** Audio generations left today on the configured TTS models; null when unknown */
    audioRemaining: number | null;
}

export interface OllamaTestResult {
    ok: boolean;
    baseUrl: string;
    models: string[];
    error?: string;
}

export interface DirUsage {
    files: number;
    bytes: number;
}

export interface StorageStats {
    counts: { stories: number; versions: number; illustrations: number; series: number; themes: number; weeklyThemes: number };
    disk: { uploads: DirUsage; logs: DirUsage; debugLog: DirUsage };
    backups: { count: number; bytes: number; last: string | null };
}

export interface BackupFile {
    filename: string;
    size: number;
    createdAt: string;
}

export type ExportType = 'json' | 'zip';

export type ImportMode = 'skip' | 'overwrite';

export interface UploadResponse {
    filename: string;
    path: string;
    imagePath?: string; // For compatibility if backend varies
}
