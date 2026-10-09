/**
 * Application Constants
 */

export const STORAGE_KEYS = {
    DEV_MODE: "devMode",
    THEME: "theme",
    LOCALE: "locale",
    LANGUAGES: {
        FR: "fr",
        EN: "en",
        OBF: "obf"
    },
    SETTINGS_TABS: {
        GENERAL: "general",
        LANGUAGE: "language",
        AI: "ai",
        DATA: "data",
        STORAGE: "storage",
        NETWORK: "network"
    }
} as const;

export const API_ENDPOINTS = {
    UPLOAD: '/api/upload',
    CLEANUP_IMAGES: '/api/cleanup-images',
    RESET_DATA: '/api/reset-data',
    IMPORT_DATA: '/api/import-data',
    EXPORT_DATA: '/api/export-data',
    EXPORT_FULL: '/api/export-full',
    EXPORT_PDF: '/api/export/pdf',
    LOGS: '/api/logs',
    ACCESS_LOGS_FILES: '/api/logs/access/files',
    ACCESS_LOGS_CONTENT: '/api/logs/access',
    CONFIG_LOGS: '/api/config/logs',
    SETTINGS: '/api/settings',
    SETTINGS_AI_STATUS: '/api/settings/ai-status',
    SETTINGS_QUOTA_USAGE: '/api/settings/quota-usage',
    SETTINGS_TEST_OLLAMA: '/api/settings/test-ollama',
    SETTINGS_STORAGE_STATS: '/api/settings/storage-stats',
    BACKUPS: '/api/backups',
    GENERATION_JOBS: '/api/generation-jobs',
    
    // Stories & Content
    STORIES: '/api/stories',
    THEMES: '/api/themes',
    SERIES: '/api/series',
    SERIES_STORIES_BATCH: '/api/series/:id/stories/batch', // :id will be replaced dynamically
    WEEKLY_THEMES: '/api/weekly-themes',
    ILLUSTRATIONS: '/api/illustrations',

} as const;

export const APP_ROUTES = {
    HOME: '/',
    STORIES: '/stories',
    STORY_DETAIL: (id: string) => `/stories/${id}`,
    CREATE_STORY: '/create',
    EDIT_STORY: (id: string) => `/edit/${id}`,
    SERIES_MANAGEMENT: '/series-management',
    SETTINGS: '/settings',
    // Mass generation (server-side jobs, coverage of the program)
    GENERATION: '/generation',
    TIMELINE: '/timeline',
    // Story themes (tags)
    THEMES: '/themes',
    // Topics of the weeks (free text guiding generation)
    WEEKLY_THEMES: '/weekly-themes',
    // Illustration workshop (prompts, batch import)
    ILLUSTRATIONS: '/illustrations',
} as const;

// Must match the server whitelist (server/config/upload.config.js)
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// AI generation (stories are generated in French only: prompt and output format are French)
// "Whole week" day value: understood by the server prompt helper (server/services/helpers/prompt.helper.js)
export const ALL_WEEK = 'Toute la semaine';
// Day values sent to the prompt, in week order
export const GENERATION_DAYS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const;
