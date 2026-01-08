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
    WEEKLY_THEMES: '/weekly-themes',
    TIMELINE: '/timeline',
    THEMES: '/theme',
} as const;
