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

export interface LogConfig {
    enableSqlLogging: boolean;
    enableAccessLogging: boolean;
    minLevel: string;
}

export type ExportType = 'json' | 'zip';

export type ImportMode = 'skip' | 'overwrite';

export interface UploadResponse {
    filename: string;
    path: string;
    imagePath?: string; // For compatibility if backend varies
}
