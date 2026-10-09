/**
 * Application Constants
 */

export const STORAGE_KEYS = {
    STORIES: "imagitales-stories",
    VERSIONS: "imagitales-versions",
    ILLUSTRATIONS: "imagitales-illustrations",
    DEV_MODE: "devMode",
    THEME: "theme",
    AUTO_SAVE: "autoSave",
    LANGUAGES: {
        FR: "fr",
        EN: "en",
        OBF: "obf"
    },
    SETTINGS_TABS: {
        GENERAL: "general",
        LANGUAGE: "language",
        DATA: "data",
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
    
    // Stories & Content
    STORIES: '/api/stories',
    THEMES: '/api/themes',
    ALBUMS: '/api/albums', // Potential future use
    SERIES: '/api/series',
    SERIES_STORIES_BATCH: '/api/series/:id/stories/batch', // :id will be replaced dynamically
    WEEKLY_THEMES: '/api/weekly-themes',
    ILLUSTRATIONS: '/api/illustrations',
    GENERATE: '/api/generate',

} as const;

export const APP_ROUTES = {
    HOME: '/',
    STORIES: '/stories',
    STORY_DETAIL: (id: string) => `/stories/${id}`,
    CREATE_STORY: '/create',
    EDIT_STORY: (id: string) => `/edit/${id}`,
    SERIES_MANAGEMENT: '/series-management',
    SETTINGS: '/settings',
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

// AI generation
// Stories are generated in French only (prompt and output format are French)
export const GENERATION_LOCALE = 'fr';
// "Whole week" day value: understood by the server prompt helper (server/services/helpers/prompt.helper.js)
export const ALL_WEEK = 'Toute la semaine';
// Day values sent to the prompt, in week order
export const GENERATION_DAYS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const;
